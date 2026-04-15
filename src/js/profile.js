import { sb } from './supabase.js'
import { showToast } from './ui.js'
import { getCurrentUser, getCurrentHandle } from './auth.js'
import { SHIPS } from './ships.js'
import { reportButtonHtml } from './admin.js'
import { startConversation } from './messages.js'

// ── XSS helpers ───────────────────────────────────────────────────────────────
function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
// Safe JS string argument for use inside onclick="fn(jsStr(val))" attributes
function jsStr(val) {
  return JSON.stringify(String(val == null ? '' : val)).replace(/"/g, '&quot;')
}
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
    // Load profile — try by handle first, fall back to auth user id if it's own profile
    let { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('rsi_handle', handle)
      .maybeSingle()

    // Fallback: if no profile found and this looks like the current user, try by id
    if (!profile) {
      const { getCurrentUser } = await import('./auth.js')
      const user = getCurrentUser()
      if (user) {
        const { data: profileById } = await sb
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (profileById) profile = profileById
      }
    }

    if (!profile) {
      clearTimeout(loadTimeout)
      body.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#e84f4f">[ PILOT NOT FOUND ]</div>'
      return
    }

    // Check if profile is hidden/banned
    if (profile.hidden && !isOwnProfile) {
      clearTimeout(loadTimeout)
      body.innerHTML = '<div style="padding:40px;text-align:center;font-family:\'Share Tech Mono\',monospace;color:var(--text-dim);letter-spacing:1px">[ THIS PILOT IS UNDER REVIEW ]</div>'
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
            ? `<img src="${esc(profile.avatar_url)}" style="width:72px;height:72px;border-radius:50%;border:2px solid var(--border-bright);object-fit:cover" />`
            : `<div style="width:72px;height:72px;border-radius:50%;border:2px solid var(--border-bright);background:rgba(79,168,232,0.1);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',monospace;font-size:18px;font-weight:700;color:var(--accent)">${esc(initials)}</div>`
          }
          ${isOwnProfile ? `<button onclick="triggerAvatarUpload()" style="position:absolute;bottom:0;right:0;width:22px;height:22px;border-radius:50%;background:var(--accent);border:none;color:var(--bg);font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center">✎</button>` : ''}
          <input type="file" id="avatar-upload" accept="image/*" style="display:none" onchange="uploadAvatar(this)" />
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:'Orbitron',monospace;font-size:16px;font-weight:700;color:var(--text-bright);letter-spacing:2px;margin-bottom:4px">${esc(handle)}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);letter-spacing:1px;margin-bottom:8px">
            ${isOwnProfile
              ? `PILOT SINCE <input type="month"
                  value="${(profile.pilot_since || profile.created_at || '').slice(0, 7)}"
                  min="2013-01"
                  max="${new Date().toISOString().slice(0, 7)}"
                  title="Set when you started playing Star Citizen"
                  onchange="saveProfileField('pilot_since', this.value + '-01')"
                  style="background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:1px;cursor:pointer;padding:0 2px;width:auto" />`
              : `PILOT SINCE ${new Date(profile.pilot_since || profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}`
            }
          </div>
          ${avgRating
            ? `<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                <span style="color:#e8c84f;font-size:14px">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5-Math.round(avgRating))}</span>
                <span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim)">${avgRating} (${ratings.length} rating${ratings.length !== 1 ? 's' : ''})</span>
               </div>`
            : `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);margin-bottom:8px">NO RATINGS YET</div>`
          }
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${profile.discord_handle ? `<a href="javascript:void(0)" onclick="copyToClipboard(${jsStr('@' + profile.discord_handle)})" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:#5865F2;border:1px solid #5865F2;padding:2px 8px;text-decoration:none;letter-spacing:1px">⊹ DISCORD</a>` : ''}
            ${profile.twitch ? `<a href="javascript:void(0)" onclick="openExternalUrl(${jsStr('https://twitch.tv/' + profile.twitch.replace(/^@/, ''))})" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:#9146ff;border:1px solid #9146ff;padding:2px 8px;text-decoration:none;letter-spacing:1px">⊹ TWITCH</a>` : ''}
            ${profile.youtube ? `<a href="javascript:void(0)" onclick="openExternalUrl(${jsStr('https://youtube.com/@' + profile.youtube.replace(/^@/, ''))})" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:#ff0000;border:1px solid #ff0000;padding:2px 8px;text-decoration:none;letter-spacing:1px">⊹ YOUTUBE</a>` : ''}
          </div>
          ${!isOwnProfile ? `
          <button onclick="startConversation(${jsStr(handle)})" style="margin-top:10px;padding:7px 16px;background:transparent;border:1px solid var(--accent);color:var(--accent);font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;width:100%;transition:all 0.15s"
            onmouseover="this.style.background='rgba(79,168,232,0.1)'" onmouseout="this.style.background='transparent'">
            ✉ MESSAGE PILOT
          </button>
          <div style="margin-top:6px;text-align:right">
            ${reportButtonHtml('profile', handle)}
          </div>` : ''}
        </div>
      </div>

      <!-- Bio -->
      ${profile.bio || isOwnProfile ? `
      <div style="margin-bottom:20px">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">// Bio</div>
        ${isOwnProfile
          ? `<textarea id="profile-bio" class="form-input" rows="3" style="resize:none;line-height:1.5" placeholder="Tell the verse about yourself..." maxlength="280" onblur="saveProfileField('bio', this.value)">${profile.bio || ''}</textarea>`
          : `<div style="font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--text);line-height:1.6;padding:10px;border:1px solid var(--border)">${esc(profile.bio || '—')}</div>`
        }
      </div>` : ''}

      <!-- Social links (edit mode for own profile) -->
      ${isOwnProfile ? `
      <div style="margin-bottom:20px">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">// Social Links</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="form-label">Discord Handle</label>
            <input class="form-input" id="profile-discord" placeholder="your_handle" value="${esc(profile.discord_handle || '')}" onblur="saveProfileField('discord_handle', this.value)" />
          </div>
          <div>
            <label class="form-label">Twitch Username</label>
            <input class="form-input" id="profile-twitch" placeholder="twitchname" value="${esc(profile.twitch || '')}" onblur="saveProfileField('twitch', this.value)" />
          </div>
          <div>
            <label class="form-label">YouTube Handle</label>
            <input class="form-input" id="profile-youtube" placeholder="@yourchannel" value="${esc(profile.youtube || '')}" onblur="saveProfileField('youtube', this.value)" />
          </div>
        </div>
      </div>` : ''}

      <!-- Ship Hangar -->
      <div style="margin-bottom:20px">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">// Ship Hangar${isOwnProfile ? ' <span style="color:var(--accent);cursor:pointer;font-size:9px" onclick="toggleAddShip()">+ ADD</span>' : ''}</div>
        ${isOwnProfile ? `
        <div id="add-ship-form" style="display:none;margin-bottom:12px;padding:12px;border:1px solid var(--border);background:var(--bg)">
          <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);letter-spacing:1px;margin-bottom:6px">MANUAL ADD</div>
          <div class="ship-select-wrapper" style="margin-bottom:8px">
            <input class="form-input" id="hangar-ship-search" placeholder="Search ships..." autocomplete="off" />
            <div class="ship-dropdown" id="hangar-ship-dropdown"></div>
            <input type="hidden" id="hangar-ship-value" />
          </div>
          <button class="btn-post" style="margin-top:0;padding:8px;margin-bottom:16px" onclick="addShipToHangar()">ADD TO HANGAR</button>
          <div style="border-top:1px solid var(--border);margin-bottom:12px"></div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);letter-spacing:1px;margin-bottom:8px">IMPORT (REPLACES CURRENT HANGAR)</div>
          <div style="margin-bottom:8px">
            <label style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);display:block;margin-bottom:4px">CSV FILE</label>
            <input type="file" accept=".csv" onchange="importHangarCSV(this)" style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text);width:100%" />
          </div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);line-height:1.6">
            To import from hangar.link: visit your profile, click <span style="color:var(--text)">Export → CSV</span>, then upload the file above.
          </div>
        </div>` : ''}
        ${hangar.length > 0
          ? `<div id="hangar-ship-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">
              ${hangar.map(s => `
                <div id="ship-card-${s.id}" style="position:relative;border:1px solid var(--border);background:var(--bg);padding:6px;text-align:center;font-family:'Share Tech Mono',monospace">
                  <div id="ship-thumb-${s.id}" style="width:100%;height:60px;display:flex;align-items:center;justify-content:center;margin-bottom:4px">
                    <div style="font-size:24px;color:var(--border-bright)">◈</div>
                  </div>
                  <div style="font-size:9px;color:var(--text);line-height:1.3;word-break:break-word">${esc(s.ship_name)}</div>
                  <div style="font-size:8px;color:var(--text-dim)">${esc(s.manufacturer || '')}</div>
                  ${isOwnProfile ? `<button onclick="removeShipFromHangar(${jsStr(s.id)})" style="position:absolute;top:2px;right:2px;background:none;border:none;color:var(--danger);cursor:pointer;font-size:10px;padding:0 2px;line-height:1">✕</button>` : ''}
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
        ${listings.map(l => {
  const btns = isOwnProfile
    ? `<div style="display:flex;gap:8px;margin-top:8px">
        <button onclick="bumpListing(${jsStr(l.id)})" style="background:none;border:1px solid var(--accent);color:var(--accent);font-family:'Share Tech Mono',monospace;font-size:9px;padding:3px 10px;cursor:pointer;letter-spacing:1px">↑ BUMP</button>
        <button onclick="deleteListing(${jsStr(l.id)})" style="background:none;border:1px solid var(--danger);color:var(--danger);font-family:'Share Tech Mono',monospace;font-size:9px;padding:3px 10px;cursor:pointer;letter-spacing:1px">✕ DELETE</button>
       </div>`
    : ''
  return `<div style="padding:10px 12px;border:1px solid var(--border);background:var(--bg);font-family:'Share Tech Mono',monospace;font-size:10px">
    <div style="color:var(--text-bright);margin-bottom:4px">${esc(l.ship || l.org_name || 'LISTING').toUpperCase()}</div>
    <div style="color:var(--text-dim);margin-bottom:4px">${esc(l.mission ? l.mission.toUpperCase() : '')} · ${esc(l.playstyle || '')}</div>
    ${btns}
  </div>`
}).join('')}

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
        <button class="btn-post" style="margin-top:0;padding:8px" onclick="submitRating(${jsStr(profile.id)})">SUBMIT RATING</button>
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
              ${r.comment ? `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text);font-style:italic">"${esc(r.comment)}"</div>` : ''}
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Danger zone — own profile only -->
      ${isOwnProfile ? `
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border)">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--danger);text-transform:uppercase;margin-bottom:10px">// Danger Zone</div>
        <button onclick="deleteAccount()" style="width:100%;padding:10px;background:transparent;border:1px solid var(--danger);color:var(--danger);font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all 0.15s"
          onmouseover="this.style.background='rgba(232,79,79,0.1)'" onmouseout="this.style.background='transparent'">
          DELETE ACCOUNT
        </button>
        <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);letter-spacing:0.5px;margin-top:6px;text-align:center">
          Permanently removes your profile, listings and hangar
        </div>
      </div>` : ''}
    `

    // Init hangar ship search and load thumbnails if own profile
    if (isOwnProfile) {
      initHangarSearch()
    }
    // Load thumbnails async for all hangar ships
    if (hangar.length > 0) {
      hangar.forEach(async s => {
        const thumb = await fetchShipThumbnail(s.ship_name)
        const el = document.getElementById(`ship-thumb-${s.id}`)
        if (el && thumb) {
          el.innerHTML = `<img src="${esc(thumb)}" style="max-width:100%;max-height:60px;object-fit:contain;opacity:0.85" />`
        }
      })
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

// ── Ship thumbnail cache ───────────────────────────────────────────────────────
const shipThumbCache = new Map()

// RSI Ship Matrix — fetched once, maps lowercase name → image URL
let _rsiMatrix = null
async function getRsiMatrix() {
  if (_rsiMatrix) return _rsiMatrix
  try {
    const res = await fetch('https://robertsspaceindustries.com/ship-matrix/index')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const map = new Map()
    for (const ship of json.data || []) {
      const media = ship.media || []
      // Prefer store_frontpage → store_hub → first available image
      const img = media.find(m => m.type?.name === 'store_frontpage')
               || media.find(m => m.type?.name === 'store_hub')
               || media[0]
      if (ship.name && img?.source_url) {
        map.set(ship.name.toLowerCase(), img.source_url)
      }
    }
    _rsiMatrix = map
  } catch {
    _rsiMatrix = new Map() // CORS blocked or network error — fall through to wiki
  }
  return _rsiMatrix
}

// Look up a ship in the RSI matrix with fuzzy fallback.
// The matrix uses full names like "Drake Buccaneer" / "Crusader Perseus",
// but our cleaned CSV names are often just "Buccaneer" / "Perseus".
function matrixLookup(map, name) {
  const key = name.toLowerCase()
  if (map.has(key)) return map.get(key)
  // Try: matrix entry whose name ends with our key (e.g. "drake buccaneer" ends with "buccaneer")
  for (const [k, v] of map) {
    if (k === key || k.endsWith(' ' + key)) return v
  }
  return null
}

async function fetchShipThumbnail(shipName) {
  if (shipThumbCache.has(shipName)) return shipThumbCache.get(shipName)

  // 1. Check Supabase DB cache first
  try {
    const { data: cached } = await sb
      .from('ship_thumbnails')
      .select('thumbnail_url')
      .eq('ship_name', shipName)
      .maybeSingle()
    if (cached?.thumbnail_url) {
      shipThumbCache.set(shipName, cached.thumbnail_url)
      return cached.thumbnail_url
    }
  } catch { /* table may not exist yet — fall through to fetch */ }

  // 2. Resolve thumbnail URL
  try {
    const searchName = cleanRsiName(shipName)
    // Skip obvious bundles/packages
    if (!searchName || BUNDLE_RE.test(searchName)) {
      shipThumbCache.set(shipName, null)
      return null
    }

    let imageUrl = null

    // 2a. RSI Ship Matrix — authoritative source
    const matrix = await getRsiMatrix()
    imageUrl = matrixLookup(matrix, searchName)

    // 2b. Fandom wiki fallback
    if (!imageUrl) {
      const encoded = encodeURIComponent(searchName)
      const wikiSources = [
        `https://starcitizen.fandom.com/api.php?action=query&titles=${encoded}&prop=pageimages&format=json&pithumbsize=300&origin=*`,
        `https://starcitizen.tools/api.php?action=query&titles=${encoded}&prop=pageimages&format=json&pithumbsize=300&origin=*`,
      ]
      for (const apiUrl of wikiSources) {
        try {
          const res = await fetch(apiUrl)
          const json = await res.json()
          const pages = json?.query?.pages || {}
          const page = Object.values(pages)[0]
          const candidate = page?.thumbnail?.source || null
          if (candidate) {
            // Verify the image is actually reachable before using it
            const probe = await fetch(candidate, { method: 'HEAD' })
            if (probe.ok) { imageUrl = candidate; break }
          }
        } catch { /* try next source */ }
      }
    }

    if (!imageUrl) {
      console.warn(`[crewfind] No thumbnail found for: "${searchName}"`)
      shipThumbCache.set(shipName, null)
      return null
    }

    // 3. Upload to Supabase storage bucket for permanent hosting
    let finalUrl = null
    try {
      const imgRes = await fetch(imageUrl)
      if (imgRes.ok) {
        const blob = await imgRes.blob()
        const fileName = searchName.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.jpg'
        const { error: uploadErr } = await sb.storage
          .from('ship-thumbnails')
          .upload(fileName, blob, { contentType: blob.type || 'image/jpeg', upsert: true })
        if (!uploadErr) {
          const { data: urlData } = sb.storage.from('ship-thumbnails').getPublicUrl(fileName)
          finalUrl = urlData.publicUrl
        } else {
          finalUrl = imageUrl  // storage failed but image is reachable — use source directly
        }
      }
      // if !imgRes.ok, finalUrl stays null — don't cache a broken URL
    } catch { finalUrl = null }

    // 4. Persist to DB cache
    try {
      await sb.from('ship_thumbnails').upsert(
        { ship_name: shipName, thumbnail_url: finalUrl, cached_at: new Date().toISOString() },
        { onConflict: 'ship_name' }
      )
    } catch { /* cache write failure is non-fatal */ }

    console.log(`[crewfind] Thumbnail cached for "${shipName}":`, finalUrl)
    shipThumbCache.set(shipName, finalUrl)
    return finalUrl
  } catch (e) {
    console.error(`[crewfind] fetchShipThumbnail error for "${shipName}":`, e)
    shipThumbCache.set(shipName, null)
    return null
  }
}

