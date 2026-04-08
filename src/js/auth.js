import { sb } from './supabase.js'
import { showToast } from './ui.js'
import { renderListings } from './listings.js'

export let currentUser = null
export let currentHandle = ''
export let currentProfile = null

export function setCurrentUser(user) { currentUser = user }
export function setCurrentHandle(handle) { currentHandle = handle }
export function setCurrentProfile(profile) { currentProfile = profile }

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initAuth() {
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
  currentUser = session.user
  // Load or create profile
  const { data: profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single()

  if (profile) {
    currentProfile = profile
    currentHandle = profile.rsi_handle || profile.display_name || 'PILOT'
    localStorage.setItem('rsi_handle', currentHandle)
    updateNavHandle(currentHandle)
    hideOnboarding()
  } else {
    // New user — need to complete profile
    showOnboarding('register')
  }
}

// ── Email / Password ──────────────────────────────────────────────────────────
export async function registerWithEmail() {
  const email = document.getElementById('reg-email')?.value?.trim()
  const password = document.getElementById('reg-password')?.value
  const handle = document.getElementById('reg-handle')?.value?.trim()?.toUpperCase()

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
      .single()

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

    showToast('// ACCOUNT CREATED — Check email to verify')
    if (btn) { btn.textContent = 'CREATE ACCOUNT'; btn.disabled = false }
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

// ── RSI Handle (guest) ────────────────────────────────────────────────────────
export function saveHandle() {
  const h = document.getElementById('onboard-handle')?.value?.trim()?.toUpperCase()
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
  if (loginView) loginView.style.display = view === 'login' ? 'block' : 'none'
  if (registerView) registerView.style.display = view === 'register' ? 'block' : 'none'
  if (guestView) guestView.style.display = view === 'guest' ? 'block' : 'none'
}
