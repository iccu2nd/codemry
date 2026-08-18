
const DEV_EYE_OPEN_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`
const DEV_EYE_OFF_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.86 21.86 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`

let allDevUsers = []
let devUsersExpanded = false

async function renderDevPanel() {
  const app = document.getElementById('app')
  if (!me) { app.innerHTML = `<div class="card"><div class="empty-state">Login dulu ya.</div></div>`; return }
  if (!me.isDeveloper) { app.innerHTML = `<div class="card"><div class="empty-state">Halaman ini hanya untuk developer.</div></div>`; return }

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
      <div class="snippet-meta" style="margin-bottom:10px">Ketuk chip lencana untuk mengaktifkan/menonaktifkan (bisa lebih dari satu jenis per pengguna). Role dapat diisi teks bebas (contoh: Moderator, Beta Tester) — murni label, tidak mengubah hak akses.</div>
      <div class="field"><input id="devUserSearch" placeholder="Cari username..." autocomplete="off"></div>
      <div id="devUserList">${skelRowList(3)}</div>
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
        <input class="dev-role-input" data-role-username="${escapeHtml(u.username)}" placeholder="Role khusus (kosongkan untuk menghapus)" value="${escapeHtml(u.role || '')}" maxlength="24">
        <button class="btn btn-white btn-sm dev-role-save-btn" data-role-username="${escapeHtml(u.username)}">Set Role</button>
      </div>
      <div class="dev-role-row" style="margin-top:8px">
        <input class="dev-role-input dev-password-input" data-pw-username="${escapeHtml(u.username)}" type="password" placeholder="Password baru (min. 6 karakter)" autocomplete="new-password">
        <button type="button" class="password-eye-btn dev-password-eye-btn" data-pw-username="${escapeHtml(u.username)}" aria-label="Tampilkan atau sembunyikan password" style="position:static;flex-shrink:0">${DEV_EYE_OPEN_SVG}</button>
        <button class="btn btn-white btn-sm dev-password-save-btn" data-pw-username="${escapeHtml(u.username)}">Set Password</button>
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
        toast(enabled ? `Lencana ${def.label} aktif untuk @${username}` : `Lencana ${def.label} dinonaktifkan untuk @${username}`)
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

  list.querySelectorAll('.dev-password-eye-btn').forEach(btn => {
    btn.onclick = () => {
      const username = btn.dataset.pwUsername
      const input = list.querySelector(`.dev-password-input[data-pw-username="${CSS.escape(username)}"]`)
      const show = input.type === 'password'
      input.type = show ? 'text' : 'password'
      btn.innerHTML = show ? DEV_EYE_OFF_SVG : DEV_EYE_OPEN_SVG
    }
  })

  list.querySelectorAll('.dev-password-save-btn').forEach(btn => {
    btn.onclick = async () => {
      const username = btn.dataset.pwUsername
      const input = list.querySelector(`.dev-password-input[data-pw-username="${CSS.escape(username)}"]`)
      const password = input.value
      if (password.length < 6) { toast('Password minimal 6 karakter'); return }
      if (btn.dataset.busy) return
      btn.dataset.busy = '1'
      setBtnLoading(btn, true)
      try {
        await api(`/dev/users/${username}/password`, { method: 'POST', body: JSON.stringify({ password }) })
        toast(`Password @${username} berhasil diganti`)
        input.value = ''
      } catch (e) { toast(e.message) }
      finally { delete btn.dataset.busy; setBtnLoading(btn, false) }
    }
  })

  const showAllBtn = document.getElementById('devShowAllBtn')
  if (showAllBtn) showAllBtn.onclick = () => {
    devUsersExpanded = true
    renderDevUserList(document.getElementById('devUserSearch').value.trim().toLowerCase())
  }
}

refreshAuth().then(renderDevPanel)
