
async function renderFollowList() {
  const app = document.getElementById('app')
  const username = qs('u')
  const kind = qs('type') === 'following' ? 'following' : 'followers'
  if (!username) { app.innerHTML = `<div class="card">${emptyStateHtml({ mascot: 'notFound', title: 'User not found' })}</div>`; return }
  try {
    const list = await api(`/users/${username}/${kind}`)
    app.innerHTML = `
      <div class="card">
        <div class="hero-title" style="font-size:20px">${kind === 'followers' ? 'Followers' : 'Following'} @${escapeHtml(username)}</div>
        <div class="hero-rule"></div>
        ${list.length ? list.map(u => `
          <a class="btn btn-white btn-block" style="margin-bottom:10px;justify-content:flex-start;gap:10px" href="${profileUrl(u.username)}">
            ${avatarHtml(u.avatar, u.nickname || u.username, 'avatar-circle-sm')} @${escapeHtml(u.username)}
          </a>
        `).join('') : `${emptyStateHtml({ mascot: 'emptyFeed', title: 'Nothing here yet' })}`}
      </div>
    `
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyStateHtml({ mascot: 'error', title: escapeHtml(e.message) })}</div>`
  }
}

refreshAuth()
renderFollowList()
