function notifIconSvg(type) {
  if (type === 'like') return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5.2c2.1-2.4 5.8-2.6 8.1-.4 2.3 2.2 2.4 5.9.2 8.3L12.6 20.8a.9.9 0 0 1-1.2 0L3.7 13.1c-2.2-2.4-2.1-6.1.2-8.3 2.3-2.2 6-2 8.1.4z"/></svg>`
  if (type === 'comment' || type === 'reply' || type === 'message') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  if (type === 'follow') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`
  if (type === 'fork') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M6 8.5V12a4 4 0 0 0 4 4M18 8.5V12a4 4 0 0 0-4 4"/></svg>`
  if (type === 'report') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`
  if (type === 'mention') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`
  if (type === 'donate') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`
  if (type === 'upload') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`
  if (type === 'system') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>`
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`
}

function notifTargetUrl(n) {
  if (n._kind === 'dm') return '/chat?u=' + encodeURIComponent(n.otherUsername || n.fromUsername || '')
  if (n.type === 'message') return '/chat?u=' + encodeURIComponent(n.fromUsername || '')
  if (n.type === 'follow') return profileUrl(n.fromUsername)
  if (n.shortId) {
    let url = codeUrl(n.shortId)
    const extra = []
    if (n.commentId) extra.push('comment=' + encodeURIComponent(n.commentId))
    if (n.replyId) extra.push('reply=' + encodeURIComponent(n.replyId))
    if (n.type === 'like' || n.type === 'fork') extra.push('focus=code')
    if (extra.length) url += (url.includes('?') ? '&' : '?') + extra.join('&')
    return url
  }
  if (n.type === 'donate') return '/notifications'
  return '/notifications'
}

function notifActionText(n) {
  if (n._kind === 'dm') {
    return n.lastText ? String(n.lastText).slice(0, 80) : 'sent a message'
  }
  const map = {
    like: 'liked your code',
    comment: 'commented on your code',
    reply: 'replied to your comment',
    follow: 'started following you',
    fork: 'forked your code',
    upload: 'posted new code',
    report: 'reported a code',
    message: 'sent you a message',
    mention: 'mentioned you',
    donate: n.amount
      ? ('donated Rp ' + Number(n.amount).toLocaleString('id-ID') + (n.message ? ' — ' + String(n.message).slice(0, 40) : ''))
      : 'sent you a donation'
  }
  return map[n.type] || n.text || 'interacted with you'
}

function inboxRowHtml(n) {
  const isDm = n._kind === 'dm'
  const href = notifTargetUrl(n)
  const name = isDm
    ? (n.otherNickname || n.otherUsername || 'User')
    : (n.fromNickname || n.fromUsername || 'Someone')
  const unread = isDm ? !!n.unread : !n.read
  const badge = isDm
    ? (n.unread ? `<span class="inbox-badge">1</span>` : '')
    : (n.read ? '' : `<span class="inbox-dot"></span>`)
  const time = timeAgo(n.createdAt || n.lastAt)
  const avatar = isDm ? n.otherAvatar : n.fromAvatar
  let sub = notifActionText(n)
  if (!isDm && n.snippetTitle) sub += ' “' + n.snippetTitle + '”'

  return `
    <a class="inbox-row ${unread ? 'is-unread' : ''}" href="${href}" data-id="${escapeHtml(n.id || '')}" data-kind="${isDm ? 'dm' : 'notif'}">
      <div class="inbox-avatar-wrap">
        ${avatarHtml(avatar, name, 'avatar-circle-md')}
        <span class="inbox-type-icon notif-icon-${escapeHtml(isDm ? 'message' : (n.type || 'system'))}">${notifIconSvg(isDm ? 'message' : n.type)}</span>
      </div>
      <div class="inbox-body">
        <div class="inbox-line1">
          <span class="inbox-name">${escapeHtml(name)}</span>
        </div>
        <div class="inbox-line2">${escapeHtml(String(sub))} · <span class="inbox-time">${escapeHtml(time)}</span></div>
      </div>
      <div class="inbox-right">
        ${badge}
        ${isDm ? `<span class="inbox-cam" aria-hidden="true"><i class="fa-regular fa-comment"></i></span>` : ''}
      </div>
    </a>`
}

