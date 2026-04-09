import { sb } from './supabase.js'
import { showToast } from './ui.js'
import { getCurrentUser, getCurrentHandle } from './auth.js'
import { SHIPS } from './ships.js'

// Track which profile is currently open
let currentProfileHandle = ''

// ── Open profile modal ────────────────────────────────────────────────────────
export async function openProfile(handle) {
  if (!handle) return
  const modal = document.getElementById('profile-modal')
  const body = document.getElementById('profile-modal-body')
  if (!modal || !body) return

  currentProfileHandle = handle

  body.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#5a7a9a;letter-spacing:1px">[ LOADING PILOT DATA... ]</div>'
  modal.classList.add('open')
  document.body.style.overflow = 'hidden'

  // Safety timeout — if load takes >8s, show error instead of hanging forever
  const loadTimeout = setTimeout(() => {
    if (body.innerHTML.includes('LOADING PILOT DATA')) {
      body.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#e84f4f">[ LOAD TIMEOUT — CHECK CONNECTION ]</div>'
    }
  }, 8000)

  try {
    // Load profile
    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('rsi_handle', handle)
      .maybeSingle()

    if (!profile) {
      clearTimeout(loadTimeout)
      body.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#e84f4f">[ PILOT NOT FOUND ]</div>'
      return
    }

    // Load hangar, ratings, listings in parallel — each wrapped so one failure doesn't kill all
    const [hangarRes, ratingsRes, listingsRes] = await Promise.all([
      sb.from('hangars').select('*').eq('user_id', profile.id).order('ship_name').then(r => r).catch(() => ({ data: [] })),
      sb.from('ratings').select('*').eq('rated_id', profile.id).order('created_at', { ascending: false }).then(r => r).catch(() => ({ data: [] })),
      sb.from('listings').select('*').eq('owner', handle).order('created_at', { ascending: false }).then(r => r).catch(() => ({ data: [] }))
    ])

    clearTimeout(loadTimeout)

    const hangar = hangarRes.data || []
    const ratings = ratingsRes.data || []
    const listings = (listingsRes.data || []).filter(l => !l.expires_at || new Date(l.expires_at) > new Date())

    // Calculate average rating
    const avgRating = ratings.length
      ? (ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length).toFixed(1)
      : null

    const currentHandle = getCurrentHandle()
    const isOwnProfile = currentHandle && handle.toLowerCase() === currentHandle.toLowerCase()
    const initials = handle.slice(0, 2).toUpperCase()

    body.innerHTML = `
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--border)">
        <div id="profile-avatar-wrap" style="flex-shrink:0;position:relative">
          ${profile.avatar_url
            ? `<img src="${profile.avatar_url}" style="width:72px;height:72px;border-radius:50%;border:2px solid var(--border-bright);object-fit:cover" />`
            : `<div style="width:72px;height:72px;border-radius:50%;border:2px solid var(--border-bright);background:rgba(79,168,232,0.1);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:var(--accent)">${initials}</div>`
          }
          ${isOwnProfile ? `<button onclick="triggerAvatarUpload()" style="position:absolute;bottom:0;right:0;width:22px;height:22px;border-radius:50%;background:var(--accent);border:none;color:var(--bg);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center">✎</button>` : ''}
          <input type="file" id="avatar-upload" accept="image/*" style="display:none" onchange="uploadAvatar(this)" />
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Orbitron',monospace;font-size:16px;font-weight:700;color:var(--text-bright);letter-spacing:2px;margin-bottom:4px">${handle}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);letter-spacing:1px;margin-bottom:8px">
            PILOT SINCE ${new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}
          </div>
          ${avgRating
            ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span style="color:#e8c84f;font-size:14px">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5-Math.round(avgRating))}</span>
                <span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim)">${avgRating} (${ratings.length} rating${ratings.length !== 1 ? 's' : ''})</span>
               </div>`
            : `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);margin-bottom:8px">NO RATINGS YET</div>`
          }
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${profile.discord_handle ? `<a href="javascript:void(0)" onclick="copyToClipboard('@${profile.discord_handle}')" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:#5865F2;border:1px solid #5865F2;padding:2px 8px;text-decoration:none;letter-spacing:1px">⊹ DISCORD</a>` : ''}
            ${profile.twitch ? `<a href="https://twitch.tv/${profile.twitch}" target="_blank" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:#9146ff;border:1px solid #9146ff;padding:2px 8px;text-decoration:none;letter-spacing:1px">⊹ TWITCH</a>` : ''}
            ${profile.youtube ? `<a href="https://youtube.com/@${profile.youtube}" target="_blank" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:#ff0000;border:1px solid #ff0000;padding:2px 8px;text-decoration:none;letter-spacing:1px">⊹ YOUTUBE</a>` : ''}
          </div>
        </div>
      </div>

      <!-- Bio -->
      ${profile.bio || isOwnProfile ? `
      <div style="margin-bottom:20px">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">// Bio</div>
        ${isOwnProfile
          ? `<textarea id="profile-bio" class="form-input" rows="3" style="resize:none;line-height:1.5" placeholder="Tell the verse about yourself..." maxlength="280" onblur="saveProfileField('bio', this.value)">${profile.bio || ''}</textarea>`
          : `<div style="font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--text);line-height:1.6;padding:10px;border:1px solid var(--border)">${profile.bio || '—'}</div>`
        }
      </div>` : ''}

      <!-- Social links (edit mode for own profile) -->
      ${isOwnProfile ? `
      <div style="margin-bottom:20px">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">// Social Links</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="form-label">Discord Handle</label>
            <input class="form-input" id="profile-discord" placeholder="your_handle" value="${profile.discord_handle || ''}" onblur="saveProfileField('discord_handle', this.value)" />
          </div>
          <div>
            <label class="form-label">Twitch Username</label>
            <input class="form-input" id="profile-twitch" placeholder="twitchname" value="${profile.twitch || ''}" onblur="saveProfileField('twitch', this.value)" />
          </div>
          <div>
            <label class="form-label">YouTube Handle</label>
            <input class="form-input" id="profile-youtube" placeholder="@yourchannel" value="${profile.youtube || ''}" onblur="saveProfileField('youtube', this.value)" />
          </div>
        </div>
      </div>` : ''}

      <!-- Ship Hangar -->
      <div style="margin-bottom:20px">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">// Ship Hangar${isOwnProfile ? ' <span style="color:var(--accent);cursor:pointer;font-size:9px" onclick="toggleAddShip()">+ ADD</span>' : ''}</div>
        ${isOwnProfile ? `
        <div id="add-ship-form" style="display:none;margin-bottom:12px;padding:12px;border:1px solid var(--border);background:var(--bg)">
          <div class="ship-select-wrapper" style="margin-bottom:8px">
            <input class="form-input" id="hangar-ship-search" placeholder="Search ships..." autocomplete="off" />
            <div class="ship-dropdown" id="hangar-ship-dropdown"></div>
            <input type="hidden" id="hangar-ship-value" />
          </div>
          <button class="btn-post" style="margin-top:0;padding:8px" onclick="addShipToHangar()">ADD TO HANGAR</button>
        </div>` : ''}
        ${hangar.length > 0
          ? `<div style="display:flex;flex-wrap:wrap;gap:6px">
              ${hangar.map(s => `
                <div style="display:flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--border);background:var(--bg);font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text)">
                  ${s.ship_name}
                  <span style="color:var(--text-dim);font-size:9px">${s.manufacturer || ''}</span>
                  ${isOwnProfile ? `<button onclick="removeShipFromHangar('${s.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:11px;padding:0 2px">✕</button>` : ''}
                </div>`).join('')}
             </div>`
          : `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim)">${isOwnProfile ? 'No ships added yet — add your fleet above' : 'No ships listed'}</div>`
        }
      </div>

      <!-- Active Listings -->
      ${listings.length > 0 ? `
      <div style="margin-bottom:20px">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">// Active Listings (${listings.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${listings.map(l => `
            <div style="padding:10px 12px;border:1px solid var(--border);background:var(--bg);font-family:'Share Tech Mono',monospace;font-size:10px">
              <div style="color:var(--text-bright);margin-bottom:4px">${(l.ship || l.org_name || 'LISTING').toUpperCase()}</div>
              <div style="color:var(--text-dim)">${l.mission ? l.mission.toUpperCase() : ''} · ${l.playstyle || ''}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Rate this pilot -->
      ${!isOwnProfile && getCurrentUser() ? `
      <div style="margin-bottom:20px;padding:16px;border:1px solid var(--border);background:var(--bg)">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:12px">// Rate This Pilot</div>
        <div style="display:flex;gap:8px;margin-bottom:10px" id="rating-stars">
          ${[1,2,3,4,5].map(n => `<button onclick="setRating(${n})" data-star="${n}" style="font-size:20px;background:none;border:none;cursor:pointer;color:var(--text-dim);transition:color 0.15s">☆</button>`).join('')}
        </div>
        <input class="form-input" id="rating-comment" placeholder="Leave a comment (optional)" maxlength="140" style="margin-bottom:8px" />
        <button class="btn-post" style="margin-top:0;padding:8px" onclick="submitRating('${profile.id}')">SUBMIT RATING</button>
      </div>` : ''}

      <!-- Recent Ratings -->
      ${ratings.length > 0 ? `
      <div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">// Recent Ratings</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${ratings.slice(0, 5).map(r => `
            <div style="padding:10px 12px;border:1px solid var(--border);background:var(--bg)">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="color:#e8c84f">${'★'.repeat(r.score)}${'☆'.repeat(5-r.score)}</span>
                <span style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim)">${new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              ${r.comment ? `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text);font-style:italic">"${r.comment}"</div>` : ''}
            </div>`).join('')}
        </div>
      </div>` : ''}
    `

    // Init hangar ship search if own profile
    if (isOwnProfile) {
      initHangarSearch()
    }

  } catch (e) {
    clearTimeout(loadTimeout)
    console.error('Profile load error:', e)
    body.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#e84f4f">[ ERROR LOADING PROFILE ]</div>'
  }
}

