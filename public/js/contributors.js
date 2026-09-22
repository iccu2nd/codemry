async function renderContributors() {
  const app = document.getElementById('app')
  try {
    const list = await api('/users/contributors')
    app.innerHTML = `
      <div class="card">
        <div class="hero-title" style="font-size:22px">Contributors</div>
        <div class="hero-rule"></div>
        <div class="hero-sub" style="margin-bottom:8px">Developers who actively shape Codery — recognized with the Contributor badge.</div>
        ${list.length
          ? `<div class="contrib-grid">
              ${list.map(u => `
                <a class="contrib-card" href="${profileUrl(u.username)}">
                  ${avatarHtml(u.avatar, u.nickname || u.username, 'avatar-circle')}
                  <div class="contrib-name">${escapeHtml(u.nickname || u.username)}${badgesHtml(u.badges)}</div>
                  <div class="contrib-user">@${escapeHtml(u.username)}</div>
                </a>
              `).join('')}
            </div>`
          : emptyStateHtml({ title: 'No contributors yet', sub: 'Contributor badges are awarded by the team.' })}
      </div>`
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyStateHtml({ title: escapeHtml(e.message) })}</div>`
  }
}

refreshAuth()
renderContributors()
