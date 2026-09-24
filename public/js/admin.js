/**
 * Unified Admin Panel — combines Developer + Moderation in one place.
 * Tabs: Overview | Reports | Users (Users only for developer)
 */

const DEV_TRASH_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`
const DEV_KEBAB_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`

const REPORT_STATUS_LABEL = { pending: 'Pending', resolved: 'Resolved', dismissed: 'Dismissed' }

let adminTab = 'overview'
let reportFilter = 'pending'
let lastReports = []
let allDevUsers = []
let devUsersExpanded = false
let isDev = false

async function renderAdminPanel() {
  const app = document.getElementById('app')
  if (!me) {
    app.innerHTML = `<div class="card">${emptyStateHtml({ title: 'Please sign in first' })}</div>`
    return
  }
  if (!me.isModerator && !me.isDeveloper) {
    app.innerHTML = `<div class="card">${emptyStateHtml({ title: 'Admin access only' })}</div>`
    return
  }

  isDev = !!me.isDeveloper
  // Default tab: moderators start on reports, developers on overview
  const params = new URLSearchParams(location.search)
  const qTab = params.get('tab')
  if (qTab === 'reports' || qTab === 'users' || qTab === 'overview') {
    adminTab = qTab
  } else {
    adminTab = isDev ? 'overview' : 'reports'
  }
  if (adminTab === 'users' && !isDev) adminTab = 'reports'
  if (adminTab === 'overview' && !isDev) adminTab = 'reports'

  app.innerHTML = `
    <div class="admin-shell">
      <div class="admin-header">
        <div class="admin-header-text">
          <h1 class="admin-title">Admin</h1>
          <p class="admin-sub">${isDev ? 'Developer & moderation tools' : 'Moderation tools'}</p>
        </div>
      </div>

      <div class="admin-tabs" role="tablist">
        ${isDev ? `<button type="button" class="admin-tab ${adminTab === 'overview' ? 'active' : ''}" data-tab="overview" role="tab">Overview</button>` : ''}
        <button type="button" class="admin-tab ${adminTab === 'reports' ? 'active' : ''}" data-tab="reports" role="tab">
          Reports <span class="admin-tab-badge" id="adminPendingBadge" style="display:none">0</span>
        </button>
        ${isDev ? `<button type="button" class="admin-tab ${adminTab === 'users' ? 'active' : ''}" data-tab="users" role="tab">Users</button>` : ''}
      </div>

      <div id="adminContent"></div>
    </div>
  `

  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.onclick = () => {
      adminTab = btn.dataset.tab
      const url = new URL(location.href)
      url.searchParams.set('tab', adminTab)
      history.replaceState(null, '', url)
      document.querySelectorAll('.admin-tab').forEach(b => b.classList.toggle('active', b === btn))
      renderAdminTab()
    }
  })

  renderAdminTab()
}

