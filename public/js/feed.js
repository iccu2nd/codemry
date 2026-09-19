const FEED_PAGE_SIZE = 9

let feedAll = []
let feedSort = 'new'
let feedActiveTag = null
let feedActiveLang = null
let feedPage = 1
let followingSet = new Set()

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
    `<button type="button" class="page-btn ${active ? 'active' : ''} ${arrow ? 'page-btn-arrow' : ''}" ${disabled ? 'disabled' : ''} data-page="${page}" aria-label="Page ${page}">${label}</button>`

  const middle = paginationPageList(feedPage, totalPages)
    .map(p => p === '...' ? `<span class="page-ellipsis">…</span>` : btn(p, p, { active: p === feedPage }))
    .join('')

  el.innerHTML = `
    <div class="pagination">
      ${btn(chevronLeftSvg(), feedPage - 1, { disabled: feedPage === 1, arrow: true })}
      ${middle}
      ${btn(chevronRightSvg(), feedPage + 1, { disabled: feedPage === totalPages, arrow: true })}
    </div>
    <div class="pagination-info">Page ${feedPage} of ${totalPages} · ${totalItems} codes</div>
  `

  el.querySelectorAll('.page-btn[data-page]').forEach(b => {
    b.onclick = () => {
      if (b.disabled) return
      const page = parseInt(b.dataset.page, 10)
      if (Number.isInteger(page)) goToFeedPage(page)
    }
  })
}

function buildTagPills() {
  const el = document.getElementById('feedTagPills')
  if (!el) return
  const counts = {}
  feedAll.forEach(s => (s.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
  const tags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)
  if (!tags.length) { el.innerHTML = ''; return }
  el.innerHTML = tags.map(([t, n]) =>
    `<button type="button" class="tag-pill ${feedActiveTag === t ? 'active' : ''}" data-tag="${escapeHtml(t)}">#${escapeHtml(t)} <span class="tag-count">${n}</span></button>`
  ).join('')
  el.querySelectorAll('.tag-pill').forEach(btn => {
    btn.onclick = () => {
      const tag = btn.dataset.tag
      feedActiveTag = feedActiveTag === tag ? null : tag
      el.querySelectorAll('.tag-pill').forEach(b => b.classList.toggle('active', b.dataset.tag === feedActiveTag))
      resetFeedPage()
      renderActiveChips()
      renderFeed()
    }
  })
}

function buildLangPills() {
  const el = document.getElementById('feedLangRow')
  if (!el) return
  const counts = {}
  feedAll.forEach(s => { const l = (s.language || 'text').toLowerCase(); counts[l] = (counts[l] || 0) + 1 })
  const langs = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  if (!langs.length) { el.innerHTML = ''; return }
  el.innerHTML = `<button type="button" class="lang-pill ${!feedActiveLang ? 'active' : ''}" data-lang="">All</button>` +
    langs.map(([l, n]) =>
      `<button type="button" class="lang-pill ${feedActiveLang === l ? 'active' : ''}" data-lang="${escapeHtml(l)}">${escapeHtml(l)} <span class="tag-count">${n}</span></button>`
    ).join('')
  el.querySelectorAll('.lang-pill').forEach(btn => {
    btn.onclick = () => {
      feedActiveLang = btn.dataset.lang || null
      el.querySelectorAll('.lang-pill').forEach(b => b.classList.toggle('active', (b.dataset.lang || null) === feedActiveLang))
      resetFeedPage()
      renderActiveChips()
      renderFeed()
    }
  })
}

function getRecentViews() {
  try {
    return JSON.parse(localStorage.getItem('codery-recent-views') || '[]')
  } catch { return [] }
}

function renderRecentSection() {
  const el = document.getElementById('recentSection')
  if (!el) return
  const recent = getRecentViews().slice(0, 3)
  if (!recent.length) { el.style.display = 'none'; el.innerHTML = ''; return }
  el.style.display = 'block'
  el.innerHTML = `
    <div class="recent-head">
      <span class="recent-title">Recent</span>
      <button type="button" class="recent-clear" id="clearRecentBtn">Clear</button>
    </div>
    <div class="recent-scroll">
      ${recent.map(r => `
        <a class="recent-chip" href="${codeUrl(r.shortId)}">${escapeHtml(r.title || r.shortId)}</a>
      `).join('')}
    </div>
  `
  document.getElementById('clearRecentBtn')?.addEventListener('click', () => {
    localStorage.removeItem('codery-recent-views')
    renderRecentSection()
  })
}

function renderActiveChips() {
  const el = document.getElementById('feedActiveChips')
  if (!el) return
  const chips = []
  if (feedActiveLang) chips.push({ type: 'lang', label: feedActiveLang })
  if (feedActiveTag) chips.push({ type: 'tag', label: '#' + feedActiveTag })
  if (!chips.length) { el.hidden = true; el.innerHTML = ''; return }
  el.hidden = false
  el.innerHTML = chips.map(c =>
    `<button type="button" class="active-chip" data-type="${c.type}">${escapeHtml(c.label)} ×</button>`
  ).join('') + `<button type="button" class="active-chip-clear" id="clearAllFilters">Clear</button>`
  el.querySelectorAll('.active-chip').forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.type === 'lang') feedActiveLang = null
      if (btn.dataset.type === 'tag') feedActiveTag = null
      document.querySelectorAll('.lang-pill').forEach(b => b.classList.toggle('active', (b.dataset.lang || null) === feedActiveLang))
      document.querySelectorAll('#feedTagPills .tag-pill').forEach(b => b.classList.toggle('active', b.dataset.tag === feedActiveTag))
      resetFeedPage()
      renderActiveChips()
      renderFeed()
    }
  })
  document.getElementById('clearAllFilters')?.addEventListener('click', () => {
    feedActiveLang = null
    feedActiveTag = null
    document.querySelectorAll('.lang-pill').forEach(b => b.classList.toggle('active', !b.dataset.lang))
    document.querySelectorAll('#feedTagPills .tag-pill').forEach(b => b.classList.remove('active'))
    resetFeedPage()
    renderActiveChips()
    renderFeed()
  })
}