// ── Strip RSI pledge-store noise from ship names ──────────────────────────────
// RSI account CSV exports use pledge item names like:
//   "Standalone Ships - Paladin - 10 Year"
//   "Standalone Ships - Buccaneer plus Nighttide Paint"
// This strips prefixes/suffixes to get the bare ship name.
function cleanRsiName(name) {
  let s = name.trim()
  s = s.replace(/^Standalone\s+Ships?\s*[-–]\s*/i, '')       // strip "Standalone Ships - "
  s = s.replace(/^Complete\s+Ships?\s*[-–]\s*/i, '')         // strip "Complete Ship - "
  s = s.replace(/^Original\s+concept\s*[-–]\s*/i, '')        // strip "Original concept - "
  s = s.replace(/\s+plus\s+.+$/i, '')                        // strip " plus Paint/Item"
  s = s.replace(/\s*[-–]\s*\d+\s*[Yy]ear\s*$/i, '')         // strip " - 10 Year"
  s = s.replace(/\s*[-–]?\s*Best\s+In\s+Show\s+\d{4}.*$/i, '')  // strip "Best In Show 2955 Edition"
  s = s.replace(/\s*[-–]\s*(Anniversary|Invictus\s*\d*|Showdown|Deluxe|Limited|Edition)\s*$/i, '')
  s = s.replace(/\s*\(.*?\)\s*$/, '')                        // strip trailing " (anything)"
  return s.trim()
}

