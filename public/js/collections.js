
async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  const container = document.getElementById('collectionsPage')
  try {
    const list = await api('/collections/mine')
    renderCollectionsPage(container, list)
  } catch (e) {
    container.innerHTML = `<div class="card">${emptyStateHtml({ title: escapeHtml(e.message) })}</div>`
  }
}

function renderCollectionsPage(container, list) {
  container.innerHTML = `
    <div class="col-page-head">
      <div>
        <h1 style="font-size:20px;font-weight:700;margin:0 0 4px">My Collections</h1>
        <p class="field-hint" style="margin:0">Group your codes into collections others can browse.</p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="newColBtn">+ New</button>
    </div>
    <div id="colList">
      ${list.length ? list.map(collectionCardHtml).join('') : `<div class="card">${emptyStateHtml({
        title: 'No collections yet',
        sub: 'Create one to start organizing your codes into a series others can browse.'
      })}</div>`}
    </div>
  `
  document.getElementById('newColBtn').addEventListener('click', openCreateCollectionModal)
}

function collectionCardHtml(c) {
  const n = c.count ?? (c.shortIds || []).length ?? 0
  const vis = c.isPublic === false
    ? `<span class="col-badge col-badge-private">Private</span>`
    : `<span class="col-badge col-badge-public">Public</span>`
  return `
    <a class="col-card" href="/collection?id=${encodeURIComponent(c.shortId)}">
      <div class="col-card-main">
        <div class="col-card-title">${escapeHtml(c.title)}</div>
        <div class="col-card-meta">${vis}<span>·</span><span>${n} code${n === 1 ? '' : 's'}</span></div>
        ${c.description ? `<div class="col-card-desc">${escapeHtml(c.description)}</div>` : ''}
      </div>
      <span class="col-card-arrow">›</span>
    </a>`
}

function openCreateCollectionModal() {
  openModal(`
    <div class="modal-head">
      <div class="modal-head-title">New collection</div>
      <button class="modal-close-btn" onclick="closeModal()">${closeIconSvg()}</button>
    </div>
    <div class="modal-body">
      <div class="field"><label>Title</label>
        <input type="text" id="newColTitle" maxlength="80" placeholder="e.g. Useful snippets" autofocus>
      </div>
      <div class="field"><label>Description <span class="label-opt">(optional)</span></label>
        <textarea id="newColDesc" rows="2" maxlength="300" placeholder="What's this collection about?"></textarea>
      </div>
      <label class="col-check-row">
        <input type="checkbox" id="newColPublic" checked>
        <span>Public — anyone can view this collection</span>
      </label>
      <div class="modal-actions" style="margin-top:14px">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-primary" id="newColSaveBtn">Create</button>
      </div>
    </div>
  `)
  const titleInput = document.getElementById('newColTitle')
  const submit = async () => {
    const title = titleInput.value.trim()
    if (!title) { toast('Please enter a title'); return }
    const btn = document.getElementById('newColSaveBtn')
    setBtnLoading(btn, true)
    try {
      const created = await api('/collections', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: document.getElementById('newColDesc').value.trim(),
          isPublic: document.getElementById('newColPublic').checked
        })
      })
      closeModal()
      window.location.href = `/collection?id=${encodeURIComponent(created.shortId)}`
    } catch (e) {
      toast(e.message)
      setBtnLoading(btn, false)
    }
  }
  document.getElementById('newColSaveBtn').onclick = submit
  titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit() })
}

init()
