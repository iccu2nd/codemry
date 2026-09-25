let chatOther = null
let chatPoll = null
let lastMsgId = null
let chatOtherMeta = null
let chatMsgsById = {}
let replyTarget = null

async function ensureAuth() {
  if (typeof refreshAuth === 'function') await refreshAuth()
  return me
}

async function renderChat() {
  const app = document.getElementById('chatApp')
  if (!app) return
  document.body.classList.remove('chat-thread-mode')
  replyTarget = null
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
  const brand = document.querySelector('.topbar .brand')
  if (brand) brand.textContent = 'Messages'
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

function chatTicksSvg(read) {
  const paths = `<path d="M11.1 1.1 5.4 7.3 2.9 4.8 1.8 5.9l3.6 3.6 6.8-7.3z" fill="currentColor"/><path d="M14.2 1.1 8.5 7.3 7.6 6.4 6.5 7.5l2 2 6.8-7.3z" fill="currentColor"/>`
  if (read) {
    return `<span class="chat-ticks is-read" title="Read"><svg viewBox="0 0 16 11" fill="none">${paths}</svg></span>`
  }
  return `<span class="chat-ticks is-sent" title="Sent"><svg viewBox="0 0 16 11" fill="none">${paths}</svg></span>`
}

function replyAuthorLabel(from) {
  if (!from) return 'User'
  if (me && from === me.username) return 'You'
  if (chatOtherMeta && from === chatOtherMeta.username) return chatOtherMeta.nickname || from
  return from
}

function replyQuoteHtml(reply) {
  if (!reply) return ''
  const who = escapeHtml(replyAuthorLabel(reply.from))
  const body = reply.stickerUrl && !reply.text
    ? 'Sticker'
    : escapeHtml(String(reply.text || '').slice(0, 80) || 'Message')
  return `<div class="chat-reply-quote" data-reply-id="${escapeHtml(reply.id || '')}">
    <div class="chat-reply-accent"></div>
    <div class="chat-reply-body">
      <div class="chat-reply-author">${who}</div>
      <div class="chat-reply-snippet">${body}</div>
    </div>
  </div>`
}

function bubbleHtml(m) {
  const mine = !!(me && m.from === me.username)
  const sticker = m.stickerUrl
    ? `<img class="chat-sticker" src="${escapeHtml(m.stickerUrl)}" alt="sticker" loading="lazy">`
    : ''
  const text = m.text
    ? `<div class="chat-bubble-text">${escapeHtml(m.text)}</div>`
    : ''
  const ticks = mine ? chatTicksSvg(!!m.read) : ''
  const quote = m.replyTo ? replyQuoteHtml(m.replyTo) : ''
  return `<div class="chat-row ${mine ? 'is-mine' : 'is-theirs'}" data-msg-id="${escapeHtml(m.id)}">
    <div class="chat-swipe-hint" aria-hidden="true"><i class="fa-solid fa-reply"></i></div>
    <div class="chat-bubble ${mine ? 'mine' : 'theirs'}${sticker && !m.text ? ' is-sticker' : ''}">
      ${quote}
      ${sticker}${text}
      <div class="chat-bubble-meta">
        <span class="chat-bubble-time">${timeAgo(m.createdAt)}</span>
        ${ticks}
      </div>
    </div>
  </div>`
}

function setReplyTarget(msg) {
  if (!msg) {
    replyTarget = null
    renderReplyBar()
    return
  }
  replyTarget = {
    id: msg.id,
    from: msg.from,
    text: msg.text || '',
    stickerUrl: msg.stickerUrl || null
  }
  renderReplyBar()
  const input = document.getElementById('chatInput')
  if (input) input.focus()
}

function renderReplyBar() {
  const bar = document.getElementById('chatReplyBar')
  if (!bar) return
  if (!replyTarget) {
    bar.hidden = true
    bar.innerHTML = ''
    return
  }
  bar.hidden = false
  bar.innerHTML = `
    ${replyQuoteHtml(replyTarget)}
    <button type="button" class="chat-reply-cancel" id="chatReplyCancel" aria-label="Cancel reply">×</button>`
  document.getElementById('chatReplyCancel').onclick = () => setReplyTarget(null)
}

function wireBubbleActions(container) {
  if (!container) return

  container.querySelectorAll('.chat-reply-quote[data-reply-id]').forEach(q => {
    q.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = q.getAttribute('data-reply-id')
      const target = container.querySelector(`.chat-row[data-msg-id="${CSS.escape(id)}"]`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.classList.add('chat-row-flash')
        setTimeout(() => target.classList.remove('chat-row-flash'), 900)
      }
    })
  })

  container.querySelectorAll('.chat-row[data-msg-id]').forEach(row => {
    let startX = 0
    let startY = 0
    let dragging = false
    const bubble = row.querySelector('.chat-bubble')
    const hint = row.querySelector('.chat-swipe-hint')

    const reset = () => {
      dragging = false
      if (bubble) bubble.style.transform = ''
      if (hint) hint.style.opacity = '0'
      row.classList.remove('is-swiping')
    }

    row.addEventListener('touchstart', (e) => {
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      dragging = true
    }, { passive: true })

    row.addEventListener('touchmove', (e) => {
      if (!dragging) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
        reset()
        return
      }
      // swipe right to reply
      if (dx > 0) {
        const shift = Math.min(dx, 72)
        if (bubble) bubble.style.transform = `translateX(${shift}px)`
        if (hint) hint.style.opacity = String(Math.min(shift / 56, 1))
        row.classList.add('is-swiping')
      }
    }, { passive: true })

    row.addEventListener('touchend', (e) => {
      if (!dragging) return
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      reset()
      if (dx > 56 && Math.abs(dy) < 40) {
        const id = row.getAttribute('data-msg-id')
        const msg = chatMsgsById[id]
        if (msg) setReplyTarget(msg)
      }
    })

    // desktop: double-click
    row.addEventListener('dblclick', () => {
      const id = row.getAttribute('data-msg-id')
      const msg = chatMsgsById[id]
      if (msg) setReplyTarget(msg)
    })
  })
}

