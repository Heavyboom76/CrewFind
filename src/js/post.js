import { sb } from './supabase.js'
import { showToast } from './ui.js'
import { currentHandle, currentUser } from './auth.js'
import { renderListings } from './listings.js'

let currentPostType = 'crew'

export function setPostType(type) {
  currentPostType = type
  document.querySelectorAll('.post-type-btn').forEach(b => b.classList.remove('active'))
  document.getElementById('ptype-' + type)?.classList.add('active')
  const isSolo = type === 'lfg' || type === 'lfm'
  const isOrg = type === 'org'
  const crewFields = document.getElementById('crew-fields')
  const soloFields = document.getElementById('solo-fields')
  const orgFields = document.getElementById('org-fields')
  if (crewFields) crewFields.style.display = (!isSolo && !isOrg) ? '' : 'none'
  if (soloFields) soloFields.style.display = isSolo ? '' : 'none'
  if (orgFields) orgFields.style.display = isOrg ? '' : 'none'
  const titles = { crew: '// New Crew Listing', lfg: '// Looking For Crew', lfm: '// Solo Players LFM', org: '// Org Recruitment Post' }
  const btns = { crew: 'BROADCAST LISTING', lfg: 'BROADCAST LFG POST', lfm: 'BROADCAST LFM POST', org: 'BROADCAST ORG RECRUITMENT' }
  const titleEl = document.getElementById('post-modal-title')
  const btnEl = document.getElementById('btn-submit-post')
  if (titleEl) titleEl.textContent = titles[type]
  if (btnEl) btnEl.textContent = btns[type]
  if (isSolo) {
    const noteEl = document.getElementById('f-solo-note')
    if (noteEl) noteEl.placeholder = type === 'lfg'
      ? 'e.g. Looking to join a mining fleet, own Prospector'
      : 'e.g. Forming a wing of fighters for bounty — 3 solos needed'
  }
}

export function openPostModal() {
  const discordField = document.getElementById('f-discord')
  const savedDiscord = localStorage.getItem('discord_username') || ''
  if (discordField && savedDiscord && !discordField.value) discordField.value = savedDiscord
  document.getElementById('post-modal')?.classList.add('open')
  document.body.style.overflow = 'hidden'
}