function storyRailHtml(conversations) {
  const items = (conversations || []).slice(0, 12)
  const create = `
    <a class="inbox-story" href="/chat">
      <div class="inbox-story-ring is-create">
        <div class="inbox-story-avatar inbox-story-create"><i class="fa-solid fa-plus"></i></div>
      </div>
      <span class="inbox-story-name">New</span>
    </a>`
  const people = items.map(c => `
    <a class="inbox-story" href="/chat?u=${encodeURIComponent(c.otherUsername)}">
      <div class="inbox-story-ring ${c.unread ? 'has-unread' : ''}">
        ${avatarHtml(c.otherAvatar, c.otherNickname || c.otherUsername, 'inbox-story-avatar')}
        ${c.unread ? '<span class="inbox-story-dot"></span>' : ''}
      </div>
      <span class="inbox-story-name">${escapeHtml((c.otherNickname || c.otherUsername || '').slice(0, 10))}</span>
    </a>`).join('')
  return `<div class="inbox-stories">${create}${people}</div>`
}

async function renderNotifications() {
  const container = document.getElementById('notifPage')
  if (!container) return

  const brand = document.querySelector('.topbar .brand')
  if (brand) brand.textContent = (typeof t === 'function' && t('inbox')) || 'Inbox'

  try {
    if (window.authReady) await window.authReady
    if (!me) {
      container.innerHTML = `<div class="card">${emptyStateHtml({ title: 'Sign in', sub: 'See messages and activity in your inbox.' })}</div>`
      return
    }

    const [notifs, convos] = await Promise.all([
      api('/notifications').catch(() => []),
      api('/chat/conversations').catch(() => [])
    ])

    // Merge DM previews into feed
    const dmRows = (convos || []).map(c => ({
      _kind: 'dm',
      id: 'dm-' + c.otherUsername,
      otherUsername: c.otherUsername,
      otherNickname: c.otherNickname,
      otherAvatar: c.otherAvatar,
      fromUsername: c.otherUsername,
      lastText: c.lastText,
      createdAt: c.lastAt,
      lastAt: c.lastAt,
      unread: !!c.unread
    }))

    const notifRows = (notifs || []).map(n => ({ ...n, _kind: 'notif' }))

    const merged = [...dmRows, ...notifRows].sort((a, b) => {
      const ta = a.createdAt || a.lastAt || 0
      const tb = b.createdAt || b.lastAt || 0
      return tb - ta
    })

    const unreadNotifs = notifRows.filter(n => !n.read).length
    const unreadDms = dmRows.filter(n => n.unread).length

    container.innerHTML = `
      <div class="inbox-page">
        ${storyRailHtml(convos)}
        <div class="inbox-toolbar">
          <div class="inbox-toolbar-title">Activity</div>
          ${(unreadNotifs > 0) ? `<button type="button" class="btn btn-white btn-sm" id="markAllReadBtn">Mark all read</button>` : ''}
        </div>
        <div class="inbox-list" id="inboxList">
          ${merged.length
            ? merged.map(inboxRowHtml).join('')
            : emptyStateHtml({ title: 'Inbox empty', sub: 'Likes, follows, messages, and mentions show up here.' })}
        </div>
      </div>`

    const markBtn = document.getElementById('markAllReadBtn')
    if (markBtn) {
      markBtn.onclick = async () => {
        await withBtnLoading(markBtn, async () => {
          await api('/notifications/read-all', { method: 'POST' })
          renderNotifications()
          if (typeof refreshNotifBadge === 'function') refreshNotifBadge()
        })
      }
    }

    // mark notif read on click
    container.querySelectorAll('.inbox-row[data-kind="notif"][data-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id
        if (!id) return
        api('/notifications/' + encodeURIComponent(id) + '/read', { method: 'POST' }).catch(() => {})
      })
    })
  } catch (e) {
    container.innerHTML = `<div class="card"><p class="muted">${escapeHtml(e.message || 'Failed to load')}</p></div>`
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderNotifications()
})
