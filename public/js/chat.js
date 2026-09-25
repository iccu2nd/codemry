let chatOther = null
let chatPoll = null
let lastMsgId = null

async function ensureAuth() {
  if (typeof refreshAuth === 'function') {
    await refreshAuth()
  }
  return me
}

async function renderChat() {
  const app = document.getElementById('chatApp')
  if (!app) return
  app.innerHTML = `<div class="card"><div class="muted" style="text-align:center;padding:24px">Loading…</div></div>`
  await ensureAuth()
  if (!me) {
    app.innerHTML = `<div class="card">${emptyStateHtml({
      title: 'Sign in to message',
      sub: 'Private messages between Codery users.'
    })}<a class="btn btn-primary btn-block" href="/auth" style="margin-top:14px">Sign in</a></div>`
    return
  }
  const withUser = typeof qs === 'function' ? qs('u') : new URLSearchParams(location.search).get('u')
  if (withUser) return openThread(withUser)
  await renderInbox()
}

async function renderInbox() {
  const app = document.getElementById('chatApp')
  app.innerHTML = `<div class="card"><div class="section-label">Messages</div><div id="chatInbox">${typeof skelBlock === 'function' ? skelBlock(80, 16) : 'Loading…'}</div></div>`
  try {
    const list = await api('/chat/conversations')
    const el = document.getElementById('chatInbox')
    if (!list.length) {
      el.innerHTML = emptyStateHtml({
        title: 'No messages yet',
        sub: 'Open a profile and tap Message to start a chat.'
      })
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
    const el = document.getElementById('chatInbox')
    if (el) el.innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`
  }
}

async function openThread(username) {
  const app = document.getElementById('chatApp')
  chatOther = username
  app.innerHTML = `
    <div class="card chat-thread-card">
      <div class="chat-thread-head">
        <a href="/chat" class="chat-back" aria-label="Back">←</a>
        <a href="${profileUrl(username)}" class="chat-thread-user">@${escapeHtml(username)}</a>
      </div>
      <div class="chat-messages" id="chatMessages"><div class="muted" style="text-align:center;padding:16px">Loading…</div></div>
      <form class="chat-compose" id="chatForm">
        <input id="chatInput" type="text" maxlength="2000" placeholder="Write a message…" autocomplete="off" enterkeyhint="send">
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
        await api('/chat/with/' + encodeURIComponent(username), {
          method: 'POST',
          body: JSON.stringify({ text })
        })
        input.value = ''
        await loadMessages(true)
      } catch (err) {
        toast(err.message)
      }
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
    if (!msgs.length) {
      box.innerHTML = `<div class="muted" style="text-align:center;padding:20px">Say hello 👋</div>`
      return
    }
    box.innerHTML = msgs.map(m => {
      const mine = me && m.from === me.username
      return `<div class="chat-bubble ${mine ? 'mine' : 'theirs'}"><div class="chat-bubble-text">${escapeHtml(m.text)}</div><div class="chat-bubble-time">${timeAgo(m.createdAt)}</div></div>`
    }).join('')
    if (scrollBottom) box.scrollTop = box.scrollHeight
  } catch (e) {
    toast(e.message)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderChat()
})
window.addEventListener('beforeunload', () => {
  if (chatPoll) clearInterval(chatPoll)
})
