import { sb } from './supabase.js'
import { showToast } from './ui.js'
import { getCurrentHandle, getCurrentUser } from './auth.js'

let activeConversationId = null
let realtimeChannel = null
let conversations = []
let unreadCount = 0

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initMessages() {
  // Retry unread count after a short delay to ensure auth is settled
  await refreshUnreadCount()
  setTimeout(refreshUnreadCount, 2000)
  subscribeToNewMessages()
}

export async function checkUnread() {
  await refreshUnreadCount()
}

// ── Unread badge ──────────────────────────────────────────────────────────────
async function refreshUnreadCount() {
  const handle = getCurrentHandle()
  if (!handle) return
  try {
    // Get all conversation IDs for this user
    const { data: convos } = await sb.from('conversations')
      .select('id, participant_a, participant_b, cleared_by_a, cleared_by_b')
      .or(`participant_a.eq.${handle},participant_b.eq.${handle}`)

    if (!convos?.length) { setUnreadBadge(0); return }

    // Filter out cleared conversations
    const activeIds = convos.filter(c => {
      const isA = c.participant_a.toLowerCase() === handle.toLowerCase()
      return isA ? !c.cleared_by_a : !c.cleared_by_b
    }).map(c => c.id)

    if (!activeIds.length) { setUnreadBadge(0); return }

    const { count } = await sb.from('messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', activeIds)
      .eq('read', false)
      .neq('sender_handle', handle)

    setUnreadBadge(count || 0)
  } catch (e) { console.error('Unread count error:', e) }
}

function setUnreadBadge(count) {
  unreadCount = count
  const badge = document.getElementById('messages-badge')
  if (!badge) return
  badge.textContent = count > 9 ? '9+' : count
  badge.style.display = count > 0 ? 'inline-flex' : 'none'
}

// ── Realtime subscription ─────────────────────────────────────────────────────
function subscribeToNewMessages() {
  const handle = getCurrentHandle()
  if (!handle) return
  if (realtimeChannel) realtimeChannel.unsubscribe()

  realtimeChannel = sb.channel('messages-global')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, async (payload) => {
      const msg = payload.new
      if (msg.sender_handle.toLowerCase() === handle.toLowerCase()) return
      // Check if this message is in one of our conversations
      const { data: convo } = await sb.from('conversations')
        .select('participant_a, participant_b')
        .eq('id', msg.conversation_id)
        .maybeSingle()
      if (!convo) return
      const isParticipant = convo.participant_a.toLowerCase() === handle.toLowerCase()
        || convo.participant_b.toLowerCase() === handle.toLowerCase()
      if (!isParticipant) return

      // If chat is open for this conversation, render new message immediately
      if (activeConversationId === msg.conversation_id) {
        appendMessage(msg, false)
        markConversationRead(msg.conversation_id)
      } else {
        // Otherwise bump unread badge
        setUnreadBadge(unreadCount + 1)
        showToast(`// NEW MESSAGE FROM ${msg.sender_handle.toUpperCase()}`)
      }
      // Refresh inbox if it's open
      const inbox = document.getElementById('inbox-list')
      if (inbox) renderInbox()
    })
    .subscribe()
}

