let chatOther = null
let chatPoll = null
let lastMsgId = null

async function renderChat() {
  const app = document.getElementById('chatApp')
  if (!app) return
  await (window.authReady || Promise.resolve())
  if (!me) {
    app.innerHTML = `<div class="card">${emptyStateHtml({ title: 'Sign in to message', sub: 'Private messages between Codery users.' })}</div>`
    return
  }
  const withUser = qs('u')
  if (withUser) return openThread(withUser)
  await renderInbox()
}

async function renderInbox() {
  const app = document.getElementById('chatApp')
  app.innerHTML = `<div class="card"><div class="section-label">Messages</div><div id="chatInbox">${skelBlock(80, 16)}</div></div>`
  try {
    const list = await api('/chat/conversations')
    const el = document.getElementById('chatInbox')
    if (!list.length) {
      el.innerHTML = emptyStateHtml({ title: 'No messages yet', sub: 'Open a profile and tap Message to start.' })
      return
    }
    el.innerHTML = list.map(c => `
      <a class="chat-inbox-item ${c.unread ? 'unread' : ''}" href="/chat?u=${encodeURIComponent(c.otherUsername)}">
        ${avatarHtml(c.otherAvatar, c.otherNickname || c.otherUsername, 'avatar-circle-sm')}
        <div class="chat-inbox-body">
          <div class="chat-inbox-name">${escapeHtml(c.otherNickname || c.otherUsername)} <span class="chat-inbox-user">@${escapeHtml(c.otherUsername)}</span></div>
          <div class="chat-inbox-preview">${escapeHtml(c.lastText || '')}</div>
        </div>
        <div class="chat-inbox-meta">${timeAgo(c.lastAt)}</div>
      </a>
    `).join('')
  } catch (e) {
    document.getElementById('chatInbox').innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`
  }
}

async function openThread(username) {
  const app = document.getElementById('chatApp')
  chatOther = username
  app.innerHTML = `
    <div class="card chat-thread-card">
      <div class="chat-thread-head">
        <a href="/chat" class="chat-back">←</a>
        <a href="${profileUrl(username)}" class="chat-thread-user">@${escapeHtml(username)}</a>
      </div>
      <div class="chat-messages" id="chatMessages"></div>
      <form class="chat-compose" id="chatForm">
        <input id="chatInput" type="text" maxlength="2000" placeholder="Write a message…" autocomplete="off">
        <button type="submit" class="btn btn-primary btn-sm" id="chatSend">Send</button>
      </form>
    </div>`
  await loadMessages(true)
  document.getElementById('chatForm').onsubmit = async (e) => {
    e.preventDefault()
    const input = document.getElementById('chatInput')
    const text = (input.value || '').trim()
    if (!text) return
    const btn = document.getElementById('chatSend')
    await withBtnLoading(btn, async () => {
      try {
        await api('/chat/with/' + encodeURIComponent(username), { method: 'POST', body: JSON.stringify({ text }) })
        input.value = ''
        await loadMessages(false)
      } catch (err) { toast(err.message) }
    })
  }
  if (chatPoll) clearInterval(chatPoll)
  chatPoll = setInterval(() => loadMessages(false), 3000)
}

async function loadMessages(scrollBottom) {
  if (!chatOther) return
  try {
    const data = await api('/chat/with/' + encodeURIComponent(chatOther))
    const box = document.getElementById('chatMessages')
    if (!box) return
    const msgs = data.messages || []
    const last = msgs[msgs.length - 1]
    const newId = last?.id
    if (!scrollBottom && newId && newId === lastMsgId) return
    lastMsgId = newId || null
    box.innerHTML = msgs.map(m => {
      const mine = me && m.from === me.username
      return `<div class="chat-bubble ${mine ? 'mine' : 'theirs'}"><div class="chat-bubble-text">${escapeHtml(m.text)}</div><div class="chat-bubble-time">${timeAgo(m.createdAt)}</div></div>`
    }).join('')
    if (scrollBottom || true) box.scrollTop = box.scrollHeight
  } catch (e) {
    toast(e.message)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderChat()
})
window.addEventListener('beforeunload', () => { if (chatPoll) clearInterval(chatPoll) })
