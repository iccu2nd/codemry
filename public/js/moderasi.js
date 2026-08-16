
let reportFilter = 'pending'

async function renderModerasiPanel() {
  const app = document.getElementById('app')
  if (!me) { app.innerHTML = `<div class="card"><div class="empty-state">Login dulu ya.</div></div>`; return }
  if (!me.isModerator) { app.innerHTML = `<div class="card"><div class="empty-state">Halaman ini cuma buat moderator.</div></div>`; return }

  app.innerHTML = `
    <div class="card">
      <div class="devpanel-head">
        ${flagIconSvg()}
        <div>
          <div class="devpanel-title">Moderasi</div>
          <div class="snippet-meta">Tinjau laporan dari user dan kelola kode yang melanggar.</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="dev-section-title">Laporan Kode <span id="devReportsPendingBadge"></span></div>
      <div class="snippet-meta" style="margin-bottom:14px">Laporan dari user (vulgar, spam, plagiat, dll) muncul di sini. Yang bertanda kuning masih perlu ditindaklanjuti.</div>
      <div class="report-filter-tabs" id="reportFilterTabs"></div>
      <div id="devReportsList">${skelRowList(3)}</div>
    </div>

    <div class="card">
      <div class="dev-section-title">Moderasi Kode</div>
      <div class="snippet-meta" style="margin-bottom:10px">Hapus kode siapa pun lewat short ID-nya (kelihatan di URL /code?id=...).</div>
      <div class="field"><label>Short ID kode</label><input id="devSnippetId" placeholder="cth: aB3xY9kq" autocomplete="off"></div>
      <button class="btn btn-danger btn-block" id="devDeleteSnippetBtn">Hapus Kode</button>
    </div>
  `

  loadDevReports()

  document.getElementById('devDeleteSnippetBtn').onclick = async () => {
    const shortId = document.getElementById('devSnippetId').value.trim()
    if (!shortId) { toast('Isi short ID dulu'); return }
    if (!confirm(`Yakin mau hapus kode "${shortId}"? Aksi ini gak bisa dibatalin.`)) return
    try {
      await api(`/dev/snippets/${shortId}`, { method: 'DELETE' })
      toast('Kode berhasil dihapus')
      document.getElementById('devSnippetId').value = ''
    } catch (e) { toast(e.message) }
  }
}

let lastReports = []

async function loadDevReports() {
  const list = document.getElementById('devReportsList')
  try {
    lastReports = await api('/dev/reports')
    renderDevReportsList(lastReports)
  } catch (e) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`
  }
}

const REPORT_STATUS_LABEL = { pending: 'Perlu Ditindaklanjuti', resolved: 'Selesai', dismissed: 'Diabaikan' }

function renderReportFilterTabs(reports) {
  const tabs = document.getElementById('reportFilterTabs')
  if (!tabs) return
  const counts = {
    pending: reports.filter(r => r.status === 'pending').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    dismissed: reports.filter(r => r.status === 'dismissed').length,
    all: reports.length
  }
  const tabDefs = [
    ['pending', 'Perlu Ditindaklanjuti'],
    ['resolved', 'Selesai'],
    ['dismissed', 'Diabaikan'],
    ['all', 'Semua']
  ]
  tabs.innerHTML = tabDefs.map(([key, label]) => `
    <button type="button" class="report-filter-tab${reportFilter === key ? ' active' : ''}" data-filter="${key}">
      ${label}<span class="count">(${counts[key]})</span>
    </button>
  `).join('')
  tabs.querySelectorAll('.report-filter-tab').forEach(btn => {
    btn.onclick = () => { reportFilter = btn.dataset.filter; renderDevReportsList(lastReports) }
  })
}

function renderDevReportsList(reports) {
  const list = document.getElementById('devReportsList')
  const badge = document.getElementById('devReportsPendingBadge')
  const pending = reports.filter(r => r.status === 'pending')
  if (badge) badge.innerHTML = pending.length ? `<span class="lang-badge">${pending.length} baru</span>` : ''

  renderReportFilterTabs(reports)

  if (!reports.length) { list.innerHTML = `<div class="empty-state">Belum ada laporan.</div>`; return }

  const filtered = reportFilter === 'all' ? reports : reports.filter(r => r.status === reportFilter)
  if (!filtered.length) { list.innerHTML = `<div class="empty-state">Gak ada laporan di kategori ini.</div>`; return }

  list.innerHTML = filtered.map(r => `
    <div class="report-card" data-status="${r.status}" data-report-id="${r.id}">
      <div class="report-head">
        <div class="report-reason">${escapeHtml(r.reasonLabel)}</div>
        <span class="report-status-pill ${r.status}">${REPORT_STATUS_LABEL[r.status] || r.status}</span>
      </div>
      <div class="report-meta">
        Dilapor oleh <b><a class="user-link" href="${profileUrl(r.fromUsername)}">@${escapeHtml(r.fromUsername)}</a></b> · ${timeAgo(r.createdAt)}<br>
        Kode: ${r.snippetExists ? `<b><a class="user-link" href="${codeUrl(r.shortId)}">${escapeHtml(r.snippetTitle)}</a></b>` : `<b>${escapeHtml(r.snippetTitle)}</b> <span style="color:#b91c1c">(sudah dihapus)</span>`}
        - pemilik <b><a class="user-link" href="${profileUrl(r.ownerUsername)}">@${escapeHtml(r.ownerUsername)}</a></b>
      </div>
      ${r.detail ? `<div class="report-detail-box">"${escapeHtml(r.detail)}"</div>` : ''}
      ${r.status === 'pending' ? `
        <div class="report-actions-label">Tindak lanjuti laporan ini</div>
        <div class="report-actions">
          <button class="btn btn-white btn-sm dev-report-action" data-id="${r.id}" data-status="dismissed">${closeIconSvg()} Abaikan</button>
          <button class="btn btn-white btn-sm dev-report-action" data-id="${r.id}" data-status="resolved">${checkIconSvg()} Tandai Selesai</button>
          ${r.snippetExists ? `<button class="btn btn-danger btn-sm dev-report-delete" data-short-id="${r.shortId}" data-report-id="${r.id}">${trashIconSvg()} Hapus Kode</button>` : ''}
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
        toast('Status laporan diperbarui')
        loadDevReports()
      } catch (e) { toast(e.message) }
      finally { delete btn.dataset.busy }
    }
  })

  list.querySelectorAll('.dev-report-delete').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Hapus kode yang dilaporkan ini? Aksi ini gak bisa dibatalin.')) return
      if (btn.dataset.busy) return
      btn.dataset.busy = '1'
      try {
        await api(`/dev/snippets/${btn.dataset.shortId}`, { method: 'DELETE' })
        await api(`/dev/reports/${btn.dataset.reportId}/status`, { method: 'POST', body: JSON.stringify({ status: 'resolved' }) })
        toast('Kode dihapus & laporan ditandai selesai')
        loadDevReports()
      } catch (e) { toast(e.message) }
      finally { delete btn.dataset.busy }
    }
  })
}

refreshAuth().then(renderModerasiPanel)