// ── Start or open a conversation ──────────────────────────────────────────────
export async function startConversation(otherHandle, listingId = null) {
  console.log('startConversation called with:', otherHandle)
  console.log('myHandle:', getCurrentHandle())
  const myHandle = getCurrentHandle()
  if (!myHandle) { showToast('// LOGIN REQUIRED TO MESSAGE'); return }
  if (otherHandle.toLowerCase() === myHandle.toLowerCase()) { showToast('// CANNOT MESSAGE YOURSELF'); return }

  // Check if blocked
  try {
    const { data: block } = await sb.from('blocks')
      .select('id')
      .or(`and(blocker_handle.eq.${myHandle},blocked_handle.eq.${otherHandle}),and(blocker_handle.eq.${otherHandle},blocked_handle.eq.${myHandle})`)
      .maybeSingle()
    if (block) { showToast('// MESSAGING UNAVAILABLE'); return }
  } catch (e) { console.error('Block check error:', e) }

  // Normalize participant order so duplicate convos can't be created
  const [pA, pB] = [myHandle, otherHandle].sort()

  try {
    // Upsert conversation
    const { data, error } = await sb.from('conversations')
      .upsert({ participant_a: pA, participant_b: pB, listing_id: listingId || null },
               { onConflict: 'participant_a,participant_b' })
      .select()
      .single()
    if (error) throw error

    // Un-clear if previously cleared
    const isA = data.participant_a.toLowerCase() === myHandle.toLowerCase()
    const clearField = isA ? 'cleared_by_a' : 'cleared_by_b'
    await sb.from('conversations').update({ [clearField]: false }).eq('id', data.id)

    openMessagesTab()
    openChat(data.id, otherHandle)
  } catch (e) {
    console.error('Start conversation error:', e)
    showToast('// ERROR: Could not open conversation')
  }
}

// ── Open messages tab ─────────────────────────────────────────────────────────
export function openMessagesTab() {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'))
  document.getElementById('tab-btn-messages')?.classList.add('active')
  document.getElementById('tab-browse').style.display = 'none'
  document.getElementById('tab-my-posts').style.display = 'none'
  document.getElementById('tab-messages').style.display = 'block'
  refreshUnreadCount()
  renderInbox()
}

// ── Inbox ─────────────────────────────────────────────────────────────────────
export async function renderInbox() {
  const container = document.getElementById('tab-messages')
  if (!container) return
  const handle = getCurrentHandle()
  if (!handle) {
    container.innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#5a7a9a">[ LOGIN REQUIRED ]</div>'
    return
  }

  container.innerHTML = `
    <div style="padding:16px 0">
      <div style="font-family:\'Share Tech Mono\',monospace;font-size:10px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;margin-bottom:16px">// Inbox</div>
      <div id="inbox-list"><div style="padding:40px;text-align:center;font-family:monospace;color:#5a7a9a;letter-spacing:1px">[ LOADING... ]</div></div>
    </div>`

  try {
    const { data: convos, error } = await sb.from('conversations')
      .select('*')
      .or(`participant_a.eq.${handle},participant_b.eq.${handle}`)
      .order('last_message_at', { ascending: false })
    if (error) throw error

    conversations = convos || []

    // Filter out cleared ones
    const visible = conversations.filter(c => {
      const isA = c.participant_a.toLowerCase() === handle.toLowerCase()
      return isA ? !c.cleared_by_a : !c.cleared_by_b
    })

    const list = document.getElementById('inbox-list')
    if (!visible.length) {
      list.innerHTML = '<div style="padding:40px;text-align:center;font-family:\'Share Tech Mono\',monospace;font-size:11px;color:#5a7a9a;letter-spacing:1px">[ NO MESSAGES YET ]<br><br><span style="font-size:10px">Message a pilot from their profile or listing</span></div>'
      return
    }

    // Load last message and unread count for each
    const rows = await Promise.all(visible.map(async c => {
      const other = c.participant_a.toLowerCase() === handle.toLowerCase() ? c.participant_b : c.participant_a
      const [lastMsgRes, unreadRes] = await Promise.all([
        sb.from('messages').select('body,sender_handle,created_at').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1),
        sb.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', c.id).eq('read', false).neq('sender_handle', handle)
      ])
      return { convo: c, other, lastMsg: lastMsgRes.data?.[0], unread: unreadRes.count || 0 }
    }))

    list.innerHTML = rows.map(({ convo, other, lastMsg, unread }) => `
      <div onclick="openChat('${convo.id}','${other}')" style="display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--border);background:var(--bg2);margin-bottom:8px;cursor:pointer;transition:all 0.15s;position:relative"
        onmouseover="this.style.borderColor='var(--border-bright)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border-bright);background:rgba(79,168,232,0.1);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',monospace;font-size:11px;font-weight:700;color:var(--accent);flex-shrink:0">
          ${other.slice(0,2).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-family:'Share Tech Mono',monospace;font-size:11px;color:var(--text-bright);letter-spacing:0.5px">${other}</span>
            <span style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim)">${lastMsg ? timeAgo(lastMsg.created_at) : ''}</span>
          </div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${lastMsg ? (lastMsg.sender_handle.toLowerCase() === handle.toLowerCase() ? 'You: ' : '') + lastMsg.body : 'No messages yet'}
          </div>
        </div>
        ${unread > 0 ? `<div style="width:18px;height:18px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--bg);font-weight:700;flex-shrink:0">${unread}</div>` : ''}
      </div>`).join('')
  } catch (e) {
    console.error('Inbox error:', e)
    document.getElementById('inbox-list').innerHTML = '<div style="padding:40px;text-align:center;font-family:monospace;color:#e84f4f">[ ERROR LOADING MESSAGES ]</div>'
  }
}

