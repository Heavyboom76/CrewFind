// ── Toast ─────────────────────────────────────────────────────────────────────
export function showToast(msg) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 2800)
}

// ── Tab switching ─────────────────────────────────────────────────────────────
export function setTabById(id, btn) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
  if (btn) btn.classList.add('active')
  document.querySelectorAll('[id^="tab-"]').forEach(el => el.style.display = 'none')
  const tab = document.getElementById('tab-' + id)
  if (tab) tab.style.display = 'block'
}

// ── External URL (Capacitor-aware) ────────────────────────────────────────────
export function openExternalUrl(url) {
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    if (window.Capacitor.Plugins?.Browser) {
      window.Capacitor.Plugins.Browser.open({ url })
    } else {
      window.open(url, '_system')
    }
  } else {
    window.open(url, '_blank')
  }
}

// ── Expiry helper ─────────────────────────────────────────────────────────────
export function expiryLabel(expiresAt) {
  const diff = new Date(expiresAt) - Date.now()
  if (diff <= 0) return 'expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 24) return `expires in ${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `expires in ${h}h ${m}m`
  return `expires in ${m}m`
}

export function isExpiringSoon(expiresAt) {
  return (new Date(expiresAt) - Date.now()) < 3 * 3600000
}

// ── Mission label ─────────────────────────────────────────────────────────────
export function missionLabel(m) {
  const map = {
    bounty: 'Bounty Hunting', cargo: 'Cargo Run', patrol: 'Patrol',
    explore: 'Exploration', mining: 'Mining', salvage: 'Salvage',
    medical: 'Medical/Rescue', piracy: 'PvP/Piracy', escort: 'Escort',
    ground: 'Ground Combat', pvp: 'PvP/Piracy'
  }
  return map[m] || m
}
