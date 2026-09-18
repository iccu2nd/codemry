
async function renderCodeDetail(authReady) {
  const app = document.getElementById('app')
  const shortId = qs('id')
  if (!shortId) { app.innerHTML = `<div class="card"><div class="empty-state">Kode tidak ditemukan.</div></div>`; return }
  try {
    const [s] = await Promise.all([api(`/codes/${shortId}`), authReady])
    if (s.locked && s.content == null && !(me && me.username === s.ownerUsername)) {
      renderLockedCard(app, shortId, s)
      return
    }
    renderUnlockedDetail(app, shortId, s)
  } catch (e) {
    app.innerHTML = `<div class="card"><div class="empty-state">${escapeHtml(e.message)}</div></div>`
  }
}

function renderLockedCard(app, shortId, s) {
  app.innerHTML = `
    <div class="card">
      <div class="lock-screen">
        ${lockIconSvg()}
        <div class="lock-title">Kode Ini Dikunci</div>
        <div class="lock-sub">Diunggah oleh ${escapeHtml(s.ownerNickname || s.ownerUsername)}. Masukkan PIN untuk melihat kodenya.</div>
        <div class="field"><input type="tel" inputmode="numeric" pattern="[0-9]*" id="unlockPin" maxlength="8" placeholder="Masukkan PIN"></div>
        <button class="btn btn-primary btn-block" id="unlockBtn">Buka Kode</button>
      </div>
    </div>`
  const pinInput = document.getElementById('unlockPin')
  const unlockBtn = document.getElementById('unlockBtn')
  pinInput.focus()
  pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlockBtn.click() })
  unlockBtn.onclick = async () => {
    const pin = pinInput.value.trim()
    if (!pin) { toast('Masukkan PIN dulu'); return }
    unlockBtn.disabled = true
    try {
      const full = await api(`/codes/${shortId}/unlock`, { method: 'POST', body: JSON.stringify({ pin }) })
      renderUnlockedDetail(app, shortId, full)
    } catch (e) { toast(e.message) }
    finally { unlockBtn.disabled = false }
  }
}

