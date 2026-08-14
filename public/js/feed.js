
// 9 kode/halaman: pas buat card preview yang lumayan "berat" (avatar, tag, cuplikan kode)
// biar tiap halaman gak kepanjangan scroll-nya tapi tetep berasa isinya banyak.
const FEED_PAGE_SIZE = 9

let feedAll = []
let feedSort = 'new'
let feedActiveTag = null
let feedPage = 1

function trendingScore(s) {
  return (s.likes || 0) * 3 + (s.views || 0)
}

function clampFeedPage(page, totalPages) {
  if (!Number.isInteger(page) || page < 1) return 1
  if (page > totalPages) return totalPages
  return page
}

function syncPageToUrl(page) {
  const url = new URL(location.href)
  if (page > 1) url.searchParams.set('page', String(page))
  else url.searchParams.delete('page')
  history.replaceState(null, '', url)
}

function goToFeedPage(page) {
  feedPage = page
  syncPageToUrl(feedPage)
  renderFeed({ scroll: true })
}

function resetFeedPage() {
  feedPage = 1
  syncPageToUrl(feedPage)
}

function paginationPageList(current, total) {
  const pages = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }
  pages.push(1)
  let start = Math.max(2, current - 1)
  let end = Math.min(total - 1, current + 1)
  if (current <= 3) { start = 2; end = 4 }
  if (current >= total - 2) { start = total - 3; end = total - 1 }
  if (start > 2) pages.push('...')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('...')
  pages.push(total)
  return pages
}

function renderPagination(totalItems, totalPages) {
  const el = document.getElementById('feedPagination')
  if (!el) return
  if (totalPages <= 1) { el.innerHTML = ''; return }

  const btn = (label, page, { active = false, disabled = false, arrow = false } = {}) =>
    `<button type="button" class="page-btn ${active ? 'active' : ''} ${arrow ? 'page-btn-arrow' : ''}" ${disabled ? 'disabled' : ''} data-page="${page}" aria-label="Halaman ${page}">${label}</button>`

  const middle = paginationPageList(feedPage, totalPages)
    .map(p => p === '...' ? `<span class="page-ellipsis">…</span>` : btn(p, p, { active: p === feedPage }))
    .join('')

  el.innerHTML = `
    <div class="pagination">
      ${btn(chevronLeftSvg(), feedPage - 1, { disabled: feedPage === 1, arrow: true })}
      ${middle}
      ${btn(chevronRightSvg(), feedPage + 1, { disabled: feedPage === totalPages, arrow: true })}
    </div>
    <div class="pagination-info">Halaman ${feedPage} dari ${totalPages} · ${totalItems} kode</div>
  `

  el.querySelectorAll('.page-btn[data-page]').forEach(b => {
    b.onclick = () => {
      const p = parseInt(b.dataset.page, 10)
      if (!p || p === feedPage || p < 1 || p > totalPages) return
      goToFeedPage(p)
    }
  })
}

function buildTagPills() {
  const pillsEl = document.getElementById('feedTagPills')
  if (!pillsEl) return
  const tagSet = new Set()
  feedAll.forEach(s => (s.tags || []).forEach(t => tagSet.add(t)))
  const tags = [...tagSet].sort()
  if (!tags.length) { pillsEl.innerHTML = ''; return }
  pillsEl.innerHTML = tags.map(t =>
    `<span class="tag-pill ${feedActiveTag === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`
  ).join('')
  pillsEl.querySelectorAll('.tag-pill').forEach(el => {
    el.onclick = () => {
      feedActiveTag = feedActiveTag === el.dataset.tag ? null : el.dataset.tag
      resetFeedPage()
      renderFeed()
    }
  })
}

function renderFeed(opts = {}) {
  const list = document.getElementById('feedList')
  const pagerEl = document.getElementById('feedPagination')
  const query = (document.getElementById('feedSearch')?.value || '').trim().toLowerCase()

  let items = feedAll.filter(s => {
    if (feedActiveTag && !(s.tags || []).includes(feedActiveTag)) return false
    if (!query) return true
    const haystack = [
      s.title, s.description, s.language, s.filename,
      s.ownerUsername, s.ownerNickname, ...(s.tags || [])
    ].join(' ').toLowerCase()
    return haystack.includes(query)
  })

  items = items.slice().sort((a, b) =>
    feedSort === 'trending' ? trendingScore(b) - trendingScore(a) : b.createdAt - a.createdAt
  )

  if (!items.length) {
    list.innerHTML = `<div class="empty-state">${feedAll.length ? 'Gak ada yang cocok. Coba kata kunci lain.' : 'Belum ada kode publik. Jadi yang pertama!'}</div>`
    if (pagerEl) pagerEl.innerHTML = ''
    return
  }

  const totalPages = Math.max(1, Math.ceil(items.length / FEED_PAGE_SIZE))
  feedPage = clampFeedPage(feedPage, totalPages)

  const start = (feedPage - 1) * FEED_PAGE_SIZE
  const pageItems = items.slice(start, start + FEED_PAGE_SIZE)

  list.innerHTML = pageItems.map(snippetCard).join('')
  highlightAllIn('#feedList pre code')
  wireLikeButtons(list)
  wireBookmarkButtons(list)
  renderPagination(items.length, totalPages)

  if (opts.scroll) {
    list.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

async function loadFeed() {
  const list = document.getElementById('feedList')
  list.innerHTML = `<div class="empty-state">Memuat...</div>`
  try {
    feedAll = await api('/codes')
    const pageFromUrl = parseInt(qs('page'), 10)
    feedPage = Number.isInteger(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1
    buildTagPills()
    renderFeed()
  } catch (e) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`
    document.getElementById('feedPagination').innerHTML = ''
  }
}

document.getElementById('refreshBtn')?.addEventListener('click', loadFeed)
document.getElementById('feedSearch')?.addEventListener('input', () => {
  resetFeedPage()
  renderFeed()
})
document.getElementById('feedSortTabs')?.querySelectorAll('.lb-tab-btn').forEach(btn => {
  btn.onclick = () => {
    feedSort = btn.dataset.sort
    document.getElementById('feedSortTabs').querySelectorAll('.lb-tab-btn').forEach(b => b.classList.toggle('active', b === btn))
    resetFeedPage()
    renderFeed()
  }
})

refreshAuth()
loadFeed()
