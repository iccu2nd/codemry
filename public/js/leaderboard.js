const LB_TABS = [
  { key: 'topUploaders', label: 'Top Upload', unit: 'codes', icon: 'upload' },
  { key: 'topLiked', label: 'Most Liked', unit: 'likes', icon: 'heart' },
  { key: 'topFollowed', label: 'Top Followers', unit: 'followers', icon: 'users' }
]

function trophyIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a2 2 0 0 0 0 4h.5M17 5h3a2 2 0 0 1 0 4h-.5"/></svg>`
}

function medalHtml(rank) {
  if (rank > 3) return `<span class="lb-rank">${rank}</span>`
  const tier = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'
  return `<span class="lb-medal lb-medal-${tier}" title="Rank ${rank}">${trophyIconSvg()}</span>`
}

function lbRowHtml(row, rank, unit) {
  const podium = rank <= 3 ? ` lb-row-top${rank}` : ''
  return `
  <a class="lb-row${podium}" href="${profileUrl(row.username)}">
    ${medalHtml(rank)}
    ${avatarHtml(row.avatar, row.nickname || row.username, 'avatar-circle-sm')}
    <div class="lb-row-info">
      <div class="snippet-uploader">${escapeHtml(row.nickname)}${badgesHtml(row.badges)}${devBadgeHtml(row.isDeveloper)}${roleBadgeHtml(row.role)}</div>
      <div class="snippet-meta">@${escapeHtml(row.username)}</div>
    </div>
    <div class="lb-row-value">${Number(row.value).toLocaleString()} <span>${unit}</span></div>
  </a>`
}

function podiumHtml(rows, unit) {
  if (!rows.length) return ''
  const slots = [rows[1], rows[0], rows[2]].filter(Boolean)
  const ranks = [2, 1, 3]
  return `
  <div class="lb-podium">
    ${slots.map((row, i) => {
      const rank = ranks[i]
      if (!row) return '<div class="lb-podium-slot empty"></div>'
      const tier = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'
      return `
      <a class="lb-podium-slot lb-podium-${tier}" href="${profileUrl(row.username)}">
        <div class="lb-podium-medal">${medalHtml(rank)}</div>
        ${avatarHtml(row.avatar, row.nickname || row.username, rank === 1 ? 'avatar-circle' : 'avatar-circle-sm')}
        <div class="lb-podium-name">${escapeHtml(row.nickname || row.username)}</div>
        <div class="lb-podium-user">@${escapeHtml(row.username)}</div>
        <div class="lb-podium-value">${Number(row.value).toLocaleString()} <span>${unit}</span></div>
      </a>`
    }).join('')}
  </div>`
}

async function renderLeaderboard() {
  const app = document.getElementById('app')
  try {
    const data = await api('/users/leaderboard')
    let activeKey = LB_TABS[0].key

    function draw() {
      const tab = LB_TABS.find(t => t.key === activeKey)
      const rows = data[activeKey] || []
      const top3 = rows.slice(0, 3)
      const rest = rows.slice(3)

      app.innerHTML = `
        <div class="card lb-card">
          <div class="hero-title" style="font-size:22px">Leaderboard</div>
          <div class="hero-rule"></div>
          <div class="hero-sub" style="margin-bottom:14px">Top developers on Codery this season.</div>
          <div class="lb-tabs">
            ${LB_TABS.map(t => `<button type="button" class="lb-tab-btn ${t.key === activeKey ? 'active' : ''}" data-key="${t.key}">${t.label}</button>`).join('')}
          </div>
          ${rows.length ? `
            ${podiumHtml(top3, tab.unit)}
            <div class="lb-list">
              ${rest.map((row, i) => lbRowHtml(row, i + 4, tab.unit)).join('')}
            </div>
          ` : `${emptyStateHtml({ title: 'No data yet', sub: 'Be the first to upload!' })}`}
        </div>
      `
      app.querySelectorAll('.lb-tab-btn').forEach(btn => {
        btn.onclick = () => { activeKey = btn.dataset.key; draw() }
      })
    }
    draw()
  } catch (e) {
    app.innerHTML = `<div class="card">${emptyStateHtml({ title: escapeHtml(e.message) })}</div>`
  }
}

refreshAuth()
renderLeaderboard()