function renderUnlockedDetail(app, shortId, s) {
    app.innerHTML = `
      <div class="card">
        <div id="detailInfo">
        <div class="snippet-head">
          <div class="snippet-head-info">
            <a href="${profileUrl(s.ownerUsername)}" aria-label="Lihat profil @${escapeHtml(s.ownerUsername)}">
              ${avatarHtml(s.ownerAvatar, s.ownerNickname || s.ownerUsername, 'avatar-circle-sm', 'clickable')}
            </a>
            <div>
              <div class="snippet-uploader">${escapeHtml(s.ownerNickname || s.ownerUsername)}${badgesHtml(s.ownerBadges)}${devBadgeHtml(s.ownerIsDeveloper)}${roleBadgeHtml(s.ownerRole)}</div>
              <div class="snippet-meta"><a class="user-link" href="${profileUrl(s.ownerUsername)}">@${escapeHtml(s.ownerUsername)}</a></div>
            </div>
          </div>
          <div class="snippet-head-right">
            ${langIconHtml(s.language)}
            ${s.locked ? `<span class="lock-badge" title="Dikunci PIN">${lockIconSvg()}</span>` : ''}
          </div>
        </div>
        <div class="snippet-title">${escapeHtml(s.title)}</div>
        <div class="snippet-meta snippet-file-meta">${escapeHtml(s.filename)} · ${timeAgo(s.createdAt)} · ${formatViews(s.views)}</div>
        ${s.forkedFrom ? `<a class="forked-from-badge" href="${codeUrl(s.forkedFrom.shortId)}">${forkIconSvg()} Fork dari kode <b>${escapeHtml(s.forkedFrom.ownerNickname)}</b></a>` : ''}
        ${s.description ? `<div class="snippet-desc snippet-desc-detail">${formatWaText(s.description)}</div>` : ''}
        ${s.tags && s.tags.length ? `<div class="tag-row">${s.tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="detail-divider"></div>
        <div class="action-toolbar">
          <div class="action-primary">
            <button class="action-btn action-btn-main" id="copyBtn" type="button">${copyIconSvg()}<span>Copy</span></button>
            <button class="action-btn action-btn-main" type="button" onclick="window.open('/raw/${s.shortId}','_blank')">${rawIconSvg()}<span>Raw</span></button>
            <a class="action-btn action-btn-main" href="${profileUrl(s.ownerUsername)}">${userIconSvg()}<span>Profil</span></a>
          </div>
          <div class="action-secondary">
            <button class="action-btn" id="shareBtn" type="button">${shareIconSvg()}<span>Share</span></button>
            ${!me || me.username !== s.ownerUsername ? `<button class="action-btn" id="forkBtn" type="button">${forkIconSvg()}<span>Fork</span></button>` : ''}
            <button class="action-btn" id="downloadBtn" type="button">${downloadIconSvg()}<span>Download</span></button>
            <button class="action-btn" id="qrBtn" type="button">${qrIconSvg()}<span>QR</span></button>
            ${!me || me.username !== s.ownerUsername ? `<button class="action-btn" id="reportBtn" type="button">${flagIconSvg()}<span>Lapor</span></button>` : ''}
          </div>
        </div>
        <div class="detail-actions-row">
          <button type="button" class="like-btn like-btn-detail t-like ${s.likedByMe ? 'liked' : ''}" data-role="like" data-short="${s.shortId}" data-liked="${s.likedByMe ? 'true' : 'false'}">
            <span class="t-like-icon">${heartIconSvg()}</span>
            <span class="t-like-particles">${likeParticlesHtml()}</span>
            <span id="likeLabel">${s.likedByMe ? 'Disuka' : 'Suka'}</span> · <span class="like-count">${s.likes || 0}</span>
          </button>
          <button type="button" class="bookmark-btn bookmark-btn-detail ${s.savedByMe ? 'saved' : ''}" data-role="bookmark" data-short="${s.shortId}" data-saved="${s.savedByMe ? 'true' : 'false'}" title="Simpan">
            ${bookmarkIconSvg()}
          </button>
        </div>
        ${me && me.username === s.ownerUsername ? `
        <div class="btn-row" id="ownerActionsRow" style="margin-top:10px;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn btn-white" id="editBtn">Edit</button>
          <button class="btn btn-danger" id="delBtn">Hapus</button>
        </div>` : ''}
        </div>
        ${me && me.username !== s.ownerUsername ? `
        <div id="reportForm" style="display:none;margin-top:14px">
          <div class="field"><label>Alasan laporan</label>
            <select id="reportReason">
              <option value="vulgar">Konten vulgar/tidak pantas</option>
              <option value="spam">Spam/promosi</option>
              <option value="plagiarism">Plagiat/klaim kode orang lain</option>
              <option value="malware">Malware/kode berbahaya</option>
              <option value="other">Lainnya</option>
            </select>
          </div>
          <div class="field"><label>Detail (opsional)</label><textarea id="reportDetail" class="textarea-autogrow" style="min-height:60px" maxlength="300" placeholder="Jelasin lebih lanjut kalau perlu..."></textarea></div>
          <div class="snippet-meta" style="margin-bottom:12px">Laporan ini dikirim kepada pengelola Codery untuk ditinjau, bukan kepada pemilik kode.</div>
          <div class="btn-row">
            <button class="btn btn-white" id="cancelReportBtn">Batal</button>
            <button class="btn btn-danger" id="sendReportBtn">Kirim Laporan</button>
          </div>
        </div>` : ''}
        ${me && me.username === s.ownerUsername ? `
        <div id="editForm" style="display:none;margin-top:14px">
          <div class="field"><label>Judul</label><input id="editTitle" value="${escapeHtml(s.title)}" maxlength="120"></div>
          <div class="field"><label>Deskripsi (opsional)</label><textarea id="editDescription" class="textarea-autogrow" style="min-height:70px">${escapeHtml(s.description || '')}</textarea></div>
          <div class="field"><label>Tag (pisah koma, maks 5)</label><input id="editTags" value="${escapeHtml((s.tags || []).join(', '))}" placeholder="algoritma, tutorial, bug-fix"></div>
          <div class="field"><label>Nama File</label><input id="editFilename" value="${escapeHtml(s.filename)}" maxlength="80"></div>
          <div class="field"><label>Bahasa</label>
            <select id="editLanguage">
              ${['javascript', 'typescript', 'python', 'html', 'css', 'json', 'java', 'php', 'bash', 'markdown', 'text']
                .map(l => `<option value="${l}" ${s.language === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Kode</label><textarea id="editContent" style="min-height:160px;font-family:'JetBrains Mono',monospace;font-size:13px">${escapeHtml(s.content)}</textarea></div>
          <div class="checkbox-row"><input type="checkbox" id="editIsPublic" ${s.isPublic ? 'checked' : ''}><label for="editIsPublic">Publik (tampil di feed)</label></div>
          <div class="checkbox-row"><input type="checkbox" id="editUsePin" ${s.locked ? 'checked' : ''}><label for="editUsePin">Kunci pakai PIN</label></div>
          <div class="field" id="editPinField" style="display:${s.locked ? 'block' : 'none'}">
            <label>PIN ${s.locked ? 'baru (opsional)' : ''} (4-8 digit angka)</label>
            <input type="tel" inputmode="numeric" pattern="[0-9]*" id="editPinInput" maxlength="8" placeholder="${s.locked ? 'Kosongkan jika tidak ingin mengganti PIN' : 'misal 1234'}">
          </div>
          <div class="btn-row">
            <button class="btn btn-white" id="cancelEditBtn">Batal</button>
            <button class="btn btn-primary" id="saveEditBtn">Simpan</button>
          </div>
        </div>` : ''}
        <div class="code-window" id="codeWindow">
          <div class="code-window-bar">
            <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
            <span class="code-window-filename">${escapeHtml(s.filename)}</span>
            <div class="zoom-controls" id="zoomControls">
              <button type="button" class="zoom-btn" id="zoomOutBtn" title="Perkecil">−</button>
              <span class="zoom-level" id="zoomLevel">100%</span>
              <button type="button" class="zoom-btn" id="zoomInBtn" title="Perbesar">+</button>
            </div>
            <button type="button" class="code-expand-btn" id="codeFullscreenBtn" title="Perbesar kode">${expandIconSvg()}</button>
          </div>
          <pre class="code-view" id="codeViewPre"><code id="codeBlock" class="language-${hljsLang(s.language)}">${escapeHtml(s.content)}</code></pre>
        </div>

        <div class="comments-section" id="commentsSection">
          <div class="comments-title">Komentar <span id="commentCount"></span></div>
          <div id="commentForm"></div>
          <div id="commentList">${skelCommentList(2)}</div>
        </div>
      </div>
    `
    if (window.hljs) hljs.highlightElement(document.getElementById('codeBlock'))
    wireLikeButtons(app)
    wireBookmarkButtons(app)
    document.getElementById('copyBtn').onclick = () => { navigator.clipboard.writeText(s.content); toast('Kode disalin!') }
    document.getElementById('shareBtn').onclick = () => { navigator.clipboard.writeText(location.href); toast('Link disalin!') }

    const downloadBtn = document.getElementById('downloadBtn')
    if (downloadBtn) downloadBtn.onclick = () => {
      const blob = new Blob([s.content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = s.filename || `${s.shortId}.txt`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }


    const qrBtn = document.getElementById('qrBtn')
    if (qrBtn) qrBtn.onclick = () => {
      const pageUrl = location.href
      const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(pageUrl)}`
      openModal(`
        <div class="modal-head">
          <div class="modal-head-title">QR Code Kode Ini</div>
          <button class="modal-close-btn" onclick="closeModal()">${closeIconSvg()}</button>
        </div>
        <div class="modal-body">
          <div class="qr-modal-body">
            <img class="qr-modal-img" src="${qrImgUrl}" alt="QR Code" width="320" height="320">
            <div class="qr-modal-link">${escapeHtml(pageUrl)}</div>
          </div>
          <div class="modal-actions" style="justify-content:center">
            <a class="btn btn-primary" href="${qrImgUrl}" download="qr-${s.shortId}.png" target="_blank" rel="noopener">${downloadIconSvg()} Unduh</a>
          </div>
        </div>
      `)
    }

    const forkBtn = document.getElementById('forkBtn')
    if (forkBtn) forkBtn.onclick = async () => {
      if (!me) { window.location.href = '/auth'; return }
      if (forkBtn.dataset.busy) return
      forkBtn.dataset.busy = '1'
      try {
        const forked = await api(`/codes/${shortId}/fork`, { method: 'POST' })
        toast('Kode berhasil di-fork!')
        window.location.href = codeUrl(forked.shortId)
      } catch (e) { toast(e.message) }
      finally { delete forkBtn.dataset.busy }
    }

    const reportBtn = document.getElementById('reportBtn')
    const reportForm = document.getElementById('reportForm')
    if (reportBtn && !me) {
      // Belum login: tombol Laporkan tetap kelihatan, tapi diklik langsung
      // diarahkan ke /auth buat login dulu (gak ada form report yang di-render).
      reportBtn.onclick = () => { window.location.href = '/auth' }
    } else if (reportBtn && reportForm) {
      wireAutoGrowTextarea(document.getElementById('reportDetail'))
      const cancelReportBtn = document.getElementById('cancelReportBtn')
      const sendReportBtn = document.getElementById('sendReportBtn')
      const reportCodeWindowEl = document.getElementById('codeWindow')
      const reportCommentsSectionEl = document.getElementById('commentsSection')

      function enterReportMode() {
        reportForm.style.display = 'block'
        if (reportCodeWindowEl) reportCodeWindowEl.style.display = 'none'
        if (reportCommentsSectionEl) reportCommentsSectionEl.style.display = 'none'
        reportForm.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      function exitReportMode() {
        reportForm.style.display = 'none'
        if (reportCodeWindowEl) reportCodeWindowEl.style.display = ''
        if (reportCommentsSectionEl) reportCommentsSectionEl.style.display = ''
      }

      reportBtn.onclick = () => {
        if (reportForm.style.display === 'none') enterReportMode()
        else exitReportMode()
      }
      cancelReportBtn.onclick = exitReportMode
      sendReportBtn.onclick = async () => {
        if (sendReportBtn.dataset.busy) return
        sendReportBtn.dataset.busy = '1'
        try {
          const reason = document.getElementById('reportReason').value
          const detail = document.getElementById('reportDetail').value.trim()
          await api(`/codes/${shortId}/report`, { method: 'POST', body: JSON.stringify({ reason, detail }) })
          toast('Laporan terkirim, terima kasih telah membantu menjaga Codery.')
          document.getElementById('reportDetail').value = ''
          exitReportMode()
        } catch (e) { toast(e.message) }
        finally { delete sendReportBtn.dataset.busy }
      }
    }

    const codeWindow = document.getElementById('codeWindow')
    const fullscreenBtn = document.getElementById('codeFullscreenBtn')
    const codeBlock = document.getElementById('codeBlock')
    const codeViewPre = document.getElementById('codeViewPre')
    const zoomLevelEl = document.getElementById('zoomLevel')
    const BASE_FONT = 16
    const MIN_ZOOM = 60, MAX_ZOOM = 250, ZOOM_STEP = 10, DEFAULT_ZOOM = 60
    let zoom = DEFAULT_ZOOM

    function applyZoom() {
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
      codeBlock.style.fontSize = (BASE_FONT * zoom / 100) + 'px'
      zoomLevelEl.textContent = Math.round(zoom) + '%'
    }
    function resetZoom() {
      zoom = DEFAULT_ZOOM
      codeBlock.style.fontSize = ''
      zoomLevelEl.textContent = DEFAULT_ZOOM + '%'
    }

    document.getElementById('zoomInBtn').onclick = () => { zoom += ZOOM_STEP; applyZoom() }
    document.getElementById('zoomOutBtn').onclick = () => { zoom -= ZOOM_STEP; applyZoom() }

    let pinchStartDist = 0, pinchStartZoom = 100
    function touchDist(touches) {
      const [a, b] = touches
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
    codeViewPre.addEventListener('touchstart', e => {
      if (e.touches.length === 2 && codeWindow.classList.contains('fullscreen')) {
        pinchStartDist = touchDist(e.touches)
        pinchStartZoom = zoom
      }
    }, { passive: true })
    codeViewPre.addEventListener('touchmove', e => {
      // pinchStartDist > 5: hindari pembagian dengan angka mendekati nol
      // (dua jari nempel pas mulai pinch) yang bisa bikin scale melonjak.
      if (e.touches.length === 2 && pinchStartDist > 5 && codeWindow.classList.contains('fullscreen')) {
        e.preventDefault()
        const scale = touchDist(e.touches) / pinchStartDist
        zoom = pinchStartZoom * scale
        applyZoom()
      }
    }, { passive: false })
    codeViewPre.addEventListener('touchend', e => {
      if (e.touches.length < 2) pinchStartDist = 0
    })

    // Kalau browser sempat men-zoom halaman (misalnya dari gesture pinch
    // yang lolos sebelum touch-action diterapkan), ini memaksa browser
    // reset zoom halaman ke 1x dengan cara "menggoyang" meta viewport.
    function resetPageZoom() {
      const vp = document.querySelector('meta[name="viewport"]')
      if (!vp) return
      const original = vp.getAttribute('content')
      vp.setAttribute('content', original + ', maximum-scale=1.0')
      requestAnimationFrame(() => { vp.setAttribute('content', original) })
    }

    // --- Fullscreen: dipaksa total lewat JS, gak nyandar ke CSS eksternal sama sekali ---
    // Sebelumnya cuma toggle class ".fullscreen" dan andalin style.css buat
    // "position:fixed;inset:0". Itu rapuh: kalau ada elemen leluhur mana pun
    // (skrng atau nanti) yang punya transform/filter/contain/will-change,
    // position:fixed jadi nempel ke elemen itu, bukan ke seluruh layar --
    // persis gejala "gak full HP" yang kejadian. Fix totalnya: pas dibuka,
    // elemen kotak kode difisik-pindah jadi anak langsung dari <body>, terus
    // SEMUA style kritis dipasang lewat JS pakai setProperty(...,'important')
    // supaya menang mutlak dari CSS apa pun. Posisi asal disimpen di
    // placeholder buat dikembaliin persis pas ditutup.
    let fsPlaceholder = null
    function lockScroll(lock) {
      document.documentElement.style.overflow = lock ? 'hidden' : ''
      document.body.style.overflow = lock ? 'hidden' : ''
    }
    function forceFullscreenStyles() {
      const s = codeWindow.style
      s.setProperty('position', 'fixed', 'important')
      s.setProperty('top', '0', 'important')
      s.setProperty('left', '0', 'important')
      s.setProperty('right', '0', 'important')
      s.setProperty('bottom', '0', 'important')
      s.setProperty('width', '100vw', 'important')
      s.setProperty('height', '100dvh', 'important')
      s.setProperty('max-width', '100vw', 'important')
      s.setProperty('max-height', '100dvh', 'important')
      s.setProperty('margin', '0', 'important')
      s.setProperty('border-radius', '0', 'important')
      s.setProperty('border', 'none', 'important')
      s.setProperty('z-index', '2147483647', 'important')
      s.setProperty('display', 'flex', 'important')
      s.setProperty('flex-direction', 'column', 'important')
      s.setProperty('touch-action', 'pan-x pan-y', 'important')
      codeViewPre.style.setProperty('flex', '1', 'important')
      codeViewPre.style.setProperty('overflow', 'auto', 'important')
      codeViewPre.style.setProperty('touch-action', 'pan-x pan-y', 'important')
    }
    function clearFullscreenStyles() {
      const props = ['position', 'top', 'left', 'right', 'bottom', 'width', 'height',
        'max-width', 'max-height', 'margin', 'border-radius', 'border', 'z-index',
        'display', 'flex-direction', 'touch-action']
      props.forEach(p => codeWindow.style.removeProperty(p))
      codeViewPre.style.removeProperty('flex')
      codeViewPre.style.removeProperty('overflow')
      codeViewPre.style.removeProperty('touch-action')
    }
    function enterFullscreen() {
      fsPlaceholder = document.createComment('code-window-slot')
      codeWindow.parentNode.insertBefore(fsPlaceholder, codeWindow)
      document.body.appendChild(codeWindow)
      codeWindow.classList.add('fullscreen')
      forceFullscreenStyles()
      lockScroll(true)
      window.scrollTo(0, 0)
      resetPageZoom()
    }
    function exitFullscreen() {
      codeWindow.classList.remove('fullscreen')
      clearFullscreenStyles()
      lockScroll(false)
      if (fsPlaceholder && fsPlaceholder.parentNode) {
        fsPlaceholder.parentNode.replaceChild(codeWindow, fsPlaceholder)
      }
      fsPlaceholder = null
    }

    fullscreenBtn.onclick = () => {
      const isOpen = !codeWindow.classList.contains('fullscreen')
      if (isOpen) enterFullscreen(); else exitFullscreen()
      fullscreenBtn.innerHTML = isOpen ? collapseIconSvg() : expandIconSvg()
      fullscreenBtn.title = isOpen ? 'Kecilkan kode' : 'Perbesar kode'
      if (isOpen) { zoom = DEFAULT_ZOOM; applyZoom() } else resetZoom()
    }
    document.addEventListener('keydown', function escClose(e) {
      if (e.key === 'Escape' && codeWindow.classList.contains('fullscreen')) fullscreenBtn.click()
    })

    const delBtn = document.getElementById('delBtn')
    if (delBtn) delBtn.onclick = async () => {
      if (!confirm('Hapus kode ini?')) return
      try { await api(`/codes/${shortId}`, { method: 'DELETE' }); toast('Kode dihapus'); window.location.href = '/' }
      catch (e) { toast(e.message) }
    }

    const editBtn = document.getElementById('editBtn')
    const editForm = document.getElementById('editForm')
    const cancelEditBtn = document.getElementById('cancelEditBtn')
    const saveEditBtn = document.getElementById('saveEditBtn')
    const codeWindowEl = document.getElementById('codeWindow')
    const commentsSectionEl = document.getElementById('commentsSection')
    const detailInfoEl = document.getElementById('detailInfo')
    const editUsePin = document.getElementById('editUsePin')
    const editPinField = document.getElementById('editPinField')
    const editPinInput = document.getElementById('editPinInput')
    if (editUsePin) editUsePin.onchange = () => { editPinField.style.display = editUsePin.checked ? 'block' : 'none' }

    wireFilenameSpaces(document.getElementById('editFilename'))
    wireAutoGrowTextarea(document.getElementById('editDescription'))

    function enterEditMode() {
      editForm.style.display = 'block'
      if (detailInfoEl) detailInfoEl.style.display = 'none'
      if (codeWindowEl) codeWindowEl.style.display = 'none'
      if (commentsSectionEl) commentsSectionEl.style.display = 'none'
      autoGrowTextarea(document.getElementById('editDescription'))
      editForm.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    function exitEditMode() {
      editForm.style.display = 'none'
      if (detailInfoEl) detailInfoEl.style.display = ''
      if (codeWindowEl) codeWindowEl.style.display = ''
      if (commentsSectionEl) commentsSectionEl.style.display = ''
    }

    if (editBtn) editBtn.onclick = () => {
      if (editForm.style.display === 'none') enterEditMode()
      else exitEditMode()
    }
    if (cancelEditBtn) cancelEditBtn.onclick = exitEditMode
    if (saveEditBtn) saveEditBtn.onclick = async () => {
      const title = document.getElementById('editTitle').value.trim()
      const filename = document.getElementById('editFilename').value.trim()
      const content = document.getElementById('editContent').value
      if (!title || !filename || !content) { toast('Judul, nama file, dan kode wajib diisi'); return }

      const nowWantsPin = editUsePin.checked
      const pinVal = editPinInput.value.trim()
      if (nowWantsPin && pinVal && !/^\d{4,8}$/.test(pinVal)) { toast('PIN harus 4-8 digit angka'); return }
      if (nowWantsPin && !s.locked && !pinVal) { toast('Isi PIN terlebih dahulu untuk mengunci kode ini.'); return }

      const body = {
        title, filename, content,
        language: document.getElementById('editLanguage').value,
        description: document.getElementById('editDescription').value,
        tags: document.getElementById('editTags').value,
        isPublic: document.getElementById('editIsPublic').checked
      }
      if (nowWantsPin) { if (pinVal) body.pin = pinVal }
      else if (s.locked) { body.removePin = true }

      saveEditBtn.disabled = true
      try {
        await api(`/codes/${shortId}`, { method: 'PATCH', body: JSON.stringify(body) })
        toast('Kode diperbarui!')
        renderCodeDetail()
      } catch (e) { toast(e.message) }
      finally { saveEditBtn.disabled = false }
    }

    setupComments(shortId, s.ownerUsername)
}

// Isi komentar/balasan: teks (kalau ada) + stiker GIF dari Tenor (kalau ada).
// `mentionHtml` (opsional) nempel di depan teks -- dipakai buat balasan
// bersarang yang mention @username orang yang dibalas.
function commentBodyHtml(c, mentionHtml = '') {
  const hasText = !!(c.text || mentionHtml)
  const textHtml = hasText ? `<div class="comment-text">${mentionHtml}${escapeHtml(c.text || '')}</div>` : ''
  const stickerHtml = c.stickerUrl ? `<div class="comment-sticker-wrap"><img class="comment-sticker" src="${escapeHtml(c.stickerUrl)}" alt="stiker" loading="lazy" decoding="async"></div>` : ''
  return textHtml + stickerHtml
}

// Satu item balasan di dalam thread. Setiap balasan tampil dengan identitas
// penulisnya sendiri (avatar/nickname/badge dari backend, BUKAN selalu owner
// kode kayak dulu). Kalau dia membalas balasan ORANG LAIN (bukan penulis
// komentar utama), yang berubah BUKAN baris nickname -- baris nickname
// selalu cuma nama penulis balasan itu sendiri. Yang nempel adalah mention
// "@targetUsername" di AWAL teks balasannya, gaya WhatsApp/Twitter, biar
// jelas ini balasan buat siapa tanpa bikin baris nickname ramai.
function replyItemHtml(r, commentId, isOwner, rootUsername) {
  const canDeleteReply = !!(me && (me.username === r.username || isOwner))
  const replyNick = r.nickname || r.username || 'pengguna'
  const isNestedReply = !!(r.replyToUsername && r.replyToUsername !== rootUsername)
  const mentionHtml = isNestedReply
    ? `<a class="reply-mention" href="${profileUrl(r.replyToUsername)}">@${escapeHtml(r.replyToUsername)}</a> `
    : ''
  return `
  <div class="comment-item reply-item" data-reply-id="${r.id}">
    <a href="${profileUrl(r.username)}" aria-label="Lihat profil @${escapeHtml(r.username || '')}"><img class="avatar-circle avatar-circle-xs clickable" src="${r.avatar || ''}" onerror="this.style.visibility='hidden'" loading="lazy" decoding="async"></a>
    <div class="comment-body">
      <div class="comment-nickname">${escapeHtml(replyNick)}${roleBadgeHtml(r.role)}${devBadgeHtml(r.isDeveloper)}</div>
      <div class="comment-meta"><a class="user-link" href="${profileUrl(r.username || '')}">@${escapeHtml(r.username || '')}</a>${badgesHtml(r.badges)} · ${timeAgo(r.createdAt)}</div>
      ${commentBodyHtml(r, mentionHtml)}
      ${me ? `<button type="button" class="comment-action-btn reply-toggle-btn" data-id="${commentId}" data-target="${escapeHtml(r.username || '')}" data-target-nick="${escapeHtml(replyNick)}">${replyIconSvg()} Balas</button>` : ''}
    </div>
    ${canDeleteReply ? `<button class="comment-del" data-role="delete-reply" data-comment-id="${commentId}" data-reply-id="${r.id}" title="Hapus balasan">${trashIconSvg()}</button>` : ''}
  </div>`
}

// Satu komentar top-level. Semua balasannya disembunyikan dulu di balik
// tombol "Lihat N balasan" (kayak TikTok) biar daftar komentar gak
// langsung penuh sesak -- baru muncul kalau user tap. Tombol "Balas" di
// komentar utama MAUPUN di tiap balasan di dalamnya sama-sama mengarah ke
// SATU komposer di bagian bawah (bukan bikin form baru berserakan tiap
// thread), jadi semua user bisa saling balas terus-menerus di satu thread
// yang sama tanpa harus bikin komentar baru.
function commentCardHtml(c, canDelete, isOwner) {
  const replies = c.replies || []
  return `
  <div class="comment-item" data-id="${c.id}">
    <a href="${profileUrl(c.username)}" aria-label="Lihat profil @${escapeHtml(c.username || '')}"><img class="avatar-circle avatar-circle-sm clickable" src="${c.avatar || ''}" onerror="this.style.visibility='hidden'" loading="lazy" decoding="async"></a>
    <div class="comment-body">
      <div class="comment-nickname">${escapeHtml(c.nickname || c.username)}${roleBadgeHtml(c.role)}${devBadgeHtml(c.isDeveloper)}</div>
      <div class="comment-meta"><a class="user-link" href="${profileUrl(c.username)}">@${escapeHtml(c.username)}</a>${badgesHtml(c.badges)} · ${timeAgo(c.createdAt)}</div>
      ${commentBodyHtml(c)}

      ${me ? `<button type="button" class="comment-action-btn reply-toggle-btn" data-id="${c.id}" data-target="${escapeHtml(c.username || '')}" data-target-nick="${escapeHtml(c.nickname || c.username || '')}">${replyIconSvg()} Balas</button>` : ''}

      ${replies.length ? `
      <button type="button" class="view-replies-btn" data-id="${c.id}" aria-expanded="false">
        <span class="view-replies-line"></span>
        <span class="view-replies-label">Lihat ${replies.length} balasan</span>
        <svg class="view-replies-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="reply-thread" id="replies-${c.id}" style="display:none">
        ${replies.map(r => replyItemHtml(r, c.id, isOwner, c.username)).join('')}
      </div>` : ''}
    </div>
    ${canDelete ? `<button class="comment-del" data-role="delete-comment" title="Hapus komentar">${trashIconSvg()}</button>` : ''}
  </div>`
}

function copyIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M6 15.5H5.2A2.2 2.2 0 0 1 3 13.3V5.2A2.2 2.2 0 0 1 5.2 3h8.1A2.2 2.2 0 0 1 15.5 5.2V6"/></svg>`
}

function rawIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3.5H6.2A2.2 2.2 0 0 0 4 5.7v12.6A2.2 2.2 0 0 0 6.2 20.5h11.6a2.2 2.2 0 0 0 2.2-2.2V9z"/><path d="M13.5 3.5V8a1.5 1.5 0 0 0 1.5 1.5h4.5"/><path d="M9 13.5 7.2 15.5 9 17.5"/><path d="M15 13.5l1.8 2L15 17.5"/></svg>`
}

function shareIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5.5" r="2.8"/><circle cx="5.5" cy="12" r="2.8"/><circle cx="18" cy="18.5" r="2.8"/><path d="M8 10.8 15.2 6.8"/><path d="M8 13.2l7.2 4"/></svg>`
}

function downloadIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 18.5h15" stroke-width="2.4"/></svg>`
}

function qrIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M13.5 13.5h3.2v3.2h-3.2z"/><path d="M18.5 13.5h2v2h-2z"/><path d="M13.5 18.5h2v2h-2z"/><path d="M18.5 18.5h2v2h-2z"/></svg>`
}

function forkIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.6" fill="currentColor" fill-opacity=".12"/><circle cx="18" cy="6" r="2.6" fill="currentColor" fill-opacity=".12"/><circle cx="12" cy="18" r="2.6" fill="currentColor" fill-opacity=".12"/><path d="M6 8.6V12a4 4 0 0 0 4 4"/><path d="M18 8.6V12a4 4 0 0 1-4 4"/></svg>`
}

function trashIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6.5 7l.8 12.2A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/><path d="M10 11v6M14 11v6"/></svg>`
}

function replyIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 16.5 4 11.5 9 6.5"/><path d="M20 18v-3.5A4.5 4.5 0 0 0 15.5 10H4"/></svg>`
}

function sendIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4.2 6.1 19.5 11.3c1.1.4 1.1 1.9 0 2.3L4.2 17.9c-.9.3-1.7-.6-1.4-1.5l1.2-3.8 8.2-.6-8.2-.6-1.2-3.8c-.3-.9.5-1.8 1.4-1.5z"/></svg>`
}

async function setupComments(shortId, ownerUsername) {
  const formEl = document.getElementById('commentForm')
  const listEl = document.getElementById('commentList')
  const countEl = document.getElementById('commentCount')
  const isOwner = !!(me && me.username === ownerUsername)

  // `replyTarget` nyimpen thread & orang yang lagi dibalas. Kalau `null`
  // berarti komposer lagi mode "komentar baru" biasa. Cuma ADA SATU
  // komposer di seluruh halaman (bukan satu form per-thread) supaya rapi
  // dan gak berantakan -- mirip TikTok: tombol "Balas" di komentar mana
  // pun cuma mindahin komposer ini ke "mode balas", bukan bikin kotak
  // input baru di tengah-tengah list.
  let replyTarget = null

  formEl.innerHTML = me
    ? `<div class="comment-form-wrap" id="commentFormWrap">
         <div class="reply-context-chip" id="replyContextChip" style="display:none">
           <span>Membalas <b id="replyContextName"></b></span>
           <button type="button" id="replyContextCancel" aria-label="Batal membalas">${closeIconSvg()}</button>
         </div>
         <div class="sticker-preview-chip" id="stickerPreviewChip" style="display:none">
           <img id="stickerPreviewImg" alt="stiker terpilih">
           <button type="button" id="stickerPreviewRemove" aria-label="Batal pakai stiker">${closeIconSvg()}</button>
         </div>
         <div class="comment-form">
           <img class="avatar-circle avatar-circle-sm" src="${me.avatar}">
           <div class="comment-input-box">
             <button type="button" class="sticker-pick-btn" id="stickerPickBtn" title="Kirim stiker">${stickerIconSvg()}</button>
             <textarea id="commentInput" class="comment-input" placeholder="Tuliskan komentar..." maxlength="500" rows="1"></textarea>
           </div>
           <button class="send-icon-btn" id="commentSendBtn" title="Kirim">${sendIconSvg()}</button>
         </div>
       </div>`
    : `<div class="comment-form-locked">Masuk terlebih dahulu untuk berkomentar. <a href="/auth">Masuk</a></div>`

  function autoGrow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }

  const input = document.getElementById('commentInput')
  const sendBtn = document.getElementById('commentSendBtn')
  const chip = document.getElementById('replyContextChip')
  const chipName = document.getElementById('replyContextName')
  const chipCancel = document.getElementById('replyContextCancel')
  const stickerPickBtn = document.getElementById('stickerPickBtn')
  const stickerChip = document.getElementById('stickerPreviewChip')
  const stickerImg = document.getElementById('stickerPreviewImg')
  const stickerRemoveBtn = document.getElementById('stickerPreviewRemove')
  let selectedStickerUrl = ''

  function setSticker(url) {
    selectedStickerUrl = url || ''
    if (!stickerChip) return
    if (selectedStickerUrl) {
      stickerImg.src = selectedStickerUrl
      stickerChip.style.display = 'flex'
    } else {
      stickerChip.style.display = 'none'
    }
  }

  stickerPickBtn?.addEventListener('click', async () => {
    const url = await openStickerPicker()
    if (url) setSticker(url)
  })
  stickerRemoveBtn?.addEventListener('click', () => setSticker(''))

  function enterReplyMode(commentId, username, nickname) {
    replyTarget = { commentId, username, nickname }
    if (chip) chip.style.display = 'flex'
    if (chipName) chipName.textContent = '@' + (username || nickname || '')
    if (input) {
      input.placeholder = `Balas ${nickname || username}...`
      input.focus()
    }
    document.getElementById('commentFormWrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function exitReplyMode() {
    replyTarget = null
    if (chip) chip.style.display = 'none'
    if (input) input.placeholder = 'Tulis komentar tentang kode ini...'
  }

  chipCancel?.addEventListener('click', exitReplyMode)

  async function loadComments() {
    try {
      const comments = await api(`/codes/${shortId}/comments`)
      countEl.textContent = comments.length ? `(${comments.length})` : ''
      listEl.innerHTML = comments.length
        ? comments.slice().reverse().map(c => commentCardHtml(c, me && (me.username === c.username || isOwner), isOwner)).join('')
        : `<div class="empty-state-sm">Belum ada komentar. Jadilah yang pertama!</div>`

      listEl.querySelectorAll('[data-role="delete-comment"]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.closest('.comment-item').dataset.id
          if (!confirm('Hapus komentar ini?')) return
          try { await api(`/codes/${shortId}/comments/${id}`, { method: 'DELETE' }); loadComments() }
          catch (e) { toast(e.message) }
        }
      })

      // Balasan disembunyikan dulu di balik "Lihat N balasan" (kayak TikTok)
      // biar daftar komentar tetap rapi, baru muncul kalau di-tap.
      listEl.querySelectorAll('.view-replies-btn').forEach(btn => {
        btn.onclick = () => {
          const thread = document.getElementById(`replies-${btn.dataset.id}`)
          if (!thread) return
          const willExpand = thread.style.display === 'none'
          thread.style.display = willExpand ? 'block' : 'none'
          btn.setAttribute('aria-expanded', String(willExpand))
          const label = btn.querySelector('.view-replies-label')
          const count = thread.children.length
          if (label) label.textContent = willExpand ? 'Sembunyikan balasan' : `Lihat ${count} balasan`
        }
      })

      // Tombol "Balas" muncul di komentar utama MAUPUN di tiap balasan di
      // dalamnya. Ke mana pun diklik, semuanya cuma mengaktifkan mode balas
      // pada SATU komposer yang sama di bawah -- jadi User bisa membalas
      // Owner, lalu Owner (atau User lain) bisa membalas lagi, terus-menerus
      // di thread yang sama, tanpa bikin komentar baru.
      listEl.querySelectorAll('.reply-toggle-btn').forEach(btn => {
        btn.onclick = () => {
          const commentId = btn.dataset.id
          const target = btn.dataset.target || ''
          const targetNick = btn.dataset.targetNick || target
          enterReplyMode(commentId, target, targetNick)

          // Buka juga thread balasannya biar user lihat konteks sambil balas.
          const thread = document.getElementById(`replies-${commentId}`)
          const viewBtn = listEl.querySelector(`.view-replies-btn[data-id="${commentId}"]`)
          if (thread && thread.style.display === 'none' && viewBtn) viewBtn.click()
        }
      })

      listEl.querySelectorAll('[data-role="delete-reply"]').forEach(btn => {
        btn.onclick = async () => {
          const commentId = btn.dataset.commentId
          const replyId = btn.dataset.replyId
          if (!confirm('Hapus balasan ini?')) return
          try { await api(`/codes/${shortId}/comments/${commentId}/reply/${replyId}`, { method: 'DELETE' }); loadComments() }
          catch (e) { toast(e.message) }
        }
      })
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state-sm">${escapeHtml(e.message)}</div>`
    }
  }

  if (input && sendBtn) {
    input.addEventListener('input', () => autoGrow(input))
    sendBtn.onclick = async () => {
      const text = input.value.trim()
      if (!text && !selectedStickerUrl) return
      sendBtn.disabled = true
      try {
        if (replyTarget) {
          await api(`/codes/${shortId}/comments/${replyTarget.commentId}/reply`, {
            method: 'POST',
            body: JSON.stringify({ text, stickerUrl: selectedStickerUrl, replyToUsername: replyTarget.username })
          })
        } else {
          await api(`/codes/${shortId}/comments`, { method: 'POST', body: JSON.stringify({ text, stickerUrl: selectedStickerUrl }) })
        }
        input.value = ''
        autoGrow(input)
        setSticker('')
        exitReplyMode()
        loadComments()
      } catch (e) { toast(e.message) }
      finally { sendBtn.disabled = false }
    }
  }

  loadComments()
}

renderCodeDetail(refreshAuth())

