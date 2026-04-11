import { sb } from './supabase.js'
import { showToast } from './ui.js'
import { renderListings } from './listings.js'

export let currentUser = null
export let currentHandle = ''
export let currentProfile = null

export function setCurrentUser(user) { currentUser = user }
export function setCurrentHandle(handle) { currentHandle = handle }
export function setCurrentProfile(profile) { currentProfile = profile }

// Getter functions for modules that need current values
export function getCurrentUser() { return currentUser }
export function getCurrentHandle() { return currentHandle }
export function getCurrentProfile() { return currentProfile }

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initAuth() {
  // Check if we're returning from a password reset email link
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('reset') === 'true') {
    // Supabase sets the session automatically from the URL hash
    // Just show the set-new-password view
    document.getElementById('onboarding').style.display = 'flex'
    setOnboardView('newpass')
    return
  }

  try {
    const { data: { session } } = await sb.auth.getSession()
    if (session?.user) {
      await handleSession(session)
    } else {
      const saved = localStorage.getItem('rsi_handle')
      if (saved) {
        currentHandle = saved
        updateNavHandle(saved)
        hideOnboarding()
      } else {
        showOnboarding('login')
      }
    }
  } catch (e) {
    console.error('Auth init error:', e)
    showOnboarding('login')
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
      await handleSession(session)
    } else if (event === 'SIGNED_OUT') {
      currentUser = null
      currentHandle = ''
      currentProfile = null
      updateNavHandle('---')
      showOnboarding('login')
    }
  })
}

async function handleSession(session) {
  console.log('handleSession called, user:', session?.user?.email)
  currentUser = session.user
  // Load profile — use maybeSingle so no error if profile doesn't exist yet
  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .maybeSingle()

  if (profile) {
    currentProfile = profile
    currentHandle = profile.rsi_handle || profile.display_name || 'PILOT'
    localStorage.setItem('rsi_handle', currentHandle)
    updateNavHandle(currentHandle)
    hideOnboarding()
  } else {
    // No profile yet — check if this is a Discord user and auto-create their profile
    const isDiscord = currentUser.app_metadata?.provider === 'discord'
    if (isDiscord) {
      // Pull handle from Discord metadata, fall back to username
      const discordName = currentUser.user_metadata?.custom_claims?.global_name
        || currentUser.user_metadata?.full_name
        || currentUser.user_metadata?.name
        || currentUser.email?.split('@')[0]
        || 'PILOT'
      const handle = discordName.toUpperCase().replace(/\s+/g, '_')

      // Check if handle is already taken by another user
      const { data: existing } = await sb
        .from('profiles')
        .select('id')
        .eq('rsi_handle', handle)
        .maybeSingle()

      const finalHandle = existing ? handle + '_' + currentUser.id.slice(0, 4).toUpperCase() : handle

      try {
        await sb.from('profiles').insert({
          id: currentUser.id,
          rsi_handle: finalHandle,
          display_name: finalHandle,
          email: currentUser.email || null,
          created_at: new Date().toISOString()
        })
        currentProfile = { rsi_handle: finalHandle, display_name: finalHandle }
        currentHandle = finalHandle
        localStorage.setItem('rsi_handle', finalHandle)
        updateNavHandle(finalHandle)
        hideOnboarding()
        showToast('// WELCOME TO CREWFIND, ' + finalHandle)
      } catch (e) {
        console.error('Auto profile create error:', e)
        // Profile might have been created in a race — try loading again
        const { data: retry } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle()
        if (retry) {
          currentProfile = retry
          currentHandle = retry.rsi_handle || retry.display_name || 'PILOT'
          localStorage.setItem('rsi_handle', currentHandle)
          updateNavHandle(currentHandle)
          hideOnboarding()
        } else {
          showOnboarding('register')
        }
      }
    } else {
      // Email user with no profile — send to register to pick a handle
      showOnboarding('register')
    }
  }
}

