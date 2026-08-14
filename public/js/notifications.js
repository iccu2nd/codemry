
function notifIconSvg(type) {
  if (type === 'like') return `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12.001 4.529c2.349-2.532 6.155-2.532 8.504 0 2.35 2.532 2.35 6.638 0 9.17l-8.201 8.3a.42.42 0 0 1-.606 0l-8.201-8.3c-2.35-2.532-2.35-6.638 0-9.17 2.349-2.532 6.155-2.532 8.504 0z"/></svg>`
  if (type === 'comment') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`
  if (type === 'reply') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`
  if (type === 'follow') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/><path d="M20.5 21a6.5 6.5 0 0 0-13 0"/></svg>`
  if (type === 'fork') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M6 8.5V12a4 4 0 0 0 4 4M18 8.5V12a4 4 0 0 0-4 4"/></svg>`
  if (type === 'upload') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`
}

function notifTargetUrl(n) {
  if (n.shortId) return codeUrl(n.shortId)
  if (n.type === 'follow') return profileUrl(n.fromUsername)
  return '#'
}

function notifItemHtml(n) {
  return `
  <a class="notif-item ${n.read ? '' : 'unread'}" href="${notifTargetUrl(n)}" data-id="${n.id}">
    <img class="avatar-circle avatar-circle-sm" src="${n.fromAvatar || ''}" onerror="this.style.visibility='hidden'" loading="lazy">
    <span class="notif-icon notif-icon-${n.type}">${notifIconSvg(n.type)}</span>
    <div class="notif-body">
      <div class="notif-text"><b>${escapeHtml(n.fromNickname || n.fromUsername)}</b> ${escapeHtml(n.text)}${n.snippetTitle ? ` <span class="notif-target">"${escapeHtml(n.snippetTitle)}"</span>` : ''}</div>
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
    container.innerHTML = list.length
      ? `<div id="notifList">${list.map(notifItemHtml).join('')}</div>`
      : `<div class="card"><div class="empty-state">Belum ada notifikasi. Kalau ada yang suka, komentar, balas, follow, atau upload kode baru, bakal muncul di sini.</div></div>`

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
    container.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

init()