// Keywords that identify RSI bundles/packages that are not a single ship
const BUNDLE_RE = /\b(package|bundle|starter\s+pack|pledge\s+pack|upgrade\s+token|upgrade\s+kit|gift|item\s+set|completion|add[- ]?on|combo|edition)\b/i

// ── Parse hangar CSV — ships and vehicles only ────────────────────────────────
const KNOWN_SHIP_NAMES = new Set(SHIPS.map(s => s.name.toLowerCase()))

function parseHangarCsv(text) {
  const lines = text.trim().split('\n')
  const header = lines[0].toLowerCase().replace(/\r/, '').split(',')
  const nameIdx = header.findIndex(h => h === 'name' || h.includes('ship_name') || h.includes('ship name'))
    ?? header.findIndex(h => h.includes('name'))
  const mfgIdx = header.findIndex(h => h.includes('manufacturer') || h.includes('mfg'))
  const typeIdx = header.findIndex(h => h === 'type' || h === 'category' || h === 'item type' || h === 'item_type')
  if (nameIdx === -1) return null

  const ships = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].replace(/\r/, '').split(',')
    const name = cols[nameIdx]?.trim()
    if (!name) continue

    // Clean RSI pledge-store prefixes/suffixes before matching
    const cleanName = cleanRsiName(name)

    // Always reject if the cleaned name looks like a bundle/package, regardless of type column
    if (!cleanName || BUNDLE_RE.test(cleanName)) continue

    // If a type column exists, only accept rows classified as ship or vehicle
    if (typeIdx !== -1) {
      const type = cols[typeIdx]?.trim().toLowerCase() || ''
      if (!type.includes('ship') && !type.includes('vehicle')) continue
    } else {
      // No type column — match cleaned name against known ships list
      if (!KNOWN_SHIP_NAMES.has(cleanName.toLowerCase())) continue
    }

    const manufacturer = mfgIdx !== -1 ? cols[mfgIdx]?.trim() : ''
    // Store the clean name, not the raw RSI pledge string
    ships.push({ name: cleanName, manufacturer: manufacturer || '' })
  }
  return ships
}