// ── Email / Password ──────────────────────────────────────────────────────────
export async function registerWithEmail() {
  const email = document.getElementById('reg-email')?.value?.trim()
  const password = document.getElementById('reg-password')?.value
  const handle = document.getElementById('reg-handle')?.value?.trim()

  if (!email || !password || !handle) {
    showToast('// ERROR: All fields required')
    return
  }
  if (password.length < 6) {
    showToast('// ERROR: Password must be 6+ characters')
    return
  }

  const btn = document.getElementById('btn-register')
  if (btn) { btn.textContent = 'REGISTERING...'; btn.disabled = true }

  try {
    // Check handle not taken
    const { data: existing } = await sb
      .from('profiles')
      .select('id')
      .eq('rsi_handle', handle)
      .maybeSingle()

    if (existing) {
      showToast('// ERROR: RSI handle already taken')
      if (btn) { btn.textContent = 'CREATE ACCOUNT'; btn.disabled = false }
      return
    }

    const { data, error } = await sb.auth.signUp({ email, password })
    if (error) throw error

    // Create profile
    await sb.from('profiles').insert({
      id: data.user.id,
      rsi_handle: handle,
      display_name: handle,
      email: email,
      created_at: new Date().toISOString()
    })

    // Profile created — update UI immediately
    currentUser = data.user
    currentProfile = { rsi_handle: handle, display_name: handle }
    currentHandle = handle
    localStorage.setItem('rsi_handle', handle)
    updateNavHandle(handle)
    hideOnboarding()
    showToast('// WELCOME TO CREWFIND, ' + handle.toUpperCase())
    if (btn) { btn.textContent = 'CREATE ACCOUNT'; btn.disabled = false }
    // Trigger listings render
    const { renderListings } = await import('./listings.js')
    await renderListings()
  } catch (e) {
    console.error('Register error:', e)
    showToast('// ERROR: ' + (e.message || 'Registration failed'))
    if (btn) { btn.textContent = 'CREATE ACCOUNT'; btn.disabled = false }
  }
}

export async function loginWithEmail() {
  const email = document.getElementById('login-email')?.value?.trim()
  const password = document.getElementById('login-password')?.value

  if (!email || !password) {
    showToast('// ERROR: Email and password required')
    return
  }

  const btn = document.getElementById('btn-login')
  if (btn) { btn.textContent = 'LOGGING IN...'; btn.disabled = true }

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
  } catch (e) {
    showToast('// ERROR: ' + (e.message || 'Login failed'))
    if (btn) { btn.textContent = 'LOGIN'; btn.disabled = false }
  }
}

// ── Password Reset ────────────────────────────────────────────────────────────
export async function resetPassword() {
  const email = document.getElementById('reset-email')?.value?.trim()
  if (!email) { showToast('// ERROR: Enter your email address'); return }

  const btn = document.getElementById('btn-reset')
  if (btn) { btn.textContent = 'SENDING...'; btn.disabled = true }

  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://sc-crewfind.com?reset=true'
    })
    if (error) throw error
    showToast('// RESET LINK SENT — CHECK YOUR EMAIL')
    // Switch back to login view after a moment
    setTimeout(() => setOnboardView('login'), 2000)
  } catch (e) {
    showToast('// ERROR: ' + (e.message || 'Could not send reset email'))
  } finally {
    if (btn) { btn.textContent = 'SEND RESET LINK'; btn.disabled = false }
  }
}

export async function setNewPassword() {
  const password = document.getElementById('newpass-password')?.value
  const confirm = document.getElementById('newpass-confirm')?.value
  if (!password || !confirm) { showToast('// ERROR: Fill in both fields'); return }
  if (password !== confirm) { showToast('// ERROR: Passwords do not match'); return }
  if (password.length < 6) { showToast('// ERROR: Password must be 6+ characters'); return }

  const btn = document.getElementById('btn-set-password')
  if (btn) { btn.textContent = 'UPDATING...'; btn.disabled = true }

  try {
    const { error } = await sb.auth.updateUser({ password })
    if (error) throw error
    showToast('// PASSWORD UPDATED — YOU ARE NOW LOGGED IN')
    hideOnboarding()
    // Clean up the URL
    window.history.replaceState({}, '', '/')
  } catch (e) {
    showToast('// ERROR: ' + (e.message || 'Could not update password'))
  } finally {
    if (btn) { btn.textContent = 'SET NEW PASSWORD'; btn.disabled = false }
  }
}

