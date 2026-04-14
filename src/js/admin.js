import { sb } from './supabase.js'
import { showToast } from './ui.js'
import { getCurrentHandle, getIsGuest } from './auth.js'

let isAdmin = false

// ── Check admin status ────────────────────────────────────────────────────────
export async function checkAdminStatus() {
  const handle = getCurrentHandle()
  if (!handle || getIsGuest()) return false
  try {
    const { data } = await sb.from('admins')
      .select('rsi_handle')
      .eq('rsi_handle', handle)
      .maybeSingle()
    isAdmin = !!data
    // Show/hide admin nav button
    const btn = document.getElementById('tab-btn-admin')
    if (btn) btn.style.display = isAdmin ? '' : 'none'
  } catch (e) { isAdmin = false }
  return isAdmin
}

export function getIsAdmin() { return isAdmin }

// ── Report button HTML ────────────────────────────────────────────────────────
export function reportButtonHtml(targetType, targetId) {
  return `<button onclick="event.stopPropagation();openReportModal('${targetType}','${targetId}')" 
    style="background:none;border:1px solid var(--border);color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;padding:3px 8px;cursor:pointer;transition:all 0.15s"
    onmouseover="this.style.borderColor='var(--danger)';this.style.color='var(--danger)'"
    onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-dim)'">⚑ REPORT</button>`
}

// ── Report modal ──────────────────────────────────────────────────────────────
export function openReportModal(targetType, targetId) {
  const handle = getCurrentHandle()
  if (!handle) { showToast('// LOGIN REQUIRED TO REPORT'); return }

  const existing = document.getElementById('report-modal-overlay')
  if (existing) existing.remove()

  const overlay = document.createElement('div')
  overlay.id = 'report-modal-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(7,9,15,0.92);z-index:300;display:flex;align-items:center;justify-content:center;padding:24px'
  overlay.innerHTML = `
    <div style="width:100%;max-width:420px;background:var(--bg2);border:1px solid var(--border-bright);padding:24px;position:relative">
      <div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--danger),transparent)"></div>
      <button onclick="closeReportModal()" style="position:absolute;top:12px;right:12px;background:none;border:1px solid var(--border);color:var(--text-dim);width:28px;height:28px;cursor:pointer;font-size:14px">✕</button>
      <div style="font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:var(--danger);letter-spacing:2px;margin-bottom:20px;text-transform:uppercase">// Report ${targetType === 'listing' ? 'Listing' : 'Pilot'}</div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">Reason</div>
      <select id="report-reason" style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px 14px;font-family:'Share Tech Mono',monospace;font-size:11px;margin-bottom:14px;outline:none;appearance:none">
        <option value="spam">Spam or fake listing</option>
        <option value="harassment">Harassment or toxic behaviour</option>
        <option value="fake_profile">Fake or impersonation profile</option>
        <option value="inappropriate">Inappropriate content</option>
        <option value="scam">Scam or fraud</option>
        <option value="other">Other</option>
      </select>
      <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:8px">Additional Details <span style="font-size:9px;color:var(--text-dim)">(optional)</span></div>
      <textarea id="report-comment" maxlength="280" rows="3" placeholder="Describe the issue..." style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px 14px;font-family:'Share Tech Mono',monospace;font-size:11px;margin-bottom:16px;outline:none;resize:none;line-height:1.5"></textarea>
      <button onclick="submitReport('${targetType}','${targetId}')" style="width:100%;padding:12px;background:var(--danger);border:none;color:#fff;font-family:'Orbitron',monospace;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer">SUBMIT REPORT</button>
    </div>`
  overlay.addEventListener('click', e => { if (e.target === overlay) closeReportModal() })
  document.body.appendChild(overlay)
}

export function closeReportModal() {
  document.getElementById('report-modal-overlay')?.remove()
}

export async function submitReport(targetType, targetId) {
  const handle = getCurrentHandle()
  const reason = document.getElementById('report-reason')?.value
  const comment = document.getElementById('report-comment')?.value?.trim()
  if (!reason) { showToast('// SELECT A REASON'); return }

  try {
    const { error } = await sb.from('reports').insert({
      reporter_handle: handle,
      target_type: targetType,
      target_id: targetId,
      reason,
      comment: comment || null
    })
    if (error) throw error

    // Check auto-hide threshold — 15 reports in 12 hours
    const twelveHoursAgo = new Date(Date.now() - 12*60*60*1000).toISOString()
    const { count } = await sb.from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .gte('created_at', twelveHoursAgo)

    if (count >= 15) {
      if (targetType === 'listing') {
        await sb.from('listings').update({ hidden: true }).eq('id', targetId)
      } else if (targetType === 'profile') {
        await sb.from('profiles').update({ hidden: true }).eq('rsi_handle', targetId)
      }
    }

    closeReportModal()
    showToast('// REPORT SUBMITTED — THANK YOU')
  } catch (e) {
    console.error('Report error:', e)
    showToast('// ERROR: Could not submit report')
  }
}
window.submitReport = submitReport
window.closeReportModal = closeReportModal
window.openReportModal = openReportModal

