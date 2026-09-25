function notifIconSvg(type) {
  if (type === 'like') return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5.2c2.1-2.4 5.8-2.6 8.1-.4 2.3 2.2 2.4 5.9.2 8.3L12.6 20.8a.9.9 0 0 1-1.2 0L3.7 13.1c-2.2-2.4-2.1-6.1.2-8.3 2.3-2.2 6-2 8.1.4z"/></svg>`
  if (type === 'comment' || type === 'reply') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  if (type === 'follow') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`
  if (type === 'fork') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M6 8.5V12a4 4 0 0 0 4 4M18 8.5V12a4 4 0 0 0-4 4"/></svg>`
  if (type === 'report') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`
  if (type === 'donate') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`
  if (type === 'upload') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`
}

function notifTargetUrl(n) {
  if (n.shortId) {
    let url = codeUrl(n.shortId)
    const extra = []
    if (n.commentId) extra.push('comment=' + encodeURIComponent(n.commentId))
    if (n.replyId) extra.push('reply=' + encodeURIComponent(n.replyId))
    // Highlight focus area for like/fork/upload too (scroll to code)
    if (n.type === 'like' || n.type === 'fork') extra.push('focus=code')
    if (extra.length) url += (url.includes('?') ? '&' : '?') + extra.join('&')
    return url
  }
  if (n.type === 'donate') return '/notifications'
  if (n.type === 'follow') return profileUrl(n.fromUsername)
  return '#'
}

function notifActionText(n) {
  const map = {
    like: 'liked your code',
    comment: 'commented on your code',
    reply: 'replied to your comment',
    follow: 'started following you',
    donate: n.amount
      ? ('donated Rp ' + Number(n.amount).toLocaleString('id-ID') + (n.message ? ' — ' + String(n.message).slice(0, 60) : ''))
      : 'sent you a donation',
    fork: 'forked your code',
    report: 'reported a code',
    upload: 'uploaded new code'
  }
  return map[n.type] || n.text || 'interacted with you'
}

function notifItemHtml(n) {
  return `
  <a class="notif-item ${n.read ? '' : 'unread'}" href="${notifTargetUrl(n)}" data-id="${n.id}">
    <div class="notif-avatar-wrap">
      ${avatarHtml(n.fromAvatar, n.fromNickname || n.fromUsername, 'avatar-circle-sm')}
      <span class="notif-icon notif-icon-${n.type}">${notifIconSvg(n.type)}</span>
    </div>
    <div class="notif-body">
      <div class="notif-text"><b>${escapeHtml(n.fromNickname || n.fromUsername)}</b> ${escapeHtml(notifActionText(n))}${n.snippetTitle ? ` <span class="notif-target">"${escapeHtml(n.snippetTitle)}"</span>` : ''}</div>
      <div class="notif-time">${timeAgo(n.createdAt)}</div>
    </div>
    ${n.read ? '' : '<span class="notif-unread-dot"></span>'}
  </a>`
}

async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  const container = document.getElementById('notifPage')
  try {
    const list = await api('/notifications')
    const unreadCount = list.filter(n => !n.read).length

    if (!list.length) {
      container.innerHTML = `<div class="card">${emptyStateHtml({ title: 'No notifications yet', sub: 'Likes, comments, follows, and donations will show up here.' })}</div>`
      return
    }

    container.innerHTML = `
      <div class="card notif-card">
        <div class="notif-header">
          <div class="notif-header-left">
            <div class="hero-title" style="font-size:20px;margin:0">Notifications</div>
            ${unreadCount ? `<span class="notif-count-pill">${unreadCount} new</span>` : ''}
          </div>
          ${unreadCount ? `<button type="button" class="btn btn-white btn-sm" id="markAllReadBtn">Mark all read</button>` : ''}
        </div>
        <div class="notif-list" id="notifList">${list.map(notifItemHtml).join('')}</div>
      </div>`

    const markAll = async () => {
      try {
        await api('/notifications/read-all', { method: 'POST' })
        container.querySelectorAll('.notif-item.unread').forEach(el => {
          el.classList.remove('unread')
          el.querySelector('.notif-unread-dot')?.remove()
        })
        document.getElementById('markAllReadBtn')?.remove()
        document.querySelector('.notif-count-pill')?.remove()
        refreshNotifBadge()
      } catch (e) { toast(e.message) }
    }
    document.getElementById('markAllReadBtn')?.addEventListener('click', markAll)

    container.querySelectorAll('.notif-item[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        if (!el.classList.contains('unread')) return
        el.classList.remove('unread')
        el.querySelector('.notif-unread-dot')?.remove()
        api(`/notifications/${el.dataset.id}/read`, { method: 'POST' })
          .then(refreshNotifBadge)
          .catch(() => {})
      })
    })
  } catch (e) {
    container.innerHTML = `<div class="card">${emptyStateHtml({ title: escapeHtml(e.message) })}</div>`
  }
}

init()