export function closePostModal() {
  document.getElementById('post-modal')?.classList.remove('open')
  document.body.style.overflow = ''
  setPostType('crew')
  ;['f-org-name','f-org-tag','f-org-pitch','f-org-roles'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  const preview = document.getElementById('img-preview')
  if (preview) preview.style.display = 'none'
  const label = document.getElementById('img-upload-label')
  if (label) label.textContent = '📁 TAP TO UPLOAD ORG POSTER'
}

export function adjustRole(btn, delta) {
  const container = btn.closest('.role-counter')
  const countEl = container?.querySelector('.role-count')
  if (!countEl) return
  let count = Math.max(0, Math.min(8, (parseInt(countEl.textContent) || 0) + delta))
  countEl.textContent = count
  container.classList.toggle('active', count > 0)
}

export function previewOrgPoster(input) {
  const file = input.files[0]
  if (!file) return
  const preview = document.getElementById('img-preview')
  const label = document.getElementById('img-upload-label')
  const reader = new FileReader()
  reader.onload = e => {
    if (preview) { preview.src = e.target.result; preview.style.display = 'block' }
    if (label) label.textContent = '✓ ' + file.name
  }
  reader.readAsDataURL(file)
}

export async function submitPost() {
  const isSolo = currentPostType === 'lfg' || currentPostType === 'lfm'
  const isOrg = currentPostType === 'org'
  const owner = currentHandle || 'PILOT'
  const discordUser = currentUser
    ? (currentUser.user_metadata?.custom_claims?.global_name || currentUser.user_metadata?.full_name || '')
    : (localStorage.getItem('discord_username') || '')
  const btn = document.getElementById('btn-submit-post')

  if (isOrg) {
    const orgName = document.getElementById('f-org-name')?.value?.trim()
    const orgTag = document.getElementById('f-org-tag')?.value?.trim()
    const pitch = document.getElementById('f-org-pitch')?.value?.trim()
    const orgRoles = document.getElementById('f-org-roles')?.value?.trim()
    const system = document.getElementById('f-system')?.value
    const style = document.getElementById('f-style')?.value
    const discord = document.getElementById('f-discord')?.value?.trim() || 'N/A'
    if (!orgName) { showToast('// ERROR: Org name required'); return }
    if (!pitch) { showToast('// ERROR: Recruitment pitch required'); return }
    if (btn) { btn.textContent = 'TRANSMITTING...'; btn.disabled = true }
    try {
      let org_poster_url = null
      const fileInput = document.getElementById('f-org-poster')
      if (fileInput?.files[0]) {
        const file = fileInput.files[0]
        const ext = file.name.split('.').pop()
        const fileName = `${owner}_${Date.now()}.${ext}`
        const { error: uploadError } = await sb.storage.from('org-posters').upload(fileName, file, { contentType: file.type, upsert: true })
        if (!uploadError) {
          const { data: urlData } = sb.storage.from('org-posters').getPublicUrl(fileName)
          org_poster_url = urlData?.publicUrl || null
        }
      }
      const { error } = await sb.from('listings').insert([{
        ship: orgName, mission: 'org', owner, timezone: system, playstyle: style,
        roles: 'org', discord, owner_discord: discordUser || discord,
        expires_at: new Date(Date.now() + 48*60*60*1000).toISOString(),
        post_type: 'org', solo_note: pitch,
        org: orgTag || null, org_name: orgName,
        org_roles: orgRoles || null, org_poster_url
      }])
      if (error) throw error
      closePostModal()
      await renderListings()
      showToast('// ORG RECRUITMENT BROADCAST TO SECTOR')
    } catch (e) {
      console.error('Org post error:', e)
      showToast('// ERROR: Could not post org listing')
    } finally {
      if (btn) { btn.textContent = 'BROADCAST ORG RECRUITMENT'; btn.disabled = false }
    }
    return
  }

  if (isSolo) {
    const ship = document.getElementById('f-solo-ship')?.value?.trim() || 'No Ship Listed'
    const mission = document.getElementById('f-solo-mission')?.value
    const system = document.getElementById('f-system')?.value
    const style = document.getElementById('f-style')?.value
    const discord = document.getElementById('f-discord')?.value?.trim() || 'N/A'
    const solo_note = document.getElementById('f-solo-note')?.value?.trim()
    const org = document.getElementById('f-org')?.value?.trim() || null
    if (btn) { btn.textContent = 'TRANSMITTING...'; btn.disabled = true }
    try {
      const { error } = await sb.from('listings').insert([{
        ship, mission, owner, timezone: system, playstyle: style,
        roles: currentPostType, discord, owner_discord: discord || discordUser,
        expires_at: new Date(Date.now() + 48*60*60*1000).toISOString(),
        post_type: currentPostType, solo_note, org
      }])
      if (error) throw error
      ;['f-solo-ship','f-solo-ship-search','f-solo-note','f-discord'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = ''
      })
      closePostModal()
      await renderListings()
      showToast('// SOLO POST BROADCAST TO SECTOR')
    } catch (e) {
      console.error('Post error:', e)
      showToast('// ERROR: Could not post listing')
    } finally {
      if (btn) { btn.textContent = currentPostType === 'lfg' ? 'BROADCAST LFG POST' : 'BROADCAST LFM POST'; btn.disabled = false }
    }
    return
  }

  // Crew post
  const ship = document.getElementById('f-ship')?.value?.trim()
  if (!ship) { showToast('// ERROR: Ship name required'); return }
  const roles = []
  document.querySelectorAll('#roles-grid .role-counter').forEach(el => {
    const roleName = el.dataset.value
    const count = parseInt(el.querySelector('.role-count')?.textContent) || 0
    for (let i = 0; i < count; i++) roles.push(roleName)
  })
  if (roles.length === 0) { showToast('// ERROR: Select at least one role'); return }
  const mission = document.getElementById('f-mission')?.value
  const system = document.getElementById('f-system')?.value
  const style = document.getElementById('f-style')?.value
  const discord = document.getElementById('f-discord')?.value?.trim() || 'N/A'
  const org = document.getElementById('f-org')?.value?.trim() || null
  if (btn) { btn.textContent = 'TRANSMITTING...'; btn.disabled = true }
  try {
    const { error } = await sb.from('listings').insert([{
      ship, mission, owner, timezone: system, playstyle: style,
      roles: roles.join(','), discord, owner_discord: discord || discordUser,
      expires_at: new Date(Date.now() + 48*60*60*1000).toISOString(), org
    }])
    if (error) throw error
    ;['f-ship','f-ship-search','f-discord'].forEach(id => { const el = document.getElementById(id); if (el) el.value = '' })
    document.querySelectorAll('#roles-grid .role-count').forEach(el => { el.textContent = '0' })
    document.querySelectorAll('#roles-grid .role-counter').forEach(el => el.classList.remove('active'))
    closePostModal()
    await renderListings()
    showToast('// CREW LISTING BROADCAST TO SECTOR')
  } catch (e) {
    console.error('Post error:', e)
    showToast('// ERROR: Could not post listing')
  } finally {
    if (btn) { btn.textContent = 'BROADCAST LISTING'; btn.disabled = false }
  }
}

export function initPost() {
  // nothing needed — all handled via global window functions
}