// ── Admin panel ───────────────────────────────────────────────────────────────
export async function openAdminPanel() {
  if (!isAdmin) return
  const container = document.getElementById('tab-admin')
  if (!container) return

  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
  document.getElementById('tab-btn-admin')?.classList.add('active')
  document.getElementById('tab-browse').style.display = 'none'
  document.getElementById('tab-my-posts').style.display = 'none'
  document.getElementById('tab-messages').style.display = 'none'
  container.style.display = 'block'

  container.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#5a7a9a">[ LOADING REPORTS... ]</div>'

  try {
    // Load recent reports
    const { data: reports, error } = await sb.from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error

    // Load hidden listings and profiles
    const [hiddenListings, hiddenProfiles, adminList] = await Promise.all([
      sb.from('listings').select('id, ship, owner, hidden').eq('hidden', true),
      sb.from('profiles').select('rsi_handle, hidden').eq('hidden', true),
      sb.from('admins').select('rsi_handle, added_at').order('added_at')
    ])

    container.innerHTML = `
      <div style="padding:16px 0">
        <div style="font-family:'Orbitron',monospace;font-size:12px;font-weight:700;color:var(--danger);letter-spacing:3px;margin-bottom:20px;text-transform:uppercase">// Admin Panel</div>

        <!-- Stats -->
        <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">
          <div style="padding:12px 16px;border:1px solid var(--border);background:var(--bg2);font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim)">
            TOTAL REPORTS: <span style="color:var(--danger)">${reports?.length || 0}</span>
          </div>
          <div style="padding:12px 16px;border:1px solid var(--border);background:var(--bg2);font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim)">
            HIDDEN LISTINGS: <span style="color:var(--accent2)">${hiddenListings?.data?.length || 0}</span>
          </div>
          <div style="padding:12px 16px;border:1px solid var(--border);background:var(--bg2);font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim)">
            HIDDEN PROFILES: <span style="color:var(--accent2)">${hiddenProfiles?.data?.length || 0}</span>
          </div>
        </div>

        <!-- Hidden content -->
        ${(hiddenListings?.data?.length || hiddenProfiles?.data?.length) ? `
        <div style="margin-bottom:24px">
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--accent2);text-transform:uppercase;margin-bottom:10px">// Hidden Content</div>
          ${(hiddenListings?.data || []).map(l => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid rgba(232,168,79,0.2);background:var(--bg2);margin-bottom:6px;font-family:'Share Tech Mono',monospace;font-size:10px">
              <span style="color:var(--text)">LISTING: ${(l.ship||'Unknown').toUpperCase()} by ${l.owner}</span>
              <div style="display:flex;gap:6px">
                <button onclick="adminUnhide('listing','${l.id}')" style="padding:4px 10px;border:1px solid var(--success);color:var(--success);background:none;font-family:'Share Tech Mono',monospace;font-size:9px;cursor:pointer">RESTORE</button>
                <button onclick="adminBanUser('${l.owner}')" style="padding:4px 10px;border:1px solid var(--danger);color:var(--danger);background:none;font-family:'Share Tech Mono',monospace;font-size:9px;cursor:pointer">BAN USER</button>
              </div>
            </div>`).join('')}
          ${(hiddenProfiles?.data || []).map(p => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid rgba(232,168,79,0.2);background:var(--bg2);margin-bottom:6px;font-family:'Share Tech Mono',monospace;font-size:10px">
              <span style="color:var(--text)">PROFILE: ${p.rsi_handle}</span>
              <div style="display:flex;gap:6px">
                <button onclick="adminUnhide('profile','${p.rsi_handle}')" style="padding:4px 10px;border:1px solid var(--success);color:var(--success);background:none;font-family:'Share Tech Mono',monospace;font-size:9px;cursor:pointer">RESTORE</button>
                <button onclick="adminBanUser('${p.rsi_handle}')" style="padding:4px 10px;border:1px solid var(--danger);color:var(--danger);background:none;font-family:'Share Tech Mono',monospace;font-size:9px;cursor:pointer">BAN USER</button>
              </div>
            </div>`).join('')}
        </div>` : ''}

        <!-- Recent reports -->
        <div style="margin-bottom:24px">
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:10px">// Recent Reports (last 50)</div>
          ${!reports?.length ? '<div style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:var(--text-dim);padding:20px 0">No reports yet</div>' :
            reports.map(r => `
            <div style="padding:12px;border:1px solid var(--border);background:var(--bg2);margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">
                <span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--danger)">${r.reason.replace(/_/g,' ').toUpperCase()}</span>
                <span style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim)">${new Date(r.created_at).toLocaleString()}</span>
              </div>
              <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text);margin-bottom:6px">
                <span style="color:var(--text-dim)">FROM:</span> ${r.reporter_handle} &nbsp;→&nbsp; 
                <span style="color:var(--text-dim)">${r.target_type.toUpperCase()}:</span> ${r.target_id}
              </div>
              ${r.comment ? `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);border-left:2px solid var(--border);padding-left:8px;font-style:italic">"${r.comment}"</div>` : ''}
              <div style="display:flex;gap:6px;margin-top:8px">
                <button onclick="adminHide('${r.target_type}','${r.target_id}')" style="padding:4px 10px;border:1px solid var(--accent2);color:var(--accent2);background:none;font-family:'Share Tech Mono',monospace;font-size:9px;cursor:pointer">HIDE</button>
                <button onclick="adminBanUser('${r.target_id}')" style="padding:4px 10px;border:1px solid var(--danger);color:var(--danger);background:none;font-family:'Share Tech Mono',monospace;font-size:9px;cursor:pointer">BAN</button>
                <button onclick="adminDismissReport('${r.id}')" style="padding:4px 10px;border:1px solid var(--border);color:var(--text-dim);background:none;font-family:'Share Tech Mono',monospace;font-size:9px;cursor:pointer">DISMISS</button>
              </div>
            </div>`).join('')
          }
        </div>

        <!-- Admins list -->
        <div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:10px">// Admin Team</div>
          ${(adminList?.data || []).map(a => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border:1px solid var(--border);background:var(--bg2);margin-bottom:6px;font-family:'Share Tech Mono',monospace;font-size:10px">
              <span style="color:var(--accent)">${a.rsi_handle}</span>
              ${a.rsi_handle !== getCurrentHandle() ? `<button onclick="adminRemoveAdmin('${a.rsi_handle}')" style="padding:3px 8px;border:1px solid var(--border);color:var(--text-dim);background:none;font-family:'Share Tech Mono',monospace;font-size:9px;cursor:pointer">REMOVE</button>` : '<span style="color:var(--text-dim);font-size:9px">YOU</span>'}
            </div>`).join('')}
          <div style="display:flex;gap:8px;margin-top:10px">
            <input id="new-admin-handle" class="form-input" placeholder="RSI Handle" style="flex:1" />
            <button onclick="adminAddAdmin()" style="padding:10px 16px;background:var(--accent);border:none;color:var(--bg);font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:1px;cursor:pointer">ADD ADMIN</button>
          </div>
        </div>
      </div>`
  } catch (e) {
    console.error('Admin panel error:', e)
    container.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#e84f4f">[ ERROR LOADING ADMIN PANEL ]</div>'
  }
}
window.openAdminPanel = openAdminPanel

// ── Admin actions ─────────────────────────────────────────────────────────────
export async function adminHide(targetType, targetId) {
  if (!isAdmin) return
  try {
    if (targetType === 'listing') {
      await sb.from('listings').update({ hidden: true }).eq('id', targetId)
    } else {
      await sb.from('profiles').update({ hidden: true }).eq('rsi_handle', targetId)
    }
    showToast('// HIDDEN')
    openAdminPanel()
  } catch (e) { showToast('// ERROR: Could not hide') }
}
window.adminHide = adminHide

export async function adminUnhide(targetType, targetId) {
  if (!isAdmin) return
  try {
    if (targetType === 'listing') {
      await sb.from('listings').update({ hidden: false }).eq('id', targetId)
    } else {
      await sb.from('profiles').update({ hidden: false }).eq('rsi_handle', targetId)
    }
    showToast('// RESTORED')
    openAdminPanel()
  } catch (e) { showToast('// ERROR: Could not restore') }
}
window.adminUnhide = adminUnhide

export async function adminBanUser(handle) {
  if (!isAdmin) return
  if (!confirm(`Ban ${handle}? This will hide their profile and all listings.`)) return
  try {
    await Promise.all([
      sb.from('profiles').update({ hidden: true, banned: true }).eq('rsi_handle', handle),
      sb.from('listings').update({ hidden: true }).eq('owner', handle)
    ])
    showToast(`// ${handle.toUpperCase()} BANNED`)
    openAdminPanel()
  } catch (e) { showToast('// ERROR: Could not ban user') }
}
window.adminBanUser = adminBanUser

