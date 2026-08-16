
let allDevUsers = []
let devUsersExpanded = false

async function renderDevPanel() {
  const app = document.getElementById('app')
  if (!me) { app.innerHTML = `<div class="card"><div class="empty-state">Login dulu ya.</div></div>`; return }
  if (!me.isDeveloper) { app.innerHTML = `<div class="card"><div class="empty-state">Halaman ini cuma buat developer.</div></div>`; return }

  app.innerHTML = `
    <div class="card">
      <div class="devpanel-head">
        ${devIconSvg()}
        <div>
          <div class="devpanel-title">Panel Developer</div>
          <div class="snippet-meta">Kelola badge, role, dan pantau statistik Codery.</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="dev-stats-grid" id="devStatsGrid">
        ${skelBlock(70, 16)}${skelBlock(70, 16)}${skelBlock(70, 16)}${skelBlock(70, 16)}
      </div>
    </div>

    <div class="card">
      <div class="dev-section-title">Kelola Badge & Role</div>
      <div class="snippet-meta" style="margin-bottom:10px">Ketuk chip lencana buat aktifkan/matikan (bisa lebih dari satu jenis per user). Role bisa diisi teks bebas (cth: Moderator, Beta Tester) -- murni label, gak ngubah hak akses.</div>
      <div class="field"><input id="devUserSearch" placeholder="Cari username..." autocomplete="off"></div>
      <div id="devUserList">${skelRowList(4)}</div>
    </div>
  `

  loadDevStats()
  loadDevUsers()

  document.getElementById('devUserSearch').addEventListener('input', (e) => {
    renderDevUserList(e.target.value.trim().toLowerCase())
  })
}

async function loadDevStats() {
  const grid = document.getElementById('devStatsGrid')
  try {
    const s = await api('/dev/stats')
    grid.innerHTML = `
      <div class="dev-stat-box"><b>${s.totalUsers}</b><span>Total User</span></div>
      <div class="dev-stat-box"><b>${s.totalSnippets}</b><span>Total Kode</span></div>
      <div class="dev-stat-box"><b>${formatViews(s.totalViews).replace(' views', '')}</b><span>Total Views</span></div>
      <div class="dev-stat-box"><b>${s.totalFollows}</b><span>Total Follow</span></div>
      <div class="dev-stat-box"><b>${s.verifiedCount}</b><span>Verified</span></div>
      <div class="dev-stat-box"><b>${s.pendingReports}</b><span>Laporan Baru</span></div>
    `
  } catch (e) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`
  }
}

async function loadDevUsers() {
  try {
    allDevUsers = await api('/dev/users')
    renderDevUserList('')
  } catch (e) {
    document.getElementById('devUserList').innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`
  }
}

function renderDevUserList(filter) {
  const list = document.getElementById('devUserList')
  const rows = filter
    ? allDevUsers.filter(u => u.username.toLowerCase().includes(filter) || (u.nickname || '').toLowerCase().includes(filter))
    : allDevUsers

  if (!rows.length) { list.innerHTML = `<div class="empty-state">Gak ada user yang cocok.</div>`; return }

  const visible = devUsersExpanded ? rows : rows.slice(0, 5)

  list.innerHTML = visible.map(u => `
    <div class="dev-user-block">
      <div class="dev-badge-row">
        <a class="dev-badge-user" href="${profileUrl(u.username)}">
          <img class="avatar-circle avatar-circle-sm" src="${u.avatar || ''}" onerror="this.style.visibility='hidden'" loading="lazy" decoding="async">
          <span>${escapeHtml(u.nickname || u.username)}${badgesHtml(u.badges)}${roleBadgeHtml(u.role)}<br><span class="snippet-meta">@${escapeHtml(u.username)} · ${u.snippetCount} kode · ${formatViews(u.totalViews)}</span></span>
        </a>
        ${u.isDeveloper ? `<span class="lang-badge">DEV</span>` : ''}
      </div>
      ${!u.isDeveloper ? `
      <div class="dev-badge-chip-row">
        ${BADGE_CATALOG.map(b => {
          const active = (u.badges || []).includes(b.id)
          return `<button type="button" class="badge-chip ${active ? 'active' : ''}" style="${active ? `background:${b.color};color:#fff;border-color:${b.color}` : ''}" data-username="${escapeHtml(u.username)}" data-badge-id="${b.id}" data-enabled="${active ? '0' : '1'}">
            <svg viewBox="0 0 24 24" width="13" height="13">${b.icon}</svg> ${b.label}
          </button>`
        }).join('')}
      </div>
      <div class="dev-role-row">
        <input class="dev-role-input" data-role-username="${escapeHtml(u.username)}" placeholder="Role custom (kosongkan buat hapus)" value="${escapeHtml(u.role || '')}" maxlength="24">
        <button class="btn btn-white btn-sm dev-role-save-btn" data-role-username="${escapeHtml(u.username)}">Set Role</button>
      </div>` : ''}
    </div>
  `).join('') + (!devUsersExpanded && rows.length > 5
    ? `<button type="button" class="dev-showall-btn" id="devShowAllBtn">Tampilkan semua (${rows.length} user)</button>`
    : '')

  list.querySelectorAll('.badge-chip').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.busy) return
      btn.dataset.busy = '1'
      const username = btn.dataset.username
      const badgeId = btn.dataset.badgeId
      const enabled = btn.dataset.enabled === '1'
      const def = BADGE_CATALOG.find(b => b.id === badgeId)
      try {
        await api(`/dev/users/${username}/badges/${badgeId}`, { method: 'POST', body: JSON.stringify({ enabled }) })
        toast(enabled ? `Lencana ${def.label} aktif buat @${username}` : `Lencana ${def.label} dimatikan buat @${username}`)
        loadDevUsers()
      } catch (e) { toast(e.message) }
      finally { delete btn.dataset.busy }
    }
  })

  list.querySelectorAll('.dev-role-save-btn').forEach(btn => {
    btn.onclick = async () => {
      const username = btn.dataset.roleUsername
      const input = list.querySelector(`.dev-role-input[data-role-username="${CSS.escape(username)}"]`)
      const role = input.value.trim()
      try {
        await api(`/dev/users/${username}/role`, { method: 'POST', body: JSON.stringify({ role }) })
        toast(role ? `Role @${username} di-set ke "${role}"` : `Role @${username} dihapus`)
        loadDevUsers()
      } catch (e) { toast(e.message) }
    }
  })

  const showAllBtn = document.getElementById('devShowAllBtn')
  if (showAllBtn) showAllBtn.onclick = () => {
    devUsersExpanded = true
    renderDevUserList(document.getElementById('devUserSearch').value.trim().toLowerCase())
  }
}

refreshAuth().then(renderDevPanel)