export function closeProfile() {
  document.getElementById('profile-modal')?.classList.remove('open')
  document.body.style.overflow = ''
}

// ── Rating ────────────────────────────────────────────────────────────────────
let selectedRating = 0

function setRating(n) {
  selectedRating = n
  document.querySelectorAll('#rating-stars button').forEach((btn, i) => {
    btn.textContent = i < n ? '★' : '☆'
    btn.style.color = i < n ? '#e8c84f' : 'var(--text-dim)'
  })
}
window.setRating = setRating

export async function submitRating(ratedId) {
  if (!selectedRating) { showToast('// SELECT A STAR RATING'); return }
  const currentUser = getCurrentUser()
  if (!currentUser) { showToast('// LOGIN REQUIRED TO RATE'); return }
  const comment = document.getElementById('rating-comment')?.value?.trim()
  try {
    const { error } = await sb.from('ratings').upsert({
      rater_id: currentUser.id,
      rated_id: ratedId,
      score: selectedRating,
      comment: comment || null,
      created_at: new Date().toISOString()
    }, { onConflict: 'rater_id,rated_id' })
    if (error) throw error
    showToast('// RATING SUBMITTED')
    selectedRating = 0
  } catch (e) {
    console.error('Rating error:', e)
    showToast('// ERROR: Could not submit rating')
  }
}
window.submitRating = submitRating