export async function adminDismissReport(reportId) {
  if (!isAdmin) return
  try {
    await sb.from('reports').delete().eq('id', reportId)
    showToast('// REPORT DISMISSED')
    openAdminPanel()
  } catch (e) { showToast('// ERROR') }
}
window.adminDismissReport = adminDismissReport

export async function adminAddAdmin() {
  if (!isAdmin) return
  const handle = document.getElementById('new-admin-handle')?.value?.trim()
  if (!handle) { showToast('// ENTER A HANDLE'); return }
  try {
    await sb.from('admins').insert({ rsi_handle: handle })
    showToast(`// ${handle.toUpperCase()} IS NOW AN ADMIN`)
    openAdminPanel()
  } catch (e) { showToast('// ERROR: Could not add admin') }
}
window.adminAddAdmin = adminAddAdmin

export async function adminRemoveAdmin(handle) {
  if (!isAdmin) return
  if (!confirm(`Remove ${handle} as admin?`)) return
  try {
    await sb.from('admins').delete().eq('rsi_handle', handle)
    showToast(`// ${handle.toUpperCase()} REMOVED AS ADMIN`)
    openAdminPanel()
  } catch (e) { showToast('// ERROR: Could not remove admin') }
}
window.adminRemoveAdmin = adminRemoveAdmin
