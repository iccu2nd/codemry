async function init() {
  await refreshAuth()
  const id = new URLSearchParams(location.search).get('id')
  const container = document.getElementById('collectionPage')
  if (!id) {
    container.innerHTML = `<div class="card">${emptyStateHtml({ title: 'Collection not found' })}</div>`
    return
  }
  try {
    const data = await api(`/collections/${encodeURIComponent(id)}`)
    document.title = `${data.title} · Codery`
    renderCollection(container, data)
  } catch (e) {
    container.innerHTML = `<div class="card">${emptyStateHtml({ title: escapeHtml(e.message) })}</div>`
  }
}

function renderCollection(container, data) {
  const count = (data.snippets || []).length
  const vis = data.isPublic !== false
    ? `<span class="col-badge col-badge-public">Public</span>`
    : `<span class="col-badge col-badge-private">Private</span>`

  const ownerActions = data.isOwner ? `
    <div class="col-owner-actions">
      <button type="button" class="btn btn-sm" id="editColBtn">Edit</button>
      <button type="button" class="btn btn-sm btn-danger-ghost" id="delColBtn">Delete</button>
    </div>` : ''

  container.innerHTML = `
    <div class="col-detail-head">
      <a class="col-back" href="${data.isOwner ? '/collections' : profileUrl(data.ownerUsername)}">← Back</a>
      <h1 class="col-detail-title">${escapeHtml(data.title)}</h1>
      <div class="col-detail-meta">
        ${vis}
        <span>·</span>
        <span>${count} code${count === 1 ? '' : 's'}</span>
        <span>·</span>
        <a href="${profileUrl(data.ownerUsername)}" class="col-owner-link">@${escapeHtml(data.ownerUsername)}</a>
      </div>
      ${data.description ? `<p class="col-detail-desc">${escapeHtml(data.description)}</p>` : ''}
      ${ownerActions}
    </div>
    <div id="colSnippets">
      ${count
        ? data.snippets.map(s => {
            let card = snippetCard(s)
            if (data.isOwner) {
              card = card.replace(
                '</footer>',
                `<button type="button" class="btn btn-sm col-remove-btn" data-code="${escapeHtml(s.shortId)}" title="Remove from collection">Remove</button></footer>`
              )
            }
            return card
          }).join('')
        : `<div class="card">${emptyStateHtml({
            title: 'Empty collection',
            sub: data.isOwner
              ? 'Open any code and use “Add to collection” in the more menu.'
              : 'No codes in this collection yet.'
          })}</div>`}
    </div>
  `

  highlightAllIn('#colSnippets pre code')
  wireLikeButtons(document.getElementById('colSnippets'))
  wireBookmarkButtons(document.getElementById('colSnippets'))
  wireCopyLinkButtons(document.getElementById('colSnippets'))

  if (data.isOwner) {
    document.getElementById('editColBtn')?.addEventListener('click', () => openEditModal(data))
    document.getElementById('delColBtn')?.addEventListener('click', () => confirmDelete(data))
    document.querySelectorAll('.col-remove-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const codeId = btn.dataset.code
        try {
          await api(`/collections/${encodeURIComponent(data.shortId)}/codes/${encodeURIComponent(codeId)}`, { method: 'DELETE' })
          toast('Removed from collection')
          init()
        } catch (err) { toast(err.message) }
      })
    })
  }
}

function openEditModal(data) {
  openModal(`
    <div class="modal-head">
      <div class="modal-head-title">Edit collection</div>
      <button class="modal-close-btn" onclick="closeModal()">${closeIconSvg()}</button>
    </div>
    <div class="modal-body">
      <div class="field"><label>Title</label>
        <input type="text" id="colTitle" maxlength="80" value="${escapeHtml(data.title)}">
      </div>
      <div class="field"><label>Description</label>
        <textarea id="colDesc" rows="2" maxlength="300">${escapeHtml(data.description || '')}</textarea>
      </div>
      <label class="col-check-row" style="margin-top:4px">
        <input type="checkbox" id="colPublic" ${data.isPublic !== false ? 'checked' : ''}>
        <span>Public — anyone can view this collection</span>
      </label>
      <div class="modal-actions" style="margin-top:16px">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-primary" id="colSaveBtn">Save</button>
      </div>
    </div>
  `)
  document.getElementById('colSaveBtn').onclick = async () => {
    const title = document.getElementById('colTitle').value.trim()
    if (!title) { toast('Please enter a title'); return }
    const btn = document.getElementById('colSaveBtn')
    btn.disabled = true
    try {
      await api(`/collections/${encodeURIComponent(data.shortId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          description: document.getElementById('colDesc').value.trim(),
          isPublic: document.getElementById('colPublic').checked
        })
      })
      toast('Saved')
      closeModal()
      init()
    } catch (e) {
      toast(e.message)
      btn.disabled = false
    }
  }
}

function confirmDelete(data) {
  openModal(`
    <div class="modal-head">
      <div class="modal-head-title">Delete collection?</div>
      <button class="modal-close-btn" onclick="closeModal()">${closeIconSvg()}</button>
    </div>
    <div class="modal-body">
      <p style="margin:0 0 14px;color:var(--text-secondary);font-size:14px">
        “${escapeHtml(data.title)}” will be deleted. Codes inside are not deleted — only the collection.
      </p>
      <div class="modal-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn btn-danger" id="colConfirmDel">Delete</button>
      </div>
    </div>
  `)
  document.getElementById('colConfirmDel').onclick = async () => {
    try {
      await api(`/collections/${encodeURIComponent(data.shortId)}`, { method: 'DELETE' })
      toast('Collection deleted')
      closeModal()
      window.location.href = '/collections'
    } catch (e) { toast(e.message) }
  }
}

init()
