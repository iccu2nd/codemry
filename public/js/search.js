
// ============================================================
// Halaman Search (referensi TikTok): header sticky berisi tombol
// Back + search bar + tombol "Cari", lalu Riwayat Pencarian dan
// Trending selama user belum ngetik apa-apa. Begitu ada query
// (lewat ketik, tombol Cari, atau tap riwayat/trending), tampilan
// pindah ke daftar hasil (dirender oleh feed.js lewat #feedList).
// ============================================================

const SEARCH_HISTORY_KEY = 'codery_search_history'
const SEARCH_HISTORY_MAX = 10

function loadSearchHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter(t => typeof t === 'string' && t.trim()) : []
  } catch { return [] }
}

function saveSearchHistory(list) {
  try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, SEARCH_HISTORY_MAX))) } catch {}
}

function addToSearchHistory(term) {
  term = term.trim()
  if (!term) return
  const list = loadSearchHistory().filter(t => t.toLowerCase() !== term.toLowerCase())
  list.unshift(term)
  saveSearchHistory(list)
  renderSearchHistory()
}

function removeFromSearchHistory(term) {
  saveSearchHistory(loadSearchHistory().filter(t => t !== term))
  renderSearchHistory()
}

function clearSearchHistory() {
  saveSearchHistory([])
  renderSearchHistory()
}

function historyClockIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>`
}

function renderSearchHistory() {
  const section = document.getElementById('historySection')
  const list = document.getElementById('historyList')
  if (!section || !list) return
  const items = loadSearchHistory()
  if (!items.length) { section.style.display = 'none'; list.innerHTML = ''; return }

  section.style.display = 'block'
  list.innerHTML = items.map(term => `
    <div class="search-history-row" data-term="${escapeHtml(term)}" role="button" tabindex="0" aria-label="Cari lagi: ${escapeHtml(term)}">
      <span class="search-history-icon">${historyClockIconSvg()}</span>
      <span class="search-history-text">${escapeHtml(term)}</span>
      <button type="button" class="search-history-remove" data-term="${escapeHtml(term)}" aria-label="Hapus '${escapeHtml(term)}' dari riwayat">
        ${closeIconSvg()}
      </button>
    </div>`).join('')

  list.querySelectorAll('.search-history-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.search-history-remove')) return
      runSearch(row.dataset.term)
    })
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runSearch(row.dataset.term) }
    })
  })
  list.querySelectorAll('.search-history-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      removeFromSearchHistory(btn.dataset.term)
    })
  })
}

document.getElementById('clearHistoryBtn')?.addEventListener('click', clearSearchHistory)

// ---- Trending: dihitung dari kode publik yang ada (like*3 + views),
// dijumlah per-tag, lalu diambil 10 tag teratas. ----
function trendingSearchScore(s) {
  return (s.likes || 0) * 3 + (s.views || 0)
}

async function loadTrendingSearch() {
  const wrap = document.getElementById('trendingList')
  if (!wrap) return
  wrap.innerHTML = skelRowList(4)
  try {
    const codes = await api('/codes')
    const scoreByTag = new Map()
    const countByTag = new Map()
    codes.forEach(s => {
      const score = trendingSearchScore(s)
      ;(s.tags || []).forEach(t => {
        scoreByTag.set(t, (scoreByTag.get(t) || 0) + score)
        countByTag.set(t, (countByTag.get(t) || 0) + 1)
      })
    })
    const ranked = [...scoreByTag.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)

    if (!ranked.length) {
      wrap.innerHTML = `<div class="empty-state-sm">Belum ada tren. Upload kode & pakai tag biar muncul di sini!</div>`
      return
    }

    wrap.innerHTML = ranked.map(([tag, _score], i) => `
      <button type="button" class="search-trend-row" data-term="${escapeHtml(tag)}" aria-label="Cari tag ${escapeHtml(tag)}">
        <span class="search-trend-rank">#${i + 1}</span>
        <span class="search-trend-body">
          <span class="search-trend-tag">#${escapeHtml(tag)}</span>
          <span class="search-trend-sub">${countByTag.get(tag)} kode</span>
        </span>
        <span class="search-trend-arrow">${chevronRightSvg()}</span>
      </button>`).join('')

    wrap.querySelectorAll('.search-trend-row').forEach(btn => {
      btn.onclick = () => runSearch(btn.dataset.term)
    })
  } catch (e) {
    wrap.innerHTML = `<div class="empty-state-sm">${escapeHtml(e.message)}</div>`
  }
}

// ---- Ganti tampilan: Idle (riwayat + trending) <-> Hasil pencarian ----
function showSearchIdleView() {
  document.getElementById('searchIdleView').style.display = 'block'
  document.getElementById('searchResultsView').style.display = 'none'
}

function showSearchResultsView() {
  document.getElementById('searchIdleView').style.display = 'none'
  document.getElementById('searchResultsView').style.display = 'block'
}

function updateClearBtnVisibility() {
  const input = document.getElementById('feedSearch')
  const clearBtn = document.getElementById('clearSearchBtn')
  if (!input || !clearBtn) return
  clearBtn.style.display = input.value ? 'flex' : 'none'
}

function runSearch(term) {
  const input = document.getElementById('feedSearch')
  if (!input) return
  input.value = term
  updateClearBtnVisibility()
  addToSearchHistory(term)
  resetFeedPage()
  renderFeed()
  showSearchResultsView()
  input.blur()
}

document.getElementById('searchSubmitBtn')?.addEventListener('click', () => {
  const input = document.getElementById('feedSearch')
  const val = (input?.value || '').trim()
  if (!val) { input?.focus(); return }
  runSearch(val)
})

document.getElementById('feedSearch')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('searchSubmitBtn')?.click() }
})

document.getElementById('feedSearch')?.addEventListener('input', () => {
  updateClearBtnVisibility()
  const val = document.getElementById('feedSearch').value.trim()
  if (val) showSearchResultsView()
  else showSearchIdleView()
})

document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
  const input = document.getElementById('feedSearch')
  input.value = ''
  updateClearBtnVisibility()
  showSearchIdleView()
  input.focus()
})

document.getElementById('backToIdleBtn')?.addEventListener('click', () => {
  const input = document.getElementById('feedSearch')
  input.value = ''
  updateClearBtnVisibility()
  showSearchIdleView()
})

renderSearchHistory()
loadTrendingSearch()
showSearchIdleView()