function renderAdminTab() {
  const el = document.getElementById('adminContent')
  if (!el) return

  if (adminTab === 'overview' && isDev) {
    el.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-title">Stats</div>
        <div class="dev-stats-grid" id="devStatsGrid">
          ${skelBlock(70, 16)}${skelBlock(70, 16)}${skelBlock(70, 16)}${skelBlock(70, 16)}
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-title">Quick actions</div>
        <div class="admin-quick-grid">
          <button type="button" class="admin-quick-btn" data-goto="reports">
            <span class="admin-quick-label">Review reports</span>
            <span class="admin-quick-hint">Pending user reports</span>
          </button>
          <button type="button" class="admin-quick-btn" data-goto="users">
            <span class="admin-quick-label">Manage users</span>
            <span class="admin-quick-hint">Badges, roles, accounts</span>
          </button>
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-title">Info bar pengumuman</div>
        <p class="admin-hint">Teks ini muncul di paling atas semua halaman (siapa aja bisa lihat, bukan cuma yang login). User bisa nutupnya sendiri pakai tombol X, dan gak akan muncul lagi buat dia -- sampai kamu ganti teksnya di sini.</p>
        <div id="devBannerFields">${skelBlock(70, 16)}${skelBlock(70, 80)}</div>
      </div>
      <div class="admin-card">
        <div class="admin-card-title">Delete code by ID</div>
        <p class="admin-hint">Remove any code using its short ID (from /code?id=…).</p>
        <div class="admin-inline-row">
          <input id="devSnippetId" class="admin-input" placeholder="Short ID" autocomplete="off">
          <button class="btn btn-danger btn-sm" id="devDeleteSnippetBtn">Delete</button>
        </div>
      </div>
    `
    loadDevStats()
    loadDevBannerSettings()
    wireDeleteSnippet()
    el.querySelectorAll('[data-goto]').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.goto
        document.querySelector(`.admin-tab[data-tab="${tab}"]`)?.click()
      }
    })
    return
  }

  if (adminTab === 'reports') {
    el.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-title">Code reports</div>
        <p class="admin-hint">Reports from users (spam, vulgar, plagiarism, etc.). Yellow = needs action.</p>
        <div class="report-filter-tabs" id="reportFilterTabs"></div>
        <div id="devReportsList">${skelRowList(3)}</div>
      </div>
      <div class="admin-card">
        <div class="admin-card-title">Delete code by ID</div>
        <div class="admin-inline-row">
          <input id="devSnippetId" class="admin-input" placeholder="Short ID" autocomplete="off">
          <button class="btn btn-danger btn-sm" id="devDeleteSnippetBtn">Delete</button>
        </div>
      </div>
    `
    loadDevReports()
    wireDeleteSnippet()
    return
  }

  if (adminTab === 'users' && isDev) {
    el.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-title">Users · badges & roles</div>
        <p class="admin-hint">Tap a badge chip to toggle. Use ⋮ for role, password, or delete account.</p>
        <div class="field" style="margin-bottom:12px">
          <input id="devUserSearch" placeholder="Search username…" autocomplete="off">
        </div>
        <div id="devUserList">${skelRowList(4)}</div>
      </div>
    `
    loadDevUsers()
    document.getElementById('devUserSearch').addEventListener('input', (e) => {
      renderDevUserList(e.target.value.trim().toLowerCase())
    })
  }
}

async function loadDevBannerSettings() {
  const wrap = document.getElementById('devBannerFields')
  if (!wrap) return
  try {
    const settings = await api('/dev/settings')
    const ib = settings.infoBanner || { enabled: false, text: '' }
    wrap.innerHTML = `
      <label class="checkbox-row">
        <input type="checkbox" id="devBannerEnabled" ${ib.enabled ? 'checked' : ''}>
        Aktifkan info bar
      </label>
      <div class="field">
        <textarea id="devBannerText" placeholder="Tulis pengumumannya di sini…" maxlength="500" style="min-height:70px">${escapeHtml(ib.text || '')}</textarea>
        <div class="field-hint">Ganti kalimatnya bikin banner ini muncul lagi buat user yang udah pernah nutup versi lama.</div>
      </div>
      <button class="btn btn-primary btn-sm" id="devBannerSaveBtn">Simpan</button>
    `
    document.getElementById('devBannerSaveBtn').onclick = async () => {
      const btn = document.getElementById('devBannerSaveBtn')
      const text = document.getElementById('devBannerText').value
      const enabled = document.getElementById('devBannerEnabled').checked
      setBtnLoading(btn, true)
      try {
        await api('/dev/settings/info-banner', { method: 'POST', body: JSON.stringify({ text, enabled }) })
        toast('Info bar diperbarui')
      } catch (e) { toast(e.message) }
      finally { setBtnLoading(btn, false) }
    }
  } catch (e) {
    wrap.innerHTML = emptyStateHtml({ title: escapeHtml(e.message) })
  }
}

function wireDeleteSnippet() {
  const btn = document.getElementById('devDeleteSnippetBtn')
  if (!btn) return
  btn.onclick = async () => {
    const shortId = document.getElementById('devSnippetId')?.value.trim()
    if (!shortId) { toast('Enter a short ID first'); return }
    await confirmAction({
      title: 'Delete this code?',
      message: `"${shortId}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        await api(`/dev/snippets/${encodeURIComponent(shortId)}`, { method: 'DELETE' })
        toast('Code deleted')
        const input = document.getElementById('devSnippetId')
        if (input) input.value = ''
      }
    })
  }
}

