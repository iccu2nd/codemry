async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  const container = document.getElementById('collectionsPage')
  try {
    const list = await api('/collections/mine')
    renderList(container, list)
  } catch (e) {
    container.innerHTML = `<div class="card">${emptyStateHtml({ title: escapeHtml(e.message) })}</div>`
  }
}

function collectionCard(c) {
  const count = c.count || (c.shortIds || []).length || 0
  const vis = c.isPublic !== false
    ? `<span class="col-badge col-badge-public">Public</span>`
    : `<span class="col-badge col-badge-private">Private</span>`
  return `
    <a class="col-card" href="/collection?id=${encodeURIComponent(c.shortId)}">
      <div class="col-card-main">
        <div class="col-card-title">${escapeHtml(c.title)}</div>
        <div class="col-card-meta">${count} code${count === 1 ? '' : 's'} · ${vis}</div>
        ${c.description ? `<div class="col-card-desc">${escapeHtml(truncateText(c.description, 100))}</div>` : ''}
      </div>
      <div class="col-card-arrow" aria-hidden="true">›</div>
    </a>`
}

function renderList(container, list) {
  container.innerHTML = `
    <div class="col-page-head">
      <div>
        <div class="section-label" style="margin:0 0 4px">My Collections</div>
        <p class="field-hint" style="margin:0">Group codes into series, playlists, or folders.</p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="newColBtn">New collection</button>
    </div>
    <div id="colList">
      ${list.length
        ? list.map(collectionCard).join('')
        : `<div class="card">${emptyStateHtml({
            title: 'No collections yet',
            sub: 'Create one to organize your favorite codes or build a tutorial series.'
          })}</div>`}
    </div>
  `
  document.getElementById('newColBtn')?.addEventListener('click', () => openCreateModal(() => init()))
}

function openCreateModal(onDone) {
  openModal(`
    <div class="modal-head">
      <div class="modal-head-title">New collection</div>
      <button class="modal-close-btn" onclick="closeModal()">${closeIconSvg()}</button>
    </div>
    <div class="modal-body">
      <div class="field"><label>Title</label>
        <input type="text" id="colTitle" maxlength="80" placeholder="e.g. Python basics" autofocus>
      </div>
      <div class="field"><label>Description <span class="label-opt">(optional)</span></label>
        <textarea id="colDesc" rows="2" maxlength="300" placeholder="What is this collection about?"></textarea>
      </div>
      <label class="col-check-row" style="margin-top:4px">
        <input type="checkbox" id="colPublic" checked>
        <span>Public — anyone can view this collection</span>
      </label>
      <div class="modal-actions" style="margin-top:16px">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-primary" id="colCreateBtn">Create</button>
      </div>
    </div>
  `)
  document.getElementById('colCreateBtn').onclick = async () => {
    const title = document.getElementById('colTitle').value.trim()
    if (!title) { toast('Please enter a title'); return }
    const btn = document.getElementById('colCreateBtn')
    btn.disabled = true
    try {
      await api('/collections', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: document.getElementById('colDesc').value.trim(),
          isPublic: document.getElementById('colPublic').checked
        })
      })
      toast('Collection created')
      closeModal()
      if (onDone) onDone()
    } catch (e) {
      toast(e.message)
      btn.disabled = false
    }
  }
}

init()