export async function signInWithDiscord() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: 'https://sc-crewfind.com',
      scopes: 'identify'
    }
  })
  if (error) { showToast('// ERROR: Could not connect to Discord') }
}

export async function signOut() {
  await sb.auth.signOut()
  localStorage.removeItem('rsi_handle')
  currentUser = null
  currentHandle = ''
  currentProfile = null
  updateNavHandle('---')
  showOnboarding('login')
}

export async function deleteAccount() {
  if (!currentUser) { showToast('// ERROR: NOT LOGGED IN'); return }

  const first = confirm('Are you sure you want to delete your account? This will remove your profile, listings, hangar and ratings permanently.')
  if (!first) return
  const second = confirm('This cannot be undone. Delete account?')
  if (!second) return

  const userId = currentUser.id
  const handle = currentHandle

  try {
    showToast('// DELETING ACCOUNT...')

    // Get session token BEFORE we start deleting anything
    const { data: { session } } = await sb.auth.getSession()
    if (!session) throw new Error('No active session')

    // Delete all user data in correct order (must delete profile before auth user)
    await sb.from('hangars').delete().eq('user_id', userId)
    await sb.from('ratings').delete().eq('rater_id', userId)
    await sb.from('ratings').delete().eq('rated_id', userId)
    await sb.from('listings').delete().eq('owner', handle)
    await sb.from('profiles').delete().eq('id', userId)

    // Now call edge function to delete the auth.users row
    // Profile must be deleted first or foreign key constraint will block it
    const res = await fetch('https://sfozlgthgvphkntxbhgn.supabase.co/functions/v1/delete-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    })

    const result = await res.json()
    if (!res.ok) {
      // Log but don't block — data is already deleted, orphaned auth row is harmless
      console.warn('Edge function delete-user failed:', result)
    }

    // Sign out and clear everything locally
    await sb.auth.signOut()
    currentUser = null
    currentHandle = ''
    currentProfile = null
    localStorage.clear()
    updateNavHandle('---')
    showOnboarding('login')
    showToast('// ACCOUNT DELETED')
  } catch (e) {
    console.error('Delete account error:', e)
    showToast('// ERROR: Could not delete account — ' + (e.message || 'try again'))
  }
}

// ── RSI Handle (guest) ────────────────────────────────────────────────────────
export function saveHandle() {
  const h = document.getElementById('onboard-handle')?.value?.trim()
  if (!h) { showToast('// ERROR: Enter your RSI handle'); return }
  currentHandle = h
  localStorage.setItem('rsi_handle', h)
  updateNavHandle(h)
  hideOnboarding()
  renderListings()
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function updateNavHandle(handle) {
  const el = document.getElementById('pilot-handle')
  if (el) el.textContent = handle
}

export function showOnboarding(view = 'login') {
  document.getElementById('onboarding').style.display = 'flex'
  setOnboardView(view)
}

export function hideOnboarding() {
  document.getElementById('onboarding').style.display = 'none'
}

export function setOnboardView(view) {
  const loginView = document.getElementById('onboard-login-view')
  const registerView = document.getElementById('onboard-register-view')
  const guestView = document.getElementById('onboard-guest-view')
  const resetView = document.getElementById('onboard-reset-view')
  const newpassView = document.getElementById('onboard-newpass-view')
  if (loginView) loginView.style.display = view === 'login' ? 'block' : 'none'
  if (registerView) registerView.style.display = view === 'register' ? 'block' : 'none'
  if (guestView) guestView.style.display = view === 'guest' ? 'block' : 'none'
  if (resetView) resetView.style.display = view === 'reset' ? 'block' : 'none'
  if (newpassView) newpassView.style.display = view === 'newpass' ? 'block' : 'none'

  // Update tab button highlights (tabs only exist for login/register/guest)
  document.querySelectorAll('.auth-tab-btn').forEach(btn => btn.classList.remove('active'))
  const activeBtn = document.querySelector(`.auth-tab-btn[onclick*="'${view}'"]`)
  if (activeBtn) activeBtn.classList.add('active')
}
