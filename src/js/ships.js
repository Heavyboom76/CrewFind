export const SHIPS = [
  // ── MULTI-CREW ──────────────────────────────────────────────────────────────
  { name: 'Hammerhead', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Idris-M', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Idris-P', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Nautilus', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Reclaimer', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Redeemer', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Retaliator', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Vanguard Harbinger', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Vanguard Hoplite', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Vanguard Sentinel', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Vanguard Warden', manufacturer: 'Aegis', type: 'multi' },
  { name: 'Asgard', manufacturer: 'Anvil', type: 'multi' },
  { name: 'Carrack', manufacturer: 'Anvil', type: 'multi' },
  { name: 'F7C-M Super Hornet Mk2', manufacturer: 'Anvil', type: 'multi' },
  { name: 'Gladiator', manufacturer: 'Anvil', type: 'multi' },
  { name: 'Hurricane', manufacturer: 'Anvil', type: 'multi' },
  { name: 'Paladin', manufacturer: 'Anvil', type: 'multi' },
  { name: 'Pisces C8R Rescue', manufacturer: 'Anvil', type: 'multi' },
  { name: 'Pisces C8X Expedition', manufacturer: 'Anvil', type: 'multi' },
  { name: 'Terrapin', manufacturer: 'Anvil', type: 'multi' },
  { name: 'Terrapin Medic', manufacturer: 'Anvil', type: 'multi' },
  { name: 'Valkyrie', manufacturer: 'Anvil', type: 'multi' },
  { name: 'MOLE', manufacturer: 'Argo', type: 'multi' },
  { name: 'MOTH', manufacturer: 'Argo', type: 'multi' },
  { name: 'RAFT', manufacturer: 'Argo', type: 'multi' },
  { name: 'Defender', manufacturer: 'Banu', type: 'multi' },
  { name: 'Apollo Medivac', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Apollo Triage', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Ares Inferno', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Ares Ion', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Hercules A2', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Hercules C2', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Hercules M2', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Mercury Star Runner', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Spirit A1', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Spirit C1', manufacturer: 'Crusader', type: 'multi' },
  { name: 'Caterpillar', manufacturer: 'Drake', type: 'multi' },
  { name: 'Corsair', manufacturer: 'Drake', type: 'multi' },
  { name: 'Cutlass Black', manufacturer: 'Drake', type: 'multi' },
  { name: 'Cutlass Blue', manufacturer: 'Drake', type: 'multi' },
  { name: 'Cutlass Red', manufacturer: 'Drake', type: 'multi' },
  { name: 'Cutlass Steel', manufacturer: 'Drake', type: 'multi' },
  { name: 'Prowler', manufacturer: 'Esperia', type: 'multi' },
  { name: 'Prowler Utility', manufacturer: 'Esperia', type: 'multi' },
  { name: 'Railen', manufacturer: 'Gatac', type: 'multi' },
  { name: 'Freelancer', manufacturer: 'MISC', type: 'multi' },
  { name: 'Freelancer DUR', manufacturer: 'MISC', type: 'multi' },
  { name: 'Freelancer MAX', manufacturer: 'MISC', type: 'multi' },
  { name: 'Freelancer MIS', manufacturer: 'MISC', type: 'multi' },
  { name: 'Hull A',manufacturer: 'MISC', type: 'multi'},
  { name: 'Hull B',manufacturer: 'MISC', type: 'multi'},
  { name: 'Hull C', manufacturer: 'MISC', type: 'multi' },
  { name: 'Reliant Kore', manufacturer: 'MISC', type: 'multi' },
  { name: 'Reliant Mako', manufacturer: 'MISC', type: 'multi' },
  { name: 'Reliant Sen', manufacturer: 'MISC', type: 'multi' },
  { name: 'Reliant Tana', manufacturer: 'MISC', type: 'multi' },
  { name: 'Starlancer MAX', manufacturer: 'MISC', type: 'multi' },
  { name: 'Starlancer TAC', manufacturer: 'MISC', type: 'multi' },
  { name: 'Starfarer', manufacturer: 'MISC', type: 'multi' },
  { name: 'Starfarer Gemini', manufacturer: 'MISC', type: 'multi' },
  { name: 'Guardian', manufacturer: 'Mirai', type: 'multi' },
  { name: 'Guardian MX', manufacturer: 'Mirai', type: 'multi' },
  { name: 'Guardian QI', manufacturer: 'Mirai', type: 'multi' },
  { name: '400i', manufacturer: 'Origin', type: 'multi' },
  { name: '600i Explorer', manufacturer: 'Origin', type: 'multi' },
  { name: '600i Touring', manufacturer: 'Origin', type: 'multi' },
  { name: '890 Jump', manufacturer: 'Origin', type: 'multi' },
  { name: 'Constellation Andromeda', manufacturer: 'RSI', type: 'multi' },
  { name: 'Constellation Aquila', manufacturer: 'RSI', type: 'multi' },
  { name: 'Constellation Phoenix', manufacturer: 'RSI', type: 'multi' },
  { name: 'Constellation Taurus', manufacturer: 'RSI', type: 'multi' },
  { name: 'Hermes', manufacturer: 'RSI', type: 'multi' },
  { name: 'Perseus', manufacturer: 'RSI', type: 'multi' },
  { name: 'Polaris', manufacturer: 'RSI', type: 'multi' },
  { name: 'Scorpius', manufacturer: 'RSI', type: 'multi' },
  { name: 'Scorpius Antares', manufacturer: 'RSI', type: 'multi' },
  { name: 'Zeus Mk II CL', manufacturer: 'RSI', type: 'multi' },
  { name: 'Zeus Mk II ES', manufacturer: 'RSI', type: 'multi' },

  // ── SOLO ────────────────────────────────────────────────────────────────────
  { name: 'Avenger Stalker', manufacturer: 'Aegis', type: 'solo' },
  { name: 'Avenger Titan', manufacturer: 'Aegis', type: 'solo' },
  { name: 'Avenger Warlock', manufacturer: 'Aegis', type: 'solo' },
  { name: 'Eclipse', manufacturer: 'Aegis', type: 'solo' },
  { name: 'Gladius', manufacturer: 'Aegis', type: 'solo' },
  { name: 'Sabre', manufacturer: 'Aegis', type: 'solo' },
  { name: 'Sabre Comet', manufacturer: 'Aegis', type: 'solo' },
  { name: 'Sabre Firebird', manufacturer: 'Aegis', type: 'solo' },
  { name: 'Sabre Raven', manufacturer: 'Aegis', type: 'solo' },
  { name: 'Arrow', manufacturer: 'Anvil', type: 'solo' },
  { name: 'F7A Hornet Mk2', manufacturer: 'Anvil', type: 'solo' },
  { name: 'F7C Hornet Mk2', manufacturer: 'Anvil', type: 'solo' },
  { name: 'F7C-R Hornet Tracker Mk2', manufacturer: 'Anvil', type: 'solo' },
  { name: 'F7C-S Hornet Ghost Mk2', manufacturer: 'Anvil', type: 'solo' },
  { name: 'F8C Lightning', manufacturer: 'Anvil', type: 'solo' },
  { name: 'Hawk', manufacturer: 'Anvil', type: 'solo' },
  { name: 'MPUV Cargo', manufacturer: 'Argo', type: 'solo' },
  { name: 'MPUV Personnel', manufacturer: 'Argo', type: 'solo' },
  { name: 'MPUV Tractor', manufacturer: 'Argo', type: 'solo' },
  { name: 'SRV', manufacturer: 'Argo', type: 'solo' },
  { name: 'Mustang Alpha', manufacturer: 'CNOU', type: 'solo' },
  { name: 'Mustang Beta', manufacturer: 'CNOU', type: 'solo' },
  { name: 'Mustang Delta', manufacturer: 'CNOU', type: 'solo' },
  { name: 'Mustang Gamma', manufacturer: 'CNOU', type: 'solo' },
  { name: 'Nomad', manufacturer: 'CNOU', type: 'solo' },
  { name: 'Intrepid', manufacturer: 'Crusader', type: 'solo' },
  { name: 'Buccaneer', manufacturer: 'Drake', type: 'solo' },
  { name: 'Clipper', manufacturer: 'Drake', type: 'solo' },
  { name: 'Cutter', manufacturer: 'Drake', type: 'solo' },
  { name: 'Cutter Rambler', manufacturer: 'Drake', type: 'solo' },
  { name: 'Cutter Scout', manufacturer: 'Drake', type: 'solo' },
  { name: 'Golem', manufacturer: 'Drake', type: 'solo' },
  { name: 'Golem OX', manufacturer: 'Drake', type: 'solo' },
  { name: 'Herald', manufacturer: 'Drake', type: 'solo' },
  { name: 'Vulture', manufacturer: 'Drake', type: 'solo' },
  { name: 'Blade', manufacturer: 'Esperia', type: 'solo' },
  { name: 'Glaive', manufacturer: 'Esperia', type: 'solo' },
  { name: 'Scythe', manufacturer: 'Esperia', type: 'solo' },
  { name: 'Stinger', manufacturer: 'Esperia', type: 'solo' },
  { name: 'Talon', manufacturer: 'Esperia', type: 'solo' },
  { name: 'Talon Shrike', manufacturer: 'Esperia', type: 'solo' },
  { name: 'Syulen', manufacturer: 'Gatac', type: 'solo' },
  { name: 'Shiv', manufacturer: "Grey's", type: 'solo' },
  { name: 'L-21 Wolf', manufacturer: 'Kruger', type: 'solo' },
  { name: 'L-22 Alpha Wolf', manufacturer: 'Kruger', type: 'solo' },
  { name: 'P-52 Merlin', manufacturer: 'Kruger', type: 'solo' },
  { name: 'P-72 Archimedes', manufacturer: 'Kruger', type: 'solo' },
  { name: 'Fortune', manufacturer: 'MISC', type: 'solo' },
  { name: 'Prospector', manufacturer: 'MISC', type: 'solo' },
  { name: 'Razor', manufacturer: 'MISC', type: 'solo' },
  { name: 'Razor EX', manufacturer: 'MISC', type: 'solo' },
  { name: 'Razor LX', manufacturer: 'MISC', type: 'solo' },
  { name: 'Fury', manufacturer: 'Mirai', type: 'solo' },
  { name: 'Fury LX', manufacturer: 'Mirai', type: 'solo' },
  { name: 'Fury MX', manufacturer: 'Mirai', type: 'solo' },
  { name: '100i', manufacturer: 'Origin', type: 'solo' },
  { name: '125a', manufacturer: 'Origin', type: 'solo' },
  { name: '135c', manufacturer: 'Origin', type: 'solo' },
  { name: '300i', manufacturer: 'Origin', type: 'solo' },
  { name: '315p', manufacturer: 'Origin', type: 'solo' },
  { name: '325a', manufacturer: 'Origin', type: 'solo' },
  { name: '350r', manufacturer: 'Origin', type: 'solo' },
  { name: '85x', manufacturer: 'Origin', type: 'solo' },
  { name: 'M50', manufacturer: 'Origin', type: 'solo' },
  { name: 'Aurora CL', manufacturer: 'RSI', type: 'solo' },
  { name: 'Aurora ES', manufacturer: 'RSI', type: 'solo' },
  { name: 'Aurora LN', manufacturer: 'RSI', type: 'solo' },
  { name: 'Aurora LX', manufacturer: 'RSI', type: 'solo' },
  { name: 'Aurora MR', manufacturer: 'RSI', type: 'solo' },
  { name: 'Aurora Mk II', manufacturer: 'RSI', type: 'solo' },
  { name: 'Mantis', manufacturer: 'RSI', type: 'solo' },
  { name: 'Meteor', manufacturer: 'RSI', type: 'solo' },
  { name: 'Salvation', manufacturer: 'RSI', type: 'solo' },
  { name: 'Khartu-Al', manufacturer: 'AopoA', type: 'solo' },
  { name: "San'tok.yai", manufacturer: 'AopoA', type: 'solo' },

  // ── GROUND ──────────────────────────────────────────────────────────────────
  { name: 'Ballista', manufacturer: 'Anvil', type: 'ground' },
  { name: 'Centurion', manufacturer: 'Anvil', type: 'ground' },
  { name: 'Spartan', manufacturer: 'Anvil', type: 'ground' },
  { name: 'ATLS', manufacturer: 'Argo', type: 'ground' },
  { name: 'ATLS Geo', manufacturer: 'Argo', type: 'ground' },
  { name: 'CSV-SM', manufacturer: 'Argo', type: 'ground' },
  { name: 'HoverQuad', manufacturer: 'CNOU', type: 'ground' },
  { name: 'Dragonfly Black', manufacturer: 'Drake', type: 'ground' },
  { name: 'Dragonfly Yellowjacket', manufacturer: 'Drake', type: 'ground' },
  { name: 'Mule', manufacturer: 'Drake', type: 'ground' },
  { name: 'MDC', manufacturer: 'Greycat', type: 'ground' },
  { name: 'MTC', manufacturer: 'Greycat', type: 'ground' },
  { name: 'PTV', manufacturer: 'Greycat', type: 'ground' },
  { name: 'ROC', manufacturer: 'Greycat', type: 'ground' },
  { name: 'ROC DS', manufacturer: 'Greycat', type: 'ground' },
  { name: 'STV', manufacturer: 'Greycat', type: 'ground' },
  { name: 'Pulse', manufacturer: 'Mirai', type: 'ground' },
  { name: 'Pulse LX', manufacturer: 'Mirai', type: 'ground' },
  { name: 'Lynx Rover', manufacturer: 'Origin', type: 'ground' },
  { name: 'X1 Base', manufacturer: 'Origin', type: 'ground' },
  { name: 'X1 Force', manufacturer: 'Origin', type: 'ground' },
  { name: 'X1 Velocity', manufacturer: 'Origin', type: 'ground' },
  { name: 'Ursa Rover', manufacturer: 'RSI', type: 'ground' },
  { name: 'Ursa Rover Fortuna', manufacturer: 'RSI', type: 'ground' },
  { name: 'Ursa Rover Medivac', manufacturer: 'RSI', type: 'ground' },
  { name: 'Cyclone', manufacturer: 'Tumbril', type: 'ground' },
  { name: 'Cyclone AA', manufacturer: 'Tumbril', type: 'ground' },
  { name: 'Cyclone MT', manufacturer: 'Tumbril', type: 'ground' },
  { name: 'Cyclone RC', manufacturer: 'Tumbril', type: 'ground' },
  { name: 'Cyclone RN', manufacturer: 'Tumbril', type: 'ground' },
  { name: 'Cyclone TR', manufacturer: 'Tumbril', type: 'ground' },
  { name: 'Nova', manufacturer: 'Tumbril', type: 'ground' },
  { name: 'Storm', manufacturer: 'Tumbril', type: 'ground' },
  { name: 'Storm AA', manufacturer: 'Tumbril', type: 'ground' },
  { name: 'Nox', manufacturer: 'AopoA', type: 'ground' },
  { name: 'Nox Kue', manufacturer: 'AopoA', type: 'ground' },
].sort((a, b) => a.name.localeCompare(b.name))

const TYPE_LABEL = { multi: 'Multi', solo: 'Solo', ground: 'Ground' }
let selectedShipIndex = -1

export function initShipSearch() {
  setupShipSearch('f-ship-search', 'ship-dropdown', 'f-ship', ['multi'])
  setupShipSearch('f-solo-ship-search', 'solo-ship-dropdown', 'f-solo-ship', ['solo', 'ground', 'multi'])
}

function setupShipSearch(inputId, dropdownId, hiddenId, types) {
  const input = document.getElementById(inputId)
  const dropdown = document.getElementById(dropdownId)
  if (!input || !dropdown) return

  input.addEventListener('focus', () => {
    renderShipDropdown(input.value, dropdownId, hiddenId, types)
    dropdown.classList.add('open')
  })
  input.addEventListener('input', e => {
    renderShipDropdown(e.target.value, dropdownId, hiddenId, types)
    dropdown.classList.add('open')
    selectedShipIndex = -1
  })
  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.remove('open'), 200)
  })
  input.addEventListener('keydown', e => {
    const options = dropdown.querySelectorAll('.ship-option')
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedShipIndex = Math.min(selectedShipIndex + 1, options.length - 1)
      options.forEach((opt, i) => { opt.classList.toggle('selected', i === selectedShipIndex); if (i === selectedShipIndex) opt.scrollIntoView({ block: 'nearest' }) })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedShipIndex = Math.max(selectedShipIndex - 1, 0)
      options.forEach((opt, i) => { opt.classList.toggle('selected', i === selectedShipIndex) })
    } else if (e.key === 'Enter' && selectedShipIndex >= 0) {
      e.preventDefault()
      options[selectedShipIndex].click()
    }
  })
}

