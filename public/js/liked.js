
async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  const container = document.getElementById('likedPage')
  try {
    const snippets = await api('/codes/liked')
    container.innerHTML = `
      <div class="section-label">Kode yang Disukai</div>
      <div id="likedList">${snippets.length ? snippets.map(snippetCard).join('') : `<div class="card"><div class="empty-state">Belum ada kode yang disukai.</div></div>`}</div>
    `
    highlightAllIn('#likedList pre code')
    wireLikeButtons(document.getElementById('likedList'))
    wireBookmarkButtons(document.getElementById('likedList'))
  } catch (e) {
    container.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

init()