function renderFeed(opts = {}) {
  const list = document.getElementById('feedList')
  const pagerEl = document.getElementById('feedPagination')
  const query = (document.getElementById('feedSearch')?.value || '').trim().toLowerCase()

  let items = feedAll.filter(s => {
    if (feedSort === 'following' && followingSet.size) {
      if (!followingSet.has((s.ownerUsername || '').toLowerCase())) return false
    }
    if (feedActiveTag && !(s.tags || []).includes(feedActiveTag)) return false
    if (feedActiveLang && (s.language || '').toLowerCase() !== feedActiveLang) return false
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
    let msg = 'No public code yet. Be the first!'
    if (feedAll.length) {
      if (feedSort === 'following') msg = followingSet.size ? 'No posts from people you follow yet.' : 'Follow someone to see their posts here.'
      else msg = 'No matches. Try another keyword.'
    }
    list.innerHTML = `<div class="empty-state">${msg}</div>`
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
  wireCopyLinkButtons(list)
  renderPagination(items.length, totalPages)

  if (opts.scroll) {
    list.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

async function loadFollowing() {
  followingSet = new Set()
  if (!me || !me.username) return
  try {
    const list = await api(`/users/${encodeURIComponent(me.username)}/following`)
    if (!Array.isArray(list)) return
    list.forEach(u => {
      const name = typeof u === 'string' ? u : (u && u.username)
      if (name) followingSet.add(String(name).toLowerCase())
    })
  } catch { /* ignore */ }
}

async function loadFeed() {
  const list = document.getElementById('feedList')
  list.innerHTML = skelFeedList(3)
  try {
    await refreshAuth()
    const [codes] = await Promise.all([
      api('/codes').catch(err => { throw err }),
      loadFollowing().catch(() => {})
    ])
    feedAll = Array.isArray(codes) ? codes : []
    const pageFromUrl = parseInt(qs('page'), 10)
    feedPage = Number.isInteger(pageFromUrl) && pageFromUrl > 0 ? pageFromUrl : 1
    buildTagPills()
    buildLangPills()
    renderActiveChips()
    renderRecentSection()
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
document.getElementById('feedSortTabs')?.querySelectorAll('.feed-tab').forEach(btn => {
  btn.onclick = async () => {
    feedSort = btn.dataset.sort
    document.getElementById('feedSortTabs').querySelectorAll('.feed-tab').forEach(b => b.classList.toggle('active', b === btn))
    if (feedSort === 'following' && !followingSet.size) await loadFollowing()
    resetFeedPage()
    renderFeed()
  }
})

// search icon
const iconEl = document.getElementById('feedSearchIcon')
if (iconEl) iconEl.innerHTML = searchIconSvg()

document.getElementById('feedFilterToggle')?.addEventListener('click', () => {
  const box = document.getElementById('feedFilters')
  const btn = document.getElementById('feedFilterToggle')
  if (!box || !btn) return
  const open = box.hasAttribute('hidden')
  if (open) box.removeAttribute('hidden')
  else box.setAttribute('hidden', '')
  btn.classList.toggle('active', open)
  btn.setAttribute('aria-expanded', open ? 'true' : 'false')
})

refreshAuth().then(loadFeed)
