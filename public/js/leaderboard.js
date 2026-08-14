
const LB_TABS = [
  { key: 'topUploaders', label: 'Top Upload', unit: 'kode' },
  { key: 'topLiked', label: 'Paling Disukai', unit: 'suka' },
  { key: 'topFollowed', label: 'Top Followers', unit: 'followers' }
]

function trophyIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a2 2 0 0 0 0 4h.5M17 5h3a2 2 0 0 1 0 4h-.5"/></svg>`
}

function medalHtml(rank) {
  if (rank > 3) return `<span class="lb-rank">${rank}</span>`
  const tier = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'
  return `<span class="lb-medal lb-medal-${tier}" title="Peringkat ${rank}">${trophyIconSvg()}</span>`
}

function lbRowHtml(row, rank, unit) {
  return `
  <a class="lb-row" href="${profileUrl(row.username)}">
    ${medalHtml(rank)}
    <img class="avatar-circle avatar-circle-sm" src="${row.avatar || ''}" onerror="this.style.visibility='hidden'" loading="lazy" decoding="async">
    <div class="lb-row-info">
      <div class="snippet-uploader">${escapeHtml(row.nickname)}${badgesHtml(row.badges)}${devBadgeHtml(row.isDeveloper)}${roleBadgeHtml(row.role)}</div>
      <div class="snippet-meta">@${escapeHtml(row.username)}</div>
    </div>
    <div class="lb-row-value">${row.value} <span>${unit}</span></div>
  </a>`
}

async function renderLeaderboard() {
  const app = document.getElementById('app')
  try {
    const data = await api('/users/leaderboard')
    let activeKey = LB_TABS[0].key

    function draw() {
      const tab = LB_TABS.find(t => t.key === activeKey)
      const rows = data[activeKey] || []
      app.innerHTML = `
        <div class="card">
          <div class="hero-title" style="font-size:22px">Leaderboard</div>
          <div class="hero-rule"></div>
          <div class="lb-tabs">
            ${LB_TABS.map(t => `<button type="button" class="lb-tab-btn ${t.key === activeKey ? 'active' : ''}" data-key="${t.key}">${t.label}</button>`).join('')}
          </div>
          ${rows.length
            ? rows.map((row, i) => lbRowHtml(row, i + 1, tab.unit)).join('')
            : `<div class="empty-state">Belum ada data. Jadi yang pertama upload!</div>`}
        </div>
      `
      app.querySelectorAll('.lb-tab-btn').forEach(btn => {
        btn.onclick = () => { activeKey = btn.dataset.key; draw() }
      })
    }
    draw()
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

refreshAuth()
renderLeaderboard()