// ── Profile field save ────────────────────────────────────────────────────────
export async function saveProfileField(field, value) {
  const currentUser = getCurrentUser()
  if (!currentUser) return
  try {
    await sb.from('profiles').update({ [field]: value || null }).eq('id', currentUser.id)
    showToast('// PROFILE UPDATED')
  } catch (e) { console.error('Profile save error:', e) }
}
window.saveProfileField = saveProfileField

// ── Avatar ────────────────────────────────────────────────────────────────────
export function triggerAvatarUpload() {
  document.getElementById('avatar-upload')?.click()
}
window.triggerAvatarUpload = triggerAvatarUpload

export async function uploadAvatar(input) {
  const currentUser = getCurrentUser()
  if (!currentUser || !input.files[0]) return
  const file = input.files[0]
  const ext = file.name.split('.').pop()
  const fileName = `${currentUser.id}.${ext}`
  try {
    const { error } = await sb.storage.from('avatars').upload(fileName, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data } = sb.storage.from('avatars').getPublicUrl(fileName)
    await sb.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', currentUser.id)
    // Update avatar in modal
    const wrap = document.getElementById('profile-avatar-wrap')
    if (wrap) {
      const img = wrap.querySelector('img') || document.createElement('img')
      img.src = data.publicUrl
      img.style.cssText = 'width:72px;height:72px;border-radius:50%;border:2px solid var(--border-bright);object-fit:cover'
      if (!wrap.querySelector('img')) wrap.prepend(img)
    }
    showToast('// AVATAR UPDATED')
  } catch (e) {
    console.error('Avatar upload error:', e)
    showToast('// ERROR: Could not upload avatar')
  }
}
window.uploadAvatar = uploadAvatar

