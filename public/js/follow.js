
async function renderFollowList() {
  const app = document.getElementById('app')
  const username = qs('u')
  const kind = qs('type') === 'following' ? 'following' : 'followers'
  if (!username) { app.innerHTML = `<div class="card"><div class="empty-state">User tidak ditemukan.</div></div>`; return }
  try {
    const list = await api(`/users/${username}/${kind}`)
    app.innerHTML = `
      <div class="card">
        <div class="hero-title" style="font-size:20px">${kind === 'followers' ? 'Followers' : 'Following'} @${escapeHtml(username)}</div>
        <div class="hero-rule"></div>
        ${list.length ? list.map(u => `
          <a class="btn btn-white btn-block" style="margin-bottom:10px;justify-content:flex-start;gap:10px" href="${profileUrl(u.username)}">
            <img class="avatar-circle avatar-circle-sm" src="${u.avatar || ''}" onerror="this.style.visibility='hidden'" loading="lazy" decoding="async"> @${escapeHtml(u.username)}
          </a>
        `).join('') : `<div class="empty-state">Belum ada.</div>`}
      </div>
    `
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

refreshAuth()
renderFollowList()
