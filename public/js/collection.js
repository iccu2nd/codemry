async function init() {
  const app = document.getElementById('collectionPage')
  const id = qs('id')
  if (!id) {
    app.innerHTML = `<div class="card"><div class="empty-state">Collection not found.</div></div>`
    return
  }
  try {
    await refreshAuth()
    const c = await api(`/collections/${encodeURIComponent(id)}`)
    const isOwner = !!c.isOwner
    app.innerHTML = `
      <div class="card">
        <div class="collection-head">
          <div>
            <div class="section-label" style="margin:0 0 6px">Collection</div>
            <h1 class="cd-title" style="margin:0">${escapeHtml(c.name)}</h1>
            ${c.description ? `<p class="sc-desc" style="margin-top:8px">${escapeHtml(c.description)}</p>` : ''}
            <div class="sc-meta" style="margin-top:8px">
              <a class="user-link" href="${profileUrl(c.username)}">@${escapeHtml(c.username)}</a>
              <span class="sc-meta-dot">·</span>
              <span>${c.count || 0} codes</span>
              ${c.isPublic === false ? `<span class="sc-meta-dot">·</span><span>Private</span>` : ''}
            </div>
          </div>
          ${isOwner ? `<button type="button" class="btn btn-white btn-sm" id="delCollectionBtn">Delete</button>` : ''}
        </div>
      </div>
      <div id="collectionList">
        ${(c.snippets || []).length
          ? c.snippets.map(snippetCard).join('')
          : `<div class="card"><div class="empty-state">No codes in this collection yet.</div></div>`}
      </div>
    `
    highlightAllIn('#collectionList pre code')
    wireLikeButtons(document.getElementById('collectionList'))
    wireBookmarkButtons(document.getElementById('collectionList'))
    document.getElementById('delCollectionBtn')?.addEventListener('click', async () => {
      if (!confirm('Delete this collection? Codes stay on Codery.')) return
      try {
        await api(`/collections/${encodeURIComponent(id)}`, { method: 'DELETE' })
        toast('Collection deleted')
        window.location.href = profileUrl(c.username)
      } catch (e) { toast(e.message) }
    })
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

document.addEventListener('DOMContentLoaded', init)