// ── Chat thread ───────────────────────────────────────────────────────────────
export async function openChat(conversationId, otherHandle) {
  activeConversationId = conversationId
  const handle = getCurrentHandle()
  const container = document.getElementById('tab-messages')
  if (!container) return

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 120px)">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);margin-bottom:0;flex-shrink:0">
        <button onclick="renderInbox()" style="background:none;border:none;color:var(--accent);font-size:18px;cursor:pointer;padding:4px 8px;font-family:'Share Tech Mono',monospace">←</button>
        <div onclick="openProfile('${otherHandle}')" style="cursor:pointer;font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:var(--text-bright);letter-spacing:1px">${otherHandle}</div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button onclick="clearConversation('${conversationId}')" style="background:none;border:1px solid var(--border);color:var(--text-dim);font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;padding:4px 8px;cursor:pointer">CLEAR</button>
          <button onclick="blockUser('${otherHandle}')" style="background:none;border:1px solid var(--danger);color:var(--danger);font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;padding:4px 8px;cursor:pointer">BLOCK</button>
        </div>
      </div>
      <!-- Messages -->
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding:12px 0;display:flex;flex-direction:column;gap:8px">
        <div style="text-align:center;font-family:monospace;color:#5a7a9a;font-size:11px">[ LOADING... ]</div>
      </div>
      <!-- Input -->
      <div style="flex-shrink:0;padding:12px 0;border-top:1px solid var(--border);display:flex;gap:8px">
        <input id="chat-input" class="form-input" placeholder="Message ${otherHandle}..." style="flex:1" maxlength="500"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage('${conversationId}','${otherHandle}')}" />
        <button onclick="sendMessage('${conversationId}','${otherHandle}')" style="padding:10px 16px;background:var(--accent);border:none;color:var(--bg);font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:1px;cursor:pointer;flex-shrink:0">SEND</button>
      </div>
    </div>`

  await loadMessages(conversationId, handle)
  markConversationRead(conversationId)

  // Subscribe to this specific conversation for real-time
  if (realtimeChannel) realtimeChannel.unsubscribe()
  realtimeChannel = sb.channel(`chat-${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      const msg = payload.new
      if (msg.sender_handle.toLowerCase() !== handle.toLowerCase()) {
        appendMessage(msg, false)
        markConversationRead(conversationId)
      }
    })
    .subscribe()

  // Re-subscribe global after chat closes
  document.getElementById('chat-input')?.focus()
}

async function loadMessages(conversationId, handle) {
  const container = document.getElementById('chat-messages')
  if (!container) return
  try {
    const { data, error } = await sb.from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (error) throw error
    if (!data?.length) {
      container.innerHTML = '<div style="text-align:center;font-family:\'Share Tech Mono\',monospace;font-size:10px;color:#5a7a9a;padding:20px">[ START OF CONVERSATION ]</div>'
      return
    }
    container.innerHTML = data.map(m => renderMessage(m, m.sender_handle.toLowerCase() === handle.toLowerCase())).join('')
    container.scrollTop = container.scrollHeight
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;font-family:monospace;color:#e84f4f">[ ERROR LOADING MESSAGES ]</div>'
  }
}