async function openThread(username) {
  const app = document.getElementById('chatApp')
  chatOther = username
  replyTarget = null
  document.body.classList.add('chat-thread-mode')

  app.innerHTML = `
    <div class="chat-wa" id="chatWa">
      <div class="chat-wa-head">
        <a href="/chat" class="chat-back" aria-label="Back">←</a>
        <a href="${profileUrl(username)}" class="chat-wa-user" id="chatWaUser">
          <span class="chat-wa-name">@${escapeHtml(username)}</span>
        </a>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-messages-inner" id="chatMessagesInner">
          <div class="muted" style="text-align:center;padding:16px">Loading…</div>
        </div>
      </div>
      <div class="chat-reply-bar" id="chatReplyBar" hidden></div>
      <form class="chat-compose" id="chatForm">
        <button type="button" class="chat-sticker-btn" id="chatStickerBtn" aria-label="Sticker">
          <i class="fa-regular fa-face-smile" aria-hidden="true"></i>
        </button>
        <textarea id="chatInput" rows="1" maxlength="2000" placeholder="Message" autocomplete="off" enterkeyhint="send"></textarea>
        <button type="submit" class="chat-send-btn" id="chatSend" aria-label="Send">
          <i class="fa-solid fa-paper-plane" aria-hidden="true"></i>
        </button>
      </form>
    </div>`

  const input = document.getElementById('chatInput')
  if (input && typeof autoGrowTextarea === 'function') {
    autoGrowTextarea(input)
    input.addEventListener('input', () => autoGrowTextarea(input))
  }
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      document.getElementById('chatForm')?.requestSubmit()
    }
    if (e.key === 'Escape') setReplyTarget(null)
  })

  document.getElementById('chatStickerBtn').onclick = async () => {
    if (typeof openStickerPicker !== 'function') {
      toast('Sticker picker unavailable')
      return
    }
    const url = await openStickerPicker()
    if (!url) return
    await sendChatPayload({ stickerUrl: url })
  }

  document.getElementById('chatForm').onsubmit = async (e) => {
    e.preventDefault()
    const text = (document.getElementById('chatInput')?.value || '').trim()
    if (!text) return
    await sendChatPayload({ text })
  }

  await loadMessages(true)
  if (chatPoll) clearInterval(chatPoll)
  chatPoll = setInterval(() => loadMessages(false), 3000)
}

async function sendChatPayload(payload) {
  if (!chatOther) return
  const btn = document.getElementById('chatSend')
  const input = document.getElementById('chatInput')
  const body = { ...payload }
  if (replyTarget?.id) body.replyToId = replyTarget.id
  await withBtnLoading(btn, async () => {
    try {
      await api('/chat/with/' + encodeURIComponent(chatOther), {
        method: 'POST',
        body: JSON.stringify(body)
      })
      if (payload.text && input) {
        input.value = ''
        if (typeof autoGrowTextarea === 'function') autoGrowTextarea(input)
      }
      setReplyTarget(null)
      await loadMessages(true)
    } catch (err) {
      toast(err.message)
    }
  })
}

async function loadMessages(scrollBottom) {
  if (!chatOther) return
  try {
    const data = await api('/chat/with/' + encodeURIComponent(chatOther))
    const box = document.getElementById('chatMessages')
    const inner = document.getElementById('chatMessagesInner')
    if (!box || !inner) return

    if (data.other) {
      chatOtherMeta = data.other
      const userEl = document.getElementById('chatWaUser')
      if (userEl) {
        userEl.innerHTML = `
          ${avatarHtml(data.other.avatar, data.other.nickname || data.other.username, 'avatar-circle-xs')}
          <span class="chat-wa-name">${escapeHtml(data.other.nickname || data.other.username)}</span>
          <span class="chat-wa-handle">@${escapeHtml(data.other.username)}</span>`
      }
    }

    const msgs = data.messages || []
    chatMsgsById = {}
    msgs.forEach(m => { if (m.id) chatMsgsById[m.id] = m })

    const last = msgs[msgs.length - 1]
    const newId = last?.id
    if (!scrollBottom && newId && newId === lastMsgId) return
    lastMsgId = newId || null

    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 100

    if (!msgs.length) {
      inner.innerHTML = `<div class="chat-empty">Say hello 👋<br><small>Geser pesan ke kanan untuk membalas</small></div>`
    } else {
      inner.innerHTML = msgs.map(bubbleHtml).join('')
      wireBubbleActions(inner)
    }

    if (scrollBottom || nearBottom) {
      requestAnimationFrame(() => { box.scrollTop = box.scrollHeight })
    }
  } catch (e) {
    toast(e.message)
  }
}

document.addEventListener('DOMContentLoaded', () => { renderChat() })
window.addEventListener('beforeunload', () => { if (chatPoll) clearInterval(chatPoll) })