function renderShipDropdown(query, dropdownId, hiddenId, types) {
  const dropdown = document.getElementById(dropdownId)
  if (!dropdown) return
  const q = query.toLowerCase()
  const filtered = SHIPS.filter(s => types.includes(s.type) && (s.name.toLowerCase().includes(q) || s.manufacturer.toLowerCase().includes(q)))
  dropdown.innerHTML = filtered.map(s => `
    <div class="ship-option" onclick="selectShip('${s.name.replace(/'/g, "\\'")}','${dropdownId}','${hiddenId}')">
      ${s.name}
      <span class="manufacturer">${s.manufacturer}</span>
      <span class="manufacturer" style="margin-left:4px;color:${s.type==='ground'?'#c8a878':s.type==='solo'?'#b08fe8':'var(--text-dim)'}">[${TYPE_LABEL[s.type]}]</span>
    </div>`).join('')
}

export function selectShip(name, dropdownId, hiddenId) {
  const dropdown = document.getElementById(dropdownId)
  const hiddenInput = document.getElementById(hiddenId)
  const searchId = dropdownId === 'ship-dropdown' ? 'f-ship-search' : 'f-solo-ship-search'
  const searchInput = document.getElementById(searchId)
  if (searchInput) searchInput.value = name
  if (hiddenInput) hiddenInput.value = name
  if (dropdown) dropdown.classList.remove('open')
}