// ── Import hangar from CSV file ───────────────────────────────────────────────
export async function importHangarCSV(input) {
  const currentUser = getCurrentUser()
  if (!currentUser) { showToast('// LOGIN REQUIRED'); return }
  const file = input.files[0]
  if (!file) return
  const text = await file.text()
  const ships = parseHangarCsv(text)
  if (!ships || ships.length === 0) { showToast('// ERROR: Could not parse CSV'); return }
  await replaceHangar(currentUser.id, ships)
}
window.importHangarCSV = importHangarCSV

// ── Replace entire hangar in Supabase ─────────────────────────────────────────
async function replaceHangar(userId, ships) {
  try {
    const { error: delError } = await sb.from('hangars').delete().eq('user_id', userId)
    if (delError) throw delError
    const rows = ships.map(s => ({ user_id: userId, ship_name: s.name, manufacturer: s.manufacturer }))
    const { error: insError } = await sb.from('hangars').insert(rows)
    if (insError) throw insError
    showToast(`// HANGAR UPDATED — ${ships.length} SHIPS IMPORTED`)
    if (currentProfileHandle) openProfile(currentProfileHandle)
  } catch (e) {
    console.error('replaceHangar error:', e)
    showToast('// ERROR: Hangar import failed')
  }
}

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
  const filtered = SHIPS.filter(s => s.name.toLowerCase().includes(q) || s.manufacturer.toLowerCase().includes(q)).slice(0, 50)
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
window.startConversation = startConversation