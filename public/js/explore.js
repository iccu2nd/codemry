async function renderExplore() {
  const app = document.getElementById('exploreApp')
  if (!app) return
  app.innerHTML = `
    <div class="card">
      <div class="explore-hero">
        <h1 class="explore-title">Explore</h1>
        <p class="explore-sub">Trending codes from the last 7 days</p>
      </div>
      <div id="exploreList" class="snippet-list">${typeof skelBlock === 'function' ? skelBlock(100, 24) + skelBlock(100, 24) : 'Loading…'}</div>
    </div>`
  try {
    if (window.authReady) await window.authReady
    const data = await api('/codes/explore/trending')
    const list = document.getElementById('exploreList')
    const items = data.items || []
    if (!items.length) {
      list.innerHTML = emptyStateHtml({ title: 'Nothing trending yet', sub: 'Share a code to get things started.' })
      return
    }
    // reuse card renderer if available
    if (typeof snippetCardHtml === 'function') {
      list.innerHTML = items.map(s => snippetCardHtml(s)).join('')
      if (typeof wireLikeButtons === 'function') wireLikeButtons(list)
      if (typeof wireSnippetCards === 'function') wireSnippetCards(list)
    } else {
      list.innerHTML = items.map((s, i) => `
        <a class="explore-item" href="${codeUrl(s.shortId)}">
          <span class="explore-rank">#${i + 1}</span>
          <div class="explore-item-body">
            <div class="explore-item-title">${escapeHtml(s.title || s.filename || 'Untitled')}</div>
            <div class="explore-item-meta">@${escapeHtml(s.ownerUsername || '')} · ${escapeHtml(s.language || '')} · ★ ${s.likes || 0} · ${s.views || 0} views</div>
          </div>
        </a>`).join('')
    }
  } catch (e) {
    const list = document.getElementById('exploreList')
    if (list) list.innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderExplore()
})
