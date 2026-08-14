
async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  const container = document.getElementById('bookmarksPage')
  try {
    const snippets = await api('/codes/bookmarked')
    container.innerHTML = `
      <div class="section-label">Kode Tersimpan</div>
      <div id="bookmarksList">${snippets.length ? snippets.map(snippetCard).join('') : `<div class="card"><div class="empty-state">Belum ada kode yang disimpan. Tap ikon bookmark di kode manapun buat nyimpen ke sini.</div></div>`}</div>
    `
    highlightAllIn('#bookmarksList pre code')
    wireLikeButtons(document.getElementById('bookmarksList'))
    wireBookmarkButtons(document.getElementById('bookmarksList'), { removeOnUnsave: true })
  } catch (e) {
    container.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

init()