function renderMessage(msg, isMine) {
  return `
    <div style="display:flex;justify-content:${isMine ? 'flex-end' : 'flex-start'};padding:0 4px">
      <div style="max-width:75%;padding:8px 12px;background:${isMine ? 'var(--accent)' : 'var(--bg3)'};color:${isMine ? 'var(--bg)' : 'var(--text)'};border-radius:2px;border:1px solid ${isMine ? 'transparent' : 'var(--border)'};font-family:'Share Tech Mono',monospace;font-size:11px;line-height:1.5">
        <div>${escapeHtml(msg.body)}</div>
        <div style="font-size:9px;color:${isMine ? 'rgba(0,0,0,0.4)' : 'var(--text-dim)'};margin-top:4px;text-align:right">${timeAgo(msg.created_at)}</div>
      </div>
    </div>`
}

function appendMessage(msg, isMine) {
  const container = document.getElementById('chat-messages')
  if (!container) return
  const handle = getCurrentHandle()
  const mine = isMine !== undefined ? isMine : msg.sender_handle.toLowerCase() === handle.toLowerCase()
  container.insertAdjacentHTML('beforeend', renderMessage(msg, mine))
  container.scrollTop = container.scrollHeight
}

export async function sendMessage(conversationId, otherHandle) {
  const input = document.getElementById('chat-input')
  const body = input?.value?.trim()
  if (!body) return
  const handle = getCurrentHandle()
  if (!handle) return
  input.value = ''
  try {
    const { data, error } = await sb.from('messages').insert({
      conversation_id: conversationId,
      sender_handle: handle,
      body,
      read: false
    }).select().single()
    if (error) throw error
    appendMessage(data, true)
    // Update last_message_at on conversation
    await sb.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId)
  } catch (e) {
    console.error('Send message error:', e)
    showToast('// ERROR: Could not send message')
    if (input) input.value = body
  }
}
window.sendMessage = sendMessage

async function markConversationRead(conversationId) {
  const handle = getCurrentHandle()
  if (!handle) return
  try {
    await sb.from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .eq('read', false)
      .neq('sender_handle', handle)
    setUnreadBadge(Math.max(0, unreadCount - 1))
  } catch (e) { console.error('Mark read error:', e) }
}

// ── Clear conversation ────────────────────────────────────────────────────────
export async function clearConversation(conversationId) {
  if (!confirm('Clear this conversation? It will be removed from your inbox.')) return
  const handle = getCurrentHandle()
  const convo = conversations.find(c => c.id === conversationId)
    || (await sb.from('conversations').select('*').eq('id', conversationId).single()).data
  if (!convo) return
  const isA = convo.participant_a.toLowerCase() === handle.toLowerCase()
  const field = isA ? 'cleared_by_a' : 'cleared_by_b'
  try {
    await sb.from('conversations').update({ [field]: true }).eq('id', conversationId)
    activeConversationId = null
    if (realtimeChannel) realtimeChannel.unsubscribe()
    subscribeToNewMessages()
    showToast('// CONVERSATION CLEARED')
    renderInbox()
  } catch (e) { showToast('// ERROR: Could not clear conversation') }
}
window.clearConversation = clearConversation

// ── Block ─────────────────────────────────────────────────────────────────────
export async function blockUser(blockedHandle) {
  if (!confirm(`Block ${blockedHandle}? They won't be able to message you.`)) return
  const handle = getCurrentHandle()
  try {
    await sb.from('blocks').insert({ blocker_handle: handle, blocked_handle: blockedHandle })
    showToast(`// ${blockedHandle.toUpperCase()} BLOCKED`)
    renderInbox()
  } catch (e) { showToast('// ERROR: Could not block user') }
}
window.blockUser = blockUser

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