async function loadDevStats() {
  const grid = document.getElementById('devStatsGrid')
  if (!grid) return
  try {
    const s = await api('/dev/stats')
    grid.innerHTML = `
      <div class="dev-stat-box"><b>${s.totalUsers}</b><span>Users</span></div>
      <div class="dev-stat-box"><b>${s.totalSnippets}</b><span>Codes</span></div>
      <div class="dev-stat-box"><b>${s.totalViews}</b><span>Views</span></div>
      <div class="dev-stat-box"><b>${s.pendingReports || 0}</b><span>Pending</span></div>
    `
    const badge = document.getElementById('adminPendingBadge')
    if (badge && s.pendingReports > 0) {
      badge.textContent = s.pendingReports
      badge.style.display = ''
    }
  } catch (e) {
    grid.innerHTML = `<div class="empty-state-sm">${escapeHtml(e.message)}</div>`
  }
}

async function loadDevReports() {
  const list = document.getElementById('devReportsList')
  if (!list) return
  try {
    lastReports = await api('/dev/reports')
    const pending = lastReports.filter(r => r.status === 'pending').length
    const badge = document.getElementById('adminPendingBadge')
    if (badge) {
      if (pending > 0) {
        badge.textContent = pending
        badge.style.display = ''
      } else {
        badge.style.display = 'none'
      }
    }
    renderDevReportsList(lastReports)
  } catch (e) {
    list.innerHTML = emptyStateHtml({ title: escapeHtml(e.message) })
  }
}

function renderDevReportsList(reports) {
  const list = document.getElementById('devReportsList')
  const tabs = document.getElementById('reportFilterTabs')
  if (!list) return

  const counts = {
    pending: reports.filter(r => r.status === 'pending').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    dismissed: reports.filter(r => r.status === 'dismissed').length,
    all: reports.length
  }

  if (tabs) {
    tabs.innerHTML = ['pending', 'resolved', 'dismissed', 'all'].map(f =>
      `<button type="button" class="report-filter-tab ${reportFilter === f ? 'active' : ''}" data-filter="${f}">
        ${f === 'all' ? 'All' : REPORT_STATUS_LABEL[f] || f}
        <span class="count">${counts[f]}</span>
      </button>`
    ).join('')
    tabs.querySelectorAll('.report-filter-tab').forEach(btn => {
      btn.onclick = () => {
        reportFilter = btn.dataset.filter
        renderDevReportsList(lastReports)
      }
    })
  }

  const filtered = reportFilter === 'all' ? reports : reports.filter(r => r.status === reportFilter)
  if (!filtered.length) {
    list.innerHTML = emptyStateHtml({ title: 'No reports', sub: reportFilter === 'pending' ? 'Nothing waiting for review.' : 'No items in this filter.' })
    return
  }

  list.innerHTML = filtered.map(r => `
    <div class="report-card" data-status="${escapeHtml(r.status)}">
      <div class="report-head">
        <div class="report-reason">${escapeHtml(r.reasonLabel || r.reason)}</div>
        <span class="report-status-pill ${escapeHtml(r.status)}">${REPORT_STATUS_LABEL[r.status] || r.status}</span>
      </div>
      <div class="report-meta">
        Reported by <b><a class="user-link" href="${profileUrl(r.fromUsername)}">@${escapeHtml(r.fromUsername)}</a></b>
        · ${timeAgo(r.createdAt)}<br>
        Code: ${r.snippetExists
          ? `<b><a class="user-link" href="${codeUrl(r.shortId)}">${escapeHtml(r.snippetTitle)}</a></b>`
          : `<b>${escapeHtml(r.snippetTitle)}</b> <span style="color:#b91c1c">(deleted)</span>`}
        · owner <b><a class="user-link" href="${profileUrl(r.ownerUsername)}">@${escapeHtml(r.ownerUsername)}</a></b>
      </div>
      ${r.detail ? `<div class="report-detail-box">"${escapeHtml(r.detail)}"</div>` : ''}
      ${r.status === 'pending' ? `
        <div class="report-actions-label">Actions</div>
        <div class="report-actions">
          <button class="btn btn-white btn-sm dev-report-action" data-id="${r.id}" data-status="dismissed">${closeIconSvg()} Dismiss</button>
          <button class="btn btn-white btn-sm dev-report-action" data-id="${r.id}" data-status="resolved">${checkIconSvg()} Mark done</button>
          ${r.snippetExists ? `<button class="btn btn-danger btn-sm dev-report-delete" data-short-id="${escapeHtml(r.shortId)}" data-report-id="${r.id}">${DEV_TRASH_SVG} Delete code</button>` : ''}
        </div>
      ` : ''}
    </div>
  `).join('')

  list.querySelectorAll('.dev-report-action').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.busy) return
      btn.dataset.busy = '1'
      try {
        await api(`/dev/reports/${btn.dataset.id}/status`, { method: 'POST', body: JSON.stringify({ status: btn.dataset.status }) })
        toast('Report updated')
        loadDevReports()
      } catch (e) { toast(e.message) }
      finally { delete btn.dataset.busy }
    }
  })

  list.querySelectorAll('.dev-report-delete').forEach(btn => {
    btn.onclick = async () => {
      await confirmAction({
        title: 'Delete reported code?',
        message: 'This code will be permanently removed and the report marked resolved.',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: async () => {
          await api(`/dev/snippets/${btn.dataset.shortId}`, { method: 'DELETE' })
          await api(`/dev/reports/${btn.dataset.reportId}/status`, { method: 'POST', body: JSON.stringify({ status: 'resolved' }) })
          toast('Code deleted · report resolved')
          loadDevReports()
        }
      })
    }
  })
}

