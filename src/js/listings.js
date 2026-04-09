import { sb } from './supabase.js'
import { showToast, missionLabel, expiryLabel, isExpiringSoon, openExternalUrl } from './ui.js'
import { getCurrentHandle, getCurrentUser } from './auth.js'

export let listings = []
export let myPosts = []
let activeFilter = 'all'
let searchQuery = ''
let playerStatuses = {}
let avatarCache = {}
let myStatus = 'offline'
let applyTarget = null
let appliedIds = new Set(JSON.parse(localStorage.getItem('appliedIds') || '[]'))

function saveAppliedIds() {
  localStorage.setItem('appliedIds', JSON.stringify([...appliedIds]))
}

// ── Filters / Search ──────────────────────────────────────────────────────────
export function filterBy(type, btn) {
  activeFilter = type
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'))
  if (btn) btn.classList.add('active')
  clearSearch()
  renderListings()
}

export function onSearchInput(val) {
  searchQuery = val.trim().toLowerCase()
  document.getElementById('search-clear-btn')?.classList.toggle('visible', searchQuery.length > 0)
  applySearchFilter()
}

export function clearSearch() {
  const el = document.getElementById('listing-search')
  if (el) el.value = ''
  searchQuery = ''
  document.getElementById('search-clear-btn')?.classList.remove('visible')
  applySearchFilter()
}

function applySearchFilter() {
  const grid = document.getElementById('listings-grid')
  const empty = document.getElementById('empty-state')
  if (!searchQuery) {
    if (grid) grid.innerHTML = listings.map(l => renderCard(l, false)).join('')
    if (empty) empty.style.display = listings.length === 0 ? 'block' : 'none'
    return
  }
  const filtered = listings.filter(l => {
    const q = searchQuery
    return (l.ship || '').toLowerCase().includes(q) ||
           (l.owner || '').toLowerCase().includes(q) ||
           (l.org || '').toLowerCase().includes(q) ||
           (l.org_name || '').toLowerCase().includes(q) ||
           (l.solo_note || '').toLowerCase().includes(q)
  })
  if (grid) grid.innerHTML = filtered.length ? filtered.map(l => renderCard(l, false)).join('') : ''
  if (empty) {
    empty.style.display = filtered.length === 0 ? 'block' : 'none'
    empty.textContent = '[ NO RESULTS — TRY A DIFFERENT SEARCH ]'
  }
}

// ── Status ────────────────────────────────────────────────────────────────────
async function loadPlayerStatuses(handles) {
  if (!handles?.length) return
  try {
    const { data } = await sb.from('players').select('handle, status').in('handle', handles)
    if (data) data.forEach(p => { playerStatuses[p.handle.toUpperCase()] = p.status })
  } catch (e) { console.error('Status load error:', e) }
  // Load avatars for all listing owners in the same pass
  try {
    const { data } = await sb.from('profiles').select('rsi_handle, avatar_url').in('rsi_handle', handles)
    if (data) data.forEach(p => { if (p.avatar_url) avatarCache[p.rsi_handle.toUpperCase()] = p.avatar_url })
  } catch (e) { console.error('Avatar load error:', e) }
}

async function loadMyStatus() {
  const currentHandle = getCurrentHandle()
  if (!currentHandle) return
  try {
    const { data } = await sb.from('players').select('status').eq('handle', currentHandle).single()
    myStatus = data?.status || 'offline'
  } catch (e) { myStatus = 'offline' }
  updateStatusToggleUI()
}

function updateStatusToggleUI() {
  const toggle = document.getElementById('status-toggle')
  const label = document.getElementById('status-toggle-label')
  if (!toggle || !label) return
  if (myStatus === 'in-verse') {
    toggle.classList.add('in-verse')
    label.textContent = 'IN VERSE — TAP TO GO OFFLINE'
  } else {
    toggle.classList.remove('in-verse')
    label.textContent = 'OFFLINE — TAP TO SET IN VERSE'
  }
}

export async function toggleInVerseStatus() {
  const currentHandle = getCurrentHandle()
  if (!currentHandle) { showToast('// LOGIN REQUIRED'); return }
  const newStatus = myStatus === 'in-verse' ? 'offline' : 'in-verse'
  try {
    await sb.from('players').upsert({ handle: currentHandle, status: newStatus, updated_at: new Date().toISOString() }, { onConflict: 'handle' })
    myStatus = newStatus
    playerStatuses[currentHandle.toUpperCase()] = newStatus
    updateStatusToggleUI()
    const grid = document.getElementById('listings-grid')
    if (grid && listings.length > 0) grid.innerHTML = listings.map(l => renderCard(l, false)).join('')
    renderMyPosts()
    showToast(newStatus === 'in-verse' ? '// STATUS: IN VERSE' : '// STATUS: OFFLINE')
  } catch (e) { showToast('// ERROR: Could not update status') }
}

