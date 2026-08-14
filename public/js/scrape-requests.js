
async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  const container = document.getElementById('scrapeListPage')
  try {
    const requests = await api('/scrape-requests')
    container.innerHTML = `
      <div class="section-label">${listCheckSvg()} List Scraping</div>
      <div id="scrapeReqList">${requests.length ? requests.map(requestCard).join('') : `<div class="card"><div class="empty-state">Belum ada request scrape.</div></div>`}</div>
    `
    wireClaimButtons()
  } catch (e) {
    container.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

function requestCard(r) {
  const statusLabel = r.status === 'pending' ? 'Belum dikerjakan' : `Dikerjakan oleh @${escapeHtml(r.claimedBy)}`
  return `
    <div class="card scrape-req-card" data-id="${r.id}">
      <div class="scrape-req-url"><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.url)}</a></div>
      <div class="scrape-req-desc">${escapeHtml(r.description)}</div>
      ${r.image ? `<img class="scrape-req-img" src="${r.image}" loading="lazy" decoding="async">` : ''}
      <div class="scrape-req-meta">
        <span>${r.username ? `oleh @${escapeHtml(r.username)}` : 'oleh guest'} · ${timeAgo(r.createdAt)}</span>
        <span class="scrape-req-status ${r.status === 'pending' ? '' : 'claimed'}">${statusLabel}</span>
      </div>
      ${r.status === 'pending' ? `<button type="button" class="btn btn-primary btn-block" data-role="claim" data-id="${r.id}">Saya Kerjakan!</button>` : ''}
    </div>
  `
}

function wireClaimButtons() {
  document.querySelectorAll('[data-role="claim"]').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true
      btn.textContent = 'Mengambil...'
      try {
        await api(`/scrape-requests/${btn.dataset.id}/claim`, { method: 'POST' })
        toast('Request kamu ambil!')
        init()
      } catch (e) {
        toast(e.message)
        btn.disabled = false
        btn.textContent = 'Saya Kerjakan!'
      }
    }
  })
}

init()
