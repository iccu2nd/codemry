
async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  const container = document.getElementById('likedPage')
  try {
    const snippets = await api('/codes/liked')
    container.innerHTML = `
      <div class="section-label">Liked Code</div>
      <div id="likedList">${snippets.length ? snippets.map(snippetCard).join('') : `<div class="card">${emptyStateHtml({ title: 'No liked code yet', sub: 'Like code on the feed to see it here.' })}</div>`}</div>
    `
    highlightAllIn('#likedList pre code')
    wireLikeButtons(document.getElementById('likedList'))
    wireBookmarkButtons(document.getElementById('likedList'))
    wireCopyLinkButtons(document.getElementById('likedList'))
  } catch (e) {
    container.innerHTML = `<div class="card">${emptyStateHtml({ title: escapeHtml(e.message) })}</div>`
  }
}

init()