export function changeHandle() {
  if (confirm('Sign out?')) {
    import('./auth.js').then(m => m.signOut())
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function missionColor(m) {
  const map = { bounty:'bounty', cargo:'cargo', patrol:'patrol', explore:'explore', mining:'mining', salvage:'salvage', medical:'medical', piracy:'piracy', escort:'escort', ground:'ground' }
  return map[m] || 'patrol'
}

function groupRoles(roles) {
  const counts = {}
  roles.forEach(r => { counts[r] = (counts[r] || 0) + 1 })
  return Object.entries(counts).map(([role, count]) => count > 1 ? `${role} ×${count}` : role)
}

function timezoneLabel(tz) {
  const map = { 'NA-W':'NA West','NA-E':'NA East','EU-W':'EU West','EU-E':'EU East','AUS':'Australia/NZ','ASIA':'Asia','Any':'Any TZ' }
  return map[tz] || tz || ''
}

function expiryCountdown(expires_at) {
  if (!expires_at) return ''
  const diff = new Date(expires_at) - new Date()
  if (diff <= 0) return 'EXPIRED'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 24) return `expires in ${Math.floor(h/24)}d ${h%24}h`
  if (h > 0) return `expires in ${h}h ${m}m`
  return `expires in ${m}m`
}

function expiryClass(expires_at) {
  if (!expires_at) return ''
  return (new Date(expires_at) - new Date()) < 6 * 3600000 ? 'expiry-soon' : 'expiry-ok'
}

// ── Avatar helper ─────────────────────────────────────────────────────────────
function avatarHtml(handle, style = '') {
  const url = avatarCache[handle?.toUpperCase()]
  const initials = (handle || '??').slice(0, 2).toUpperCase()
  if (url) {
    return `<img src="${url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid var(--border-bright);flex-shrink:0;${style}" onerror="this.outerHTML='<div class=\'owner-avatar\' style=\'${style}\'>${initials}</div>'" />`
  }
  return `<div class="owner-avatar" style="${style}">${initials}</div>`
}

// ── Card render ───────────────────────────────────────────────────────────────
function renderCard(l, isMine) {
  const applied = l.applied
  const currentHandle = getCurrentHandle()
  isMine = isMine || (currentHandle && l.owner && l.owner.toUpperCase() === currentHandle.toUpperCase())
  const isOrg = l.post_type === 'org'
  const isSoloLfg = l.post_type === 'lfg'
  const isSoloLfm = l.post_type === 'lfm'
  const isSolo = isSoloLfg || isSoloLfm
  const statusClass = playerStatuses[l.owner?.toUpperCase()] === 'in-verse' ? 'in-verse' : ''

  if (isOrg) return `
    <div class="card org-recruit" style="animation-delay:${Math.random()*0.2}s">
      ${l.org_poster_url ? `<img class="org-poster-img" src="${l.org_poster_url}" alt="Org poster" onerror="this.style.display='none'" />` : ''}
      <div class="org-card-body">
        <div class="card-header" style="margin-bottom:10px">
          <div>
            <div class="ship-name" style="color:var(--accent2)">${(l.org_name||l.org||l.owner).toUpperCase()}</div>
            ${l.org ? `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);letter-spacing:1px;margin-top:2px">[${l.org}]</div>` : ''}
          </div>
          <span class="org-badge">🏴 ORG RECRUITING</span>
        </div>
        <div class="card-owner" style="margin-bottom:10px;padding-bottom:10px">
          <div class="owner-avatar" style="border-color:rgba(232,168,79,0.4);background:rgba(232,168,79,0.1);color:var(--accent2)">${avatarCache[l.owner?.toUpperCase()] ? `<img src="${avatarCache[l.owner.toUpperCase()]}" style="width:28px;height:28px;border-radius:50%;object-fit:cover" />` : l.owner.slice(0,2)}</div>
          <div class="owner-info">
            <div class="owner-handle"><span class="card-status-dot ${statusClass}"></span>${l.owner}</div>
            <div class="owner-meta">${timezoneLabel(l.timezone||'')} · ${l.playstyle||''}</div>
          </div>
        </div>
        ${l.solo_note ? `<div class="org-pitch">${l.solo_note}</div>` : ''}
        ${l.org_roles ? `<div style="margin-bottom:12px"><span style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);letter-spacing:1px;text-transform:uppercase">RECRUITING: </span><span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--accent2)">${l.org_roles}</span></div>` : ''}
        <div class="card-footer">
          <div class="card-meta ${expiryClass(l.expires_at)}">${expiryCountdown(l.expires_at)}</div>
          ${isMine
            ? `<div style="display:flex;gap:6px">
                <button class="btn-apply" style="border-color:var(--accent);color:var(--accent)" onclick="bumpListing('${l.id}')"><span>BUMP</span></button>
                <button class="btn-apply" style="border-color:var(--danger);color:var(--danger)" onclick="deleteListing('${l.id}')"><span>DELETE</span></button>
               </div>`
            : `<button class="btn-apply ${applied?'applied':''}" style="border-color:var(--accent2);color:var(--accent2)" onclick="openApply('${l.id}')"><span>${applied?'✓ CONTACTED':'CONTACT ORG'}</span></button>`
          }
        </div>
      </div>
    </div>`

  if (isSolo) {
    const soloClass = isSoloLfg ? 'solo-lfg' : 'solo-lfm'
    const badgeClass = isSoloLfg ? 'lfg' : 'lfm'
    const badgeText = isSoloLfg ? '🔍 LFG — Looking for Crew' : '👥 LFM — Solo Teamup'
    return `
    <div class="card ${soloClass}" style="animation-delay:${Math.random()*0.2}s">
      <div class="card-header">
        <div class="ship-name">${(l.ship||'No Ship Listed').toUpperCase()}</div>
        <span class="solo-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="card-owner">
        <div class="owner-avatar" style="border-color:${isSoloLfg?'rgba(79,232,168,0.4)':'rgba(176,143,232,0.4)'};background:${isSoloLfg?'rgba(79,232,168,0.1)':'rgba(176,143,232,0.1)'};color:${isSoloLfg?'var(--success)':'#b08fe8'};overflow:hidden">${avatarCache[l.owner?.toUpperCase()] ? `<img src="${avatarCache[l.owner.toUpperCase()]}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />` : l.owner.slice(0,2)}</div>
        <div class="owner-info">
          <div class="owner-handle"><span class="card-status-dot ${statusClass}"></span><span onclick="openProfile('${l.owner}')" style="cursor:pointer;text-decoration:underline;text-underline-offset:3px">${l.owner}</span>${l.org?` <span style="font-size:9px;color:var(--accent2);letter-spacing:1px;border:1px solid rgba(232,168,79,0.3);padding:1px 5px;margin-left:4px">${l.org}</span>`:''}</div>
          <div class="owner-meta">${timezoneLabel(l.timezone||'')} · ${l.playstyle||''}</div>
        </div>
      </div>
      <div class="mission-type ${missionColor(l.mission)}" style="margin-bottom:12px;display:inline-block">${missionLabel(l.mission)}</div>
      ${l.solo_note ? `<div class="solo-note">"${l.solo_note}"</div>` : ''}
      <div class="card-footer">
        <div class="card-meta ${expiryClass(l.expires_at)}">${expiryCountdown(l.expires_at)}</div>
        ${isMine
          ? `<div style="display:flex;gap:6px">
              <button class="btn-apply" style="border-color:var(--accent);color:var(--accent)" onclick="bumpListing('${l.id}')"><span>BUMP</span></button>
              <button class="btn-apply" style="border-color:var(--danger);color:var(--danger)" onclick="deleteListing('${l.id}')"><span>DELETE</span></button>
             </div>`
          : `<button class="btn-apply ${applied?'applied':''}" style="${isSoloLfg?'border-color:var(--success);color:var(--success)':'border-color:#b08fe8;color:#b08fe8'}" onclick="openApply('${l.id}')"><span>${applied?'✓ CONTACTED':'CONTACT'}</span></button>`
        }
      </div>
    </div>`
  }

  const groupedRoles = groupRoles(l.roles)
  return `
  <div class="card" style="animation-delay:${Math.random()*0.2}s">
    <div class="card-header">
      <div class="ship-name">${l.ship.toUpperCase()}</div>
      <div class="mission-type ${missionColor(l.mission)}">${missionLabel(l.mission)}</div>
    </div>
    <div class="card-owner">
      <div class="owner-avatar" style="overflow:hidden">${avatarCache[l.owner?.toUpperCase()] ? `<img src="${avatarCache[l.owner.toUpperCase()]}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />` : l.owner.slice(0,2)}</div>
      <div class="owner-info">
        <div class="owner-handle"><span class="card-status-dot ${statusClass}"></span>${l.owner}${l.org?` <span style="font-size:9px;color:var(--accent2);letter-spacing:1px;border:1px solid rgba(232,168,79,0.3);padding:1px 5px;margin-left:4px">${l.org}</span>`:''}</div>
        <div class="owner-meta">${timezoneLabel(l.timezone||l.tz||'')} · ${l.playstyle||l.style||''}</div>
      </div>
    </div>
    <div class="card-roles">
      <span style="font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;color:var(--text-dim);text-transform:uppercase;line-height:26px;margin-right:4px">NEEDS:</span>
      ${groupedRoles.map(r => `<span class="role-tag needed">${r}</span>`).join('')}
    </div>
    <div class="card-footer">
      <div class="card-meta ${expiryClass(l.expires_at)}">
        ${l.roles.length} slot${l.roles.length>1?'s':''} open${l.expires_at?' · '+expiryCountdown(l.expires_at):''}
      </div>
      ${isMine
        ? `<div style="display:flex;gap:6px">
            <button class="btn-apply" style="border-color:var(--accent);color:var(--accent)" onclick="bumpListing('${l.id}')"><span>BUMP</span></button>
            <button class="btn-apply" style="border-color:var(--danger);color:var(--danger)" onclick="deleteListing('${l.id}')"><span>DELETE</span></button>
           </div>`
        : `<div style="display:flex;gap:6px">
            <button class="btn-apply ${applied?'applied':''}" onclick="openApply('${l.id}')"><span>${applied?'✓ APPLIED':'APPLY'}</span></button>
            <button class="btn-apply" onclick="startConversation('${l.owner}')" style="border-color:var(--text-dim);color:var(--text-dim)" title="Message pilot"><span>MSG</span></button>
           </div>`
      }
    </div>
  </div>`
}

// ── Render ────────────────────────────────────────────────────────────────────
export async function renderListings() {
  const grid = document.getElementById('listings-grid')
  const empty = document.getElementById('empty-state')
  if (!grid) return
  grid.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#5a7a9a;letter-spacing:1px">[ LOADING... ]</div>'
  try {
    let query = sb.from('listings').select('*').order('created_at', { ascending: false })
    if (activeFilter === 'solo') query = query.in('post_type', ['lfg','lfm'])
    else if (activeFilter === 'org') query = query.eq('post_type', 'org')
    else if (activeFilter !== 'all') query = query.eq('mission', activeFilter).is('post_type', null)
    const { data, error } = await query
    if (error) throw error
    listings.length = 0
    const now = new Date()
    ;(data || []).filter(l => !l.expires_at || new Date(l.expires_at) > now).forEach(l => listings.push({
      ...l,
      roles: typeof l.roles === 'string' ? l.roles.split(',') : (l.roles || []),
      applied: appliedIds.has(l.id)
    }))
    const handles = [...new Set(listings.map(l => l.owner).filter(Boolean))]
    await loadPlayerStatuses(handles)
  } catch (e) {
    console.error('Load error:', e)
    grid.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#e84f4f;letter-spacing:1px">[ CONNECTION ERROR — RETRY ]</div>'
    return
  }
  if (listings.length === 0) {
    grid.innerHTML = ''
    if (empty) empty.style.display = 'block'
  } else {
    if (empty) empty.style.display = 'none'
    grid.innerHTML = listings.map(l => renderCard(l, false)).join('')
  }
  const countEl = document.getElementById('listing-count')
  if (countEl) countEl.textContent = listings.length
}

export async function renderMyPosts() {
  const grid = document.getElementById('my-listings-grid')
  const empty = document.getElementById('my-empty-state')
  const count = document.getElementById('my-post-count')
  if (!grid) return
  grid.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#5a7a9a;letter-spacing:1px">[ LOADING... ]</div>'
  const currentHandle = getCurrentHandle()
  if (!currentHandle) {
    grid.innerHTML = ''
    if (empty) empty.style.display = 'block'
    if (count) count.textContent = '0'
    return
  }
  try {
    const { data, error } = await sb.from('listings').select('*').ilike('owner', currentHandle).order('created_at', { ascending: false })
    if (error) throw error
    const now = new Date()
    myPosts = (data || [])
      .filter(l => (!l.expires_at || new Date(l.expires_at) > now) && l.owner?.toUpperCase() === currentHandle.toUpperCase())
      .map(l => ({ ...l, roles: typeof l.roles === 'string' ? l.roles.split(',') : (l.roles || []) }))
  } catch (e) {
    console.error('My posts error:', e)
    myPosts = []
  }
  if (count) count.textContent = myPosts.length
  if (myPosts.length === 0) {
    grid.innerHTML = ''
    if (empty) empty.style.display = 'block'
  } else {
    if (empty) empty.style.display = 'none'
    grid.innerHTML = myPosts.map(l => renderCard(l, true)).join('')
  }
  loadMyStatus()
}

export function initListings() {
  // Tab click handlers
  const browseBtn = document.getElementById('tab-btn-browse')
  const myPostsBtn = document.getElementById('tab-btn-my-posts')
  if (browseBtn) browseBtn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
    browseBtn.classList.add('active')
    document.getElementById('tab-browse').style.display = ''
    document.getElementById('tab-my-posts').style.display = 'none'
  })
  if (myPostsBtn) myPostsBtn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
    myPostsBtn.classList.add('active')
    document.getElementById('tab-browse').style.display = 'none'
    document.getElementById('tab-my-posts').style.display = ''
    renderMyPosts()
  })
}

// ── Actions ───────────────────────────────────────────────────────────────────
export async function bumpListing(id) {
  try {
    const newExpiry = new Date(Date.now() + 48*60*60*1000).toISOString()
    const { error } = await sb.from('listings').update({ expires_at: newExpiry }).eq('id', id)
    if (error) throw error
    const l = listings.find(x => String(x.id) === String(id))
    if (l) l.expires_at = newExpiry
    const m = myPosts.find(x => String(x.id) === String(id))
    if (m) m.expires_at = newExpiry
    const grid = document.getElementById('listings-grid')
    if (grid) grid.innerHTML = listings.map(l => renderCard(l, false)).join('')
    renderMyPosts()
    showToast('// LISTING REFRESHED — 48H RESET')
  } catch (e) { showToast('// ERROR: Could not bump listing') }
}

export async function deleteListing(id) {
  if (!confirm('Delete this listing?')) return
  try {
    const { error } = await sb.from('listings').delete().eq('id', id)
    if (error) throw error
    listings.splice(listings.findIndex(x => String(x.id) === String(id)), 1)
    await renderListings()
    renderMyPosts()
    showToast('// LISTING REMOVED')
  } catch (e) { showToast('// ERROR: Could not delete listing') }
}

// ── Apply modal ───────────────────────────────────────────────────────────────
export function openApply(id) {
  const l = listings.find(x => String(x.id) === String(id))
  if (!l) return
  applyTarget = id
  const contactHandle = l.discord || l.owner_discord || l.owner
  const savedDiscord = localStorage.getItem('discord_username') || ''
  const discordBtn = contactHandle && contactHandle !== 'N/A'
    ? `<button id="discord-copy-btn" onclick="copyDiscord('${contactHandle}')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #5865F2;color:#5865F2;background:transparent;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:1px;cursor:pointer;margin-bottom:8px;width:100%">
        <svg width="14" height="14" viewBox="0 0 71 55" fill="none"><path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.9a.2.2 0 0 0-.2.1 40.8 40.8 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0 37.4 37.4 0 0 0-1.8-3.7.2.2 0 0 0-.2-.1A58.3 58.3 0 0 0 10.8 4.9a.2.2 0 0 0-.1.1C1.6 18.1-.9 31 .3 43.7a.2.2 0 0 0 .1.2 58.8 58.8 0 0 0 17.7 8.9.2.2 0 0 0 .2-.1 42 42 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.7 38.7 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.8a.2.2 0 0 1 .2 0c11.5 5.3 24 5.3 35.4 0a.2.2 0 0 1 .2 0l1.1.8a.2.2 0 0 1 0 .4 36.1 36.1 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.1 47.1 0 0 0 3.6 5.9.2.2 0 0 0 .2.1 58.6 58.6 0 0 0 17.8-8.9.2.2 0 0 0 .1-.2c1.4-14.8-2.4-27.6-10.4-39a.2.2 0 0 0-.1 0ZM23.7 36.2c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2c3.6 0 6.5 3.3 6.4 7.2 0 4-2.8 7.2-6.4 7.2Z" fill="#5865F2"/></svg>
        COPY DISCORD TAG — @${contactHandle}
       </button>` : ''

  const modal = document.getElementById('apply-modal')
  const title = document.getElementById('apply-modal-title')
  const body = document.getElementById('apply-modal-body')
  if (!modal || !title || !body) return

  if (l.post_type === 'org') {
    title.textContent = `// Contact — ${(l.org_name||l.owner).toUpperCase()}`
    body.innerHTML = `
      <div style="margin-bottom:18px;padding:14px;border:1px solid var(--border);background:var(--bg)">
        <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);margin-bottom:10px">CONTACT THE ORG RECRUITER:</div>
        ${discordBtn}
        <a href="javascript:void(0)" onclick="openExternalUrl('https://discord.gg/AzW5aVNXky')" style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);letter-spacing:1px;">or join the CrewFind Discord →</a>
      </div>
      <button class="btn-post" id="btn-transmit" data-id="${id}" onclick="submitApply('${id}')">MARK AS CONTACTED</button>`
  } else {
    const uniqueRoles = [...new Set(l.roles)]
    title.textContent = `// Apply — ${l.ship?.toUpperCase()}`
    body.innerHTML = `
      <div style="margin-bottom:18px;padding:14px;border:1px solid var(--border);background:var(--bg)">
        <div style="display:flex;gap:16px;margin-bottom:10px">
          <div class="hud-stat">SHIP: <b>${l.ship}</b></div>
          <div class="hud-stat">MISSION: <b>${missionLabel(l.mission)}</b></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${groupRoles(l.roles).map(r=>`<span class="role-tag needed">${r}</span>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Your Role</label>
        <select class="form-select" id="apply-role">
          ${uniqueRoles.map(r=>`<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Your Discord</label>
        <div class="discord-row">
          <span class="discord-prefix">@</span>
          <input class="form-input" id="apply-discord" placeholder="your_handle" style="border-left:none" value="${savedDiscord}"/>
        </div>
      </div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);letter-spacing:1px;margin-bottom:14px;padding:10px 12px;border:1px solid var(--border);background:var(--bg)">
        <div style="margin-bottom:10px">CONTACT: <span style="color:var(--accent)">@${contactHandle}</span></div>
        ${discordBtn}
        <a href="javascript:void(0)" onclick="openExternalUrl('https://discord.gg/AzW5aVNXky')" style="display:inline-block;padding:6px 12px;border:1px solid var(--accent);color:var(--accent);text-decoration:none;letter-spacing:1px;">JOIN CREWFIND DISCORD</a>
      </div>
      <button class="btn-post" id="btn-transmit" data-id="${id}" onclick="submitApply('${id}')">TRANSMIT APPLICATION</button>`
  }
  modal.classList.add('open')
  document.body.style.overflow = 'hidden'
}

export function closeApplyModal() {
  document.getElementById('apply-modal')?.classList.remove('open')
  document.body.style.overflow = ''
  applyTarget = null
}

export async function submitApply(id) {
  const l = listings.find(x => String(x.id) === String(id))
  if (!l) return
  const role = document.getElementById('apply-role')?.value || 'Crew'
  const applicant_discord = document.getElementById('apply-discord')?.value?.trim() || ''
  const btn = document.getElementById('btn-transmit')
  if (btn) { btn.textContent = 'TRANSMITTING...'; btn.disabled = true }
  const currentHandle = getCurrentHandle()
  try {
    await fetch('https://sfozlgthgvphkntxbhgn.supabase.co/functions/v1/notify-discord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmb3psZ3RoZ3ZwaGtudHhiaGduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MDA5MzAsImV4cCI6MjA4OTQ3NjkzMH0.aPPT8O29hEQKw3uf29FWSyyBJxv1GT7_YtF83dRx2n4'
      },
      body: JSON.stringify({ listing: l, applicant: currentHandle || 'Unknown', role, applicant_discord: applicant_discord || 'Not provided' })
    })
  } catch (e) { console.error('Discord notify error:', e) }
  appliedIds.add(id)
  saveAppliedIds()
  closeApplyModal()
  await renderListings()
  showToast('// APPLICATION TRANSMITTED')
}

function copyDiscord(handle) {
  const text = handle.startsWith('@') ? handle : '@' + handle
  navigator.clipboard.writeText(text).then(() => {
    showToast('// DISCORD TAG COPIED TO CLIPBOARD')
  }).catch(() => { showToast('// ' + text + ' — COPY MANUALLY') })
}
window.copyDiscord = copyDiscord