async function loadDevUsers() {
  try {
    allDevUsers = await api('/dev/users')
    devUsersExpanded = false
    renderDevUserList(document.getElementById('devUserSearch')?.value.trim().toLowerCase() || '')
  } catch (e) {
    const list = document.getElementById('devUserList')
    if (list) list.innerHTML = emptyStateHtml({ title: escapeHtml(e.message) })
  }
}

function renderDevUserList(q) {
  const list = document.getElementById('devUserList')
  if (!list) return
  let rows = allDevUsers
  if (q) rows = rows.filter(u => (u.username || '').toLowerCase().includes(q) || (u.nickname || '').toLowerCase().includes(q))
  if (!rows.length) {
    list.innerHTML = emptyStateHtml({ title: 'No users found' })
    return
  }
  const visible = devUsersExpanded || rows.length <= 8 ? rows : rows.slice(0, 8)
  list.innerHTML = visible.map(u => {
    const badges = Array.isArray(u.badges) ? u.badges : []
    return `
      <div class="dev-user-block">
        <div class="dev-badge-row">
          <a class="dev-badge-user" href="${profileUrl(u.username)}">
            ${avatarHtml(u.avatar, u.nickname || u.username, 'avatar-circle-sm')}
            <span>@${escapeHtml(u.username)}</span>
            ${u.isDeveloper ? '<span class="dev-badge">DEV</span>' : ''}
            ${u.role ? `<span class="role-badge">${escapeHtml(u.role)}</span>` : ''}
          </a>
          <button type="button" class="dev-kebab-btn" data-username="${escapeHtml(u.username)}" aria-label="Manage">${DEV_KEBAB_SVG}</button>
        </div>
        ${!u.isDeveloper ? `
        <div class="dev-badge-chip-row">
          ${BADGE_CATALOG.map(b => {
            const active = badges.includes(b.id)
            return `<button type="button" class="badge-chip ${active ? 'active' : ''}" style="${active ? `background:${b.color};color:#fff;border-color:${b.color}` : ''}" data-username="${escapeHtml(u.username)}" data-badge-id="${b.id}" data-enabled="${active ? '0' : '1'}">
              <svg viewBox="0 0 24 24" width="16" height="16">${b.icon}</svg> ${b.label}
            </button>`
          }).join('')}
        </div>` : ''}
      </div>`
  }).join('') + (!devUsersExpanded && rows.length > 8
    ? `<button type="button" class="dev-showall-btn" id="devShowAllBtn">Show all (${rows.length - visible.length} more)</button>`
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
        await api(`/dev/users/${encodeURIComponent(username)}/badges/${badgeId}`, { method: 'POST', body: JSON.stringify({ enabled }) })
        toast(enabled ? `${def.label} on for @${username}` : `${def.label} off for @${username}`)
        loadDevUsers()
      } catch (e) { toast(e.message) }
      finally { delete btn.dataset.busy }
    }
  })

  list.querySelectorAll('.dev-kebab-btn').forEach(btn => {
    btn.onclick = () => {
      const u = allDevUsers.find(x => x.username === btn.dataset.username)
      if (u) openUserManageModal(u)
    }
  })

  const showAllBtn = document.getElementById('devShowAllBtn')
  if (showAllBtn) showAllBtn.onclick = () => {
    devUsersExpanded = true
    renderDevUserList(document.getElementById('devUserSearch')?.value.trim().toLowerCase() || '')
  }
}

function openUserManageModal(u) {
  openModal(`
    <div class="modal-head">
      <div class="modal-head-title">Manage @${escapeHtml(u.username)}</div>
      <button class="modal-close-btn" onclick="closeModal()">${closeIconSvg()}</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Role</label>
        <div class="dev-role-row" style="margin-top:0">
          <input class="dev-role-input" id="mUmRole" placeholder="Custom role (empty to clear)" value="${escapeHtml(u.role || '')}" maxlength="24">
          <button class="btn btn-white btn-sm" id="mUmRoleSaveBtn">Save</button>
        </div>
      </div>
      <div class="field">
        <label>New password</label>
        <div class="dev-role-row" style="margin-top:0">
          <input class="dev-role-input" id="mUmPassword" type="password" placeholder="Min. 6 characters" autocomplete="new-password">
          <button class="btn btn-white btn-sm" id="mUmPasswordSaveBtn">Save</button>
        </div>
        <div class="field-hint">Cannot view the old password — only set a new one.</div>
      </div>
      <div class="detail-divider"></div>
      <div class="field" style="margin-bottom:0">
        <label>Danger zone</label>
        <button class="btn btn-danger btn-block" id="mUmDeleteBtn">${DEV_TRASH_SVG} Delete @${escapeHtml(u.username)}</button>
        <div class="field-hint">Deletes all their codes, comments, likes, bookmarks, and follows permanently.</div>
      </div>
    </div>
  `)

  document.getElementById('mUmRoleSaveBtn').onclick = async () => {
    const btn = document.getElementById('mUmRoleSaveBtn')
    const role = document.getElementById('mUmRole').value.trim()
    setBtnLoading(btn, true)
    try {
      await api(`/dev/users/${encodeURIComponent(u.username)}/role`, { method: 'POST', body: JSON.stringify({ role }) })
      toast(role ? `Role set to "${role}"` : `Role cleared`)
      closeModal()
      loadDevUsers()
    } catch (e) { toast(e.message); setBtnLoading(btn, false) }
  }

  document.getElementById('mUmPasswordSaveBtn').onclick = async () => {
    const btn = document.getElementById('mUmPasswordSaveBtn')
    const password = document.getElementById('mUmPassword').value
    if (password.length < 6) { toast('Password min. 6 characters'); return }
    setBtnLoading(btn, true)
    try {
      await api(`/dev/users/${encodeURIComponent(u.username)}/password`, { method: 'POST', body: JSON.stringify({ password }) })
      toast('Password updated')
      closeModal()
    } catch (e) { toast(e.message); setBtnLoading(btn, false) }
  }

  document.getElementById('mUmDeleteBtn').onclick = async () => {
    await confirmAction({
      title: `Delete @${u.username}?`,
      message: 'This cannot be undone. The account and related data will be removed.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        await api(`/dev/users/${encodeURIComponent(u.username)}`, { method: 'DELETE' })
        toast(`@${u.username} deleted`)
        loadDevUsers()
      }
    })
  }
}

refreshAuth().then(renderAdminPanel)
