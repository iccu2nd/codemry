
async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  const container = document.getElementById('bookmarksPage')
  try {
    const snippets = await api('/codes/bookmarked')
    container.innerHTML = `
      <div class="section-label">Saved Codes</div>
      <div id="bookmarksList">${snippets.length ? snippets.map(snippetCard).join('') : `<div class="card"><div class="empty-state">No saved code yet. Tap the bookmark icon on any code to save it here.</div></div>`}</div>
    `
    highlightAllIn('#bookmarksList pre code')
    wireLikeButtons(document.getElementById('bookmarksList'))
    wireBookmarkButtons(document.getElementById('bookmarksList'), { removeOnUnsave: true })
    wireCopyLinkButtons(document.getElementById('bookmarksList'))
  } catch (e) {
    container.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

init()