// ── Hangar ────────────────────────────────────────────────────────────────────
export function toggleAddShip() {
  const form = document.getElementById('add-ship-form')
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none'
}
window.toggleAddShip = toggleAddShip

function initHangarSearch() {
  const input = document.getElementById('hangar-ship-search')
  const dropdown = document.getElementById('hangar-ship-dropdown')
  if (!input || !dropdown) return
  input.addEventListener('focus', () => { renderHangarDropdown(input.value); dropdown.classList.add('open') })
  input.addEventListener('input', e => { renderHangarDropdown(e.target.value); dropdown.classList.add('open') })
  input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('open'), 150))
}

function renderHangarDropdown(query) {
  const dropdown = document.getElementById('hangar-ship-dropdown')
  if (!dropdown) return
  const q = query.toLowerCase()
  const filtered = SHIPS.filter(s => s.name.toLowerCase().includes(q) || s.manufacturer.toLowerCase().includes(q)).slice(0, 20)
  dropdown.innerHTML = filtered.map(s => `
    <div class="ship-option" onclick="selectHangarShip('${s.name.replace(/'/g,"\\'")}','${s.manufacturer}')">
      ${s.name} <span class="manufacturer">${s.manufacturer}</span>
    </div>`).join('')
}

function selectHangarShip(name, manufacturer) {
  const input = document.getElementById('hangar-ship-search')
  const hidden = document.getElementById('hangar-ship-value')
  if (input) input.value = name
  if (hidden) hidden.value = JSON.stringify({ name, manufacturer })
  document.getElementById('hangar-ship-dropdown')?.classList.remove('open')
}
window.selectHangarShip = selectHangarShip

export async function addShipToHangar() {
  const currentUser = getCurrentUser()
  if (!currentUser) { showToast('// LOGIN REQUIRED'); return }
  const raw = document.getElementById('hangar-ship-value')?.value
  if (!raw) { showToast('// SELECT A SHIP FIRST'); return }
  const { name, manufacturer } = JSON.parse(raw)
  try {
    const { error } = await sb.from('hangars').insert({ user_id: currentUser.id, ship_name: name, manufacturer })
    if (error) throw error
    showToast('// SHIP ADDED TO HANGAR')
    document.getElementById('hangar-ship-search').value = ''
    document.getElementById('hangar-ship-value').value = ''
    document.getElementById('add-ship-form').style.display = 'none'
    if (currentProfileHandle) openProfile(currentProfileHandle)
  } catch (e) { 
    console.error('Add ship error:', e)
    showToast('// ERROR: Could not add ship') 
  }
}
window.addShipToHangar = addShipToHangar

export async function removeShipFromHangar(id) {
  const currentUser = getCurrentUser()
  if (!currentUser) { showToast('// LOGIN REQUIRED'); return }
  try {
    await sb.from('hangars').delete().eq('id', id)
    showToast('// SHIP REMOVED')
    if (currentProfileHandle) openProfile(currentProfileHandle)
  } catch (e) { showToast('// ERROR: Could not remove ship') }
}
window.removeShipFromHangar = removeShipFromHangar

export function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => showToast('// COPIED: ' + text))
}
window.copyToClipboard = copyToClipboard
