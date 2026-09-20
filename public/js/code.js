
async function renderCodeDetail(authReady) {
  const app = document.getElementById('app')
  const shortId = qs('id')
  if (!shortId) { app.innerHTML = `<div class="card"><div class="empty-state">Code not found.</div></div>`; return }
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
        <div class="lock-title">This code is locked</div>
        <div class="lock-sub">Uploaded by ${escapeHtml(s.ownerNickname || s.ownerUsername)}. Enter the password to view the code.</div>
        <div class="field"><input type="password" id="unlockPin" maxlength="8" placeholder="Password" autocomplete="off"></div>
        <button class="btn btn-primary btn-block" id="unlockBtn">Unlock</button>
      </div>
    </div>`
  const pinInput = document.getElementById('unlockPin')
  const unlockBtn = document.getElementById('unlockBtn')
  pinInput.focus()
  pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlockBtn.click() })
  unlockBtn.onclick = async () => {
    const pin = pinInput.value.trim()
    if (!pin) { toast('Enter the password'); return }
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
        <header class="cd-head">
          <a class="cd-avatar" href="${profileUrl(s.ownerUsername)}" aria-label="@${escapeHtml(s.ownerUsername)}">
            ${avatarHtml(s.ownerAvatar, s.ownerNickname || s.ownerUsername, 'avatar-circle-md', 'clickable')}
          </a>
          <div class="cd-who">
            <div class="cd-name">${escapeHtml(s.ownerNickname || s.ownerUsername)}${badgesHtml(s.ownerBadges)}${devBadgeHtml(s.ownerIsDeveloper)}${roleBadgeHtml(s.ownerRole)}</div>
            <div class="cd-handle">@${escapeHtml(s.ownerUsername)}</div>
          </div>
          <div class="cd-lang">${langIconHtml(s.language)}${s.locked ? `<span class="lock-badge" title="Password locked">${lockIconSvg()}</span>` : ''}</div>
        </header>

        <h1 class="cd-title">${escapeHtml(s.title)}</h1>
        <div class="cd-meta">
          <span>${escapeHtml(s.filename)}</span>
          <span class="cd-dot">·</span>
          <span>${timeAgo(s.createdAt)}</span>
          <span class="cd-dot">·</span>
          <span class="sc-views-inline" title="${s.views || 0} ${t('viewsTitle')}">${eyeIconSvg()}<span>${formatViews(s.views)}</span></span>
        </div>
        ${s.forkedFrom ? `<a class="forked-from-badge" href="${codeUrl(s.forkedFrom.shortId)}">${forkIconSvg()} Forked from <b>${escapeHtml(s.forkedFrom.ownerNickname)}</b></a>` : ''}
        ${s.description ? `<p class="cd-desc">${formatWaText(s.description)}</p>` : ''}
        ${s.tags && s.tags.length ? `<div class="cd-tags">${s.tags.map(tag => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}

        <div class="cd-toolbar">
          <button class="cd-btn cd-btn-primary" id="copyBtn" type="button">${copyIconSvg()}<span>Copy</span></button>
          <button class="cd-btn" type="button" onclick="window.open('/raw/${s.shortId}','_blank')">${rawIconSvg()}<span>Raw</span></button>
          <button class="cd-btn" id="downloadBtn" type="button">${downloadIconSvg()}<span>Download</span></button>
          <div class="cd-more-wrap">
            <button type="button" class="cd-btn cd-more-btn" id="cdMoreBtn" aria-label="More" aria-expanded="false">${moreDotsSvg()}</button>
            <div class="cd-more-menu" id="cdMoreMenu" hidden>
              <button type="button" class="cd-more-item" id="shareBtn">${shareIconSvg()}<span>Share link</span></button>
              <button type="button" class="cd-more-item" id="copyMdBtn">${markdownIconSvg()}<span>Copy as Markdown</span></button>
              <button type="button" class="cd-more-item" id="embedBtn">${embedIconSvg()}<span>Embed</span></button>
              <button type="button" class="cd-more-item" id="qrBtn">${qrIconSvg()}<span>QR code</span></button>
              ${!me || me.username !== s.ownerUsername ? `<button type="button" class="cd-more-item" id="forkBtn">${forkIconSvg()}<span>Fork</span></button>` : ''}
              ${me && me.username === s.ownerUsername ? `<button type="button" class="cd-more-item" id="duplicateBtn">${copyIconSvg()}<span>Duplicate</span></button>` : ''}
              <a class="cd-more-item" href="${profileUrl(s.ownerUsername)}">${userIconSvg()}<span>Profile</span></a>
              ${!me || me.username !== s.ownerUsername ? `<button type="button" class="cd-more-item cd-more-danger" id="reportBtn">${flagIconSvg()}<span>Report</span></button>` : ''}
              ${me && me.username === s.ownerUsername ? `<button type="button" class="cd-more-item" id="editBtn">${editIconSvg()}<span>Edit</span></button>` : ''}
              ${me && me.username === s.ownerUsername ? `<button type="button" class="cd-more-item cd-more-danger" id="delBtn">${trashIconSvg()}<span>Delete</span></button>` : ''}
            </div>
          </div>
        </div>

        <div class="code-window" id="codeWindow">
          <div class="code-window-bar">
            <span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span>
            <span class="code-window-filename">${escapeHtml(s.filename)}</span>
            <div class="zoom-controls" id="zoomControls">
              <button type="button" class="zoom-btn" id="zoomOutBtn" title="Zoom out">−</button>
              <span class="zoom-level" id="zoomLevel">100%</span>
              <button type="button" class="zoom-btn" id="zoomInBtn" title="Zoom in">+</button>
            </div>
            <button type="button" class="code-expand-btn" id="codeGrepBtn" title="Find in code">${searchIconSvg()}</button>
            <button type="button" class="code-expand-btn" id="codeWrapBtn" title="Wrap lines">${wrapIconSvg()}</button>
            <button type="button" class="code-expand-btn" id="codeFullscreenBtn" title="Fullscreen">${expandIconSvg()}</button>
          </div>
          <div class="code-grep-bar" id="codeGrepBar" hidden>
            <input type="text" class="code-grep-input" id="codeGrepInput" placeholder="Find in code..." autocomplete="off" spellcheck="false">
            <span class="code-grep-count" id="codeGrepCount"></span>
            <button type="button" class="code-grep-nav" id="codeGrepPrev" title="Previous">↑</button>
            <button type="button" class="code-grep-nav" id="codeGrepNext" title="Next">↓</button>
            <button type="button" class="code-grep-close" id="codeGrepClose" title="Close">${closeIconSvg()}</button>
          </div>
          <pre class="code-view" id="codeViewPre"><code id="codeBlock" class="language-${hljsLang(s.language)}">${escapeHtml(s.content)}</code></pre>
        </div>

        <div class="cd-engage">
          <button type="button" class="like-btn like-btn-detail t-like ${s.likedByMe ? 'liked' : ''}" data-role="like" data-short="${s.shortId}" data-liked="${s.likedByMe ? 'true' : 'false'}">
            <span class="t-like-icon">${heartIconSvg()}</span>
            <span class="t-like-particles">${likeParticlesHtml()}</span>
            <span id="likeLabel">${s.likedByMe ? 'Liked' : 'Like'}</span>
            <span class="like-sep">·</span>
            <span class="like-count">${s.likes || 0}</span>
          </button>
          <button type="button" class="bookmark-btn bookmark-btn-detail ${s.savedByMe ? 'saved' : ''}" data-role="bookmark" data-short="${s.shortId}" data-saved="${s.savedByMe ? 'true' : 'false'}" title="Save">
            ${bookmarkIconSvg()}
          </button>
        </div>
        </div>
        ${me && me.username !== s.ownerUsername ? `
        <div id="reportForm" style="display:none;margin-top:14px">
          <div class="field"><label>Report reason</label>
            <select id="reportReason">
              <option value="vulgar">Inappropriate content</option>
              <option value="spam">Spam / promo</option>
              <option value="plagiarism">Plagiarism / stolen code</option>
              <option value="malware">Malware / harmful code</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="field"><label>Detail (optional)</label><textarea id="reportDetail" class="textarea-autogrow" style="min-height:60px" maxlength="300" placeholder="Add more details if needed..."></textarea></div>
          <div class="snippet-meta" style="margin-bottom:12px">This report is sent to Codery moderators for review, not to the code owner.</div>
          <div class="btn-row">
            <button class="btn btn-white" id="cancelReportBtn">Cancel</button>
            <button class="btn btn-danger" id="sendReportBtn">Submit Report</button>
          </div>
        </div>` : ''}
        ${me && me.username === s.ownerUsername ? `
        <div id="editForm" style="display:none;margin-top:14px">
          <div class="field"><label>Title</label><input id="editTitle" value="${escapeHtml(s.title)}" maxlength="120"></div>
          <div class="field"><label>Description (optional)</label><textarea id="editDescription" class="textarea-autogrow" style="min-height:70px">${escapeHtml(s.description || '')}</textarea></div>
          <div class="field"><label>Tags (comma separated, max 5)</label><input id="editTags" value="${escapeHtml((s.tags || []).join(', '))}" placeholder="algorithm, tutorial, bug-fix"></div>
          <div class="field"><label>Filename</label><input id="editFilename" value="${escapeHtml(s.filename)}" maxlength="80"></div>
          <div class="field"><label>Language</label>
            <select id="editLanguage">
              ${['javascript', 'typescript', 'python', 'html', 'css', 'json', 'java', 'php', 'bash', 'markdown', 'text']
                .map(l => `<option value="${l}" ${s.language === l ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Code</label><textarea id="editContent" style="min-height:160px;font-family:'JetBrains Mono',monospace;font-size:13px">${escapeHtml(s.content)}</textarea></div>
          <div class="checkbox-row"><input type="checkbox" id="editIsPublic" ${s.isPublic ? 'checked' : ''}><label for="editIsPublic">Public (show on feed)</label></div>
          <div class="checkbox-row"><input type="checkbox" id="editUsePin" ${s.locked ? 'checked' : ''}><label for="editUsePin">Lock with Password</label></div>
          <div class="field" id="editPinField" style="display:${s.locked ? 'block' : 'none'}">
            <label>Password ${s.locked ? 'new (optional)' : ''} (4-8 characters, letters/numbers)</label>
            <input type="password" id="editPinInput" maxlength="8" placeholder="${s.locked ? 'Leave empty to keep current password' : 'e.g. mypass1'}">
          </div>
          <div class="btn-row">
            <button class="btn btn-white" id="cancelEditBtn">Cancel</button>
            <button class="btn btn-primary" id="saveEditBtn">Save</button>
          </div>
        </div>` : ''}
        </div>

        <div class="comments-section" id="commentsSection">
          <div class="comments-title">${t('comments')} <span id="commentCount"></span></div>
          <div id="commentForm"></div>
          <div id="commentList">${skelCommentList(2)}</div>
        </div>

        <div id="relatedCodes" class="related-codes" style="display:none"></div>
      </div>
    `
    if (window.hljs) hljs.highlightElement(document.getElementById('codeBlock'))
    try { trackRecentView(s) } catch {}
    highlightLinesFromHash()
    wireCodeKeyboard(s)
    loadRelatedCodes(s)
    wireLikeButtons(app)
    wireBookmarkButtons(app)
    document.getElementById('copyBtn').onclick = () => { navigator.clipboard.writeText(s.content); toast('Copied!') }

    const moreBtn = document.getElementById('cdMoreBtn')
    const moreMenu = document.getElementById('cdMoreMenu')
    if (moreBtn && moreMenu) {
      moreBtn.onclick = (e) => {
        e.stopPropagation()
        const open = moreMenu.hasAttribute('hidden')
        if (open) moreMenu.removeAttribute('hidden')
        else moreMenu.setAttribute('hidden', '')
        moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
      }
      document.addEventListener('click', (e) => {
        if (!moreMenu.hasAttribute('hidden') && !moreMenu.contains(e.target) && e.target !== moreBtn) {
          moreMenu.setAttribute('hidden', '')
          moreBtn.setAttribute('aria-expanded', 'false')
        }
      })
    }

    document.getElementById('shareBtn').onclick = () => { navigator.clipboard.writeText(location.href); toast('Link copied!') }
    document.getElementById('copyMdBtn').onclick = () => {
      const lang = (s.language || 'text').toLowerCase()
      const title = s.title || s.filename || 'Code'
      const body = s.content || ''
      const md = `# ${title}\n\n\`\`\`${lang}\n${body}\n\`\`\`\n`
      navigator.clipboard.writeText(md).then(() => toast('Markdown copied!')).catch(() => toast('Could not copy'))
    }

    document.getElementById('embedBtn')?.addEventListener('click', () => {
      const url = location.origin + '/code?id=' + encodeURIComponent(s.shortId)
      const embed = `<iframe src="${url}" width="100%" height="400" style="border:1px solid #e5e5e5;border-radius:12px" loading="lazy" title="${escapeHtml(s.title || 'Code')}"></iframe>`
      openModal(`
        <div class="modal-head">
          <div class="modal-head-title">Embed</div>
          <button class="modal-close-btn" onclick="closeModal()">${closeIconSvg()}</button>
        </div>
        <div class="modal-body">
          <p class="field-hint" style="margin-bottom:10px">Paste this HTML on your site:</p>
          <textarea id="embedCode" readonly rows="4" style="width:100%;font-family:monospace;font-size:12px">${escapeHtml(embed)}</textarea>
          <div class="modal-actions" style="margin-top:12px">
            <button class="btn btn-primary" type="button" id="copyEmbedBtn">Copy embed</button>
          </div>
        </div>
      `)
      document.getElementById('copyEmbedBtn').onclick = () => {
        navigator.clipboard.writeText(embed)
        toast('Embed copied!')
        closeModal()
      }
    })

    document.getElementById('duplicateBtn')?.addEventListener('click', async () => {
      if (!me) { toast('Login required'); return }
      const btn = document.getElementById('duplicateBtn')
      setBtnLoading(btn, true)
      try {
        const created = await api('/codes', {
          method: 'POST',
          body: JSON.stringify({
            title: (s.title || 'Untitled') + ' (copy)',
            filename: s.filename,
            content: s.content,
            language: s.language,
            description: s.description || '',
            tags: (s.tags || []).join(' '),
            isPublic: false
          })
        })
        toast('Duplicated')
        window.location.href = codeUrl(created.shortId)
      } catch (e) {
        toast(e.message)
        setBtnLoading(btn, false)
      }
    })

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
          <div class="modal-head-title">QR Code</div>
          <button class="modal-close-btn" onclick="closeModal()">${closeIconSvg()}</button>
        </div>
        <div class="modal-body">
          <div class="qr-modal-body">
            <img class="qr-modal-img" src="${qrImgUrl}" alt="QR Code" width="320" height="320">
            <div class="qr-modal-link">${escapeHtml(pageUrl)}</div>
          </div>
          <div class="modal-actions" style="justify-content:center">
            <a class="btn btn-primary" href="${qrImgUrl}" download="qr-${s.shortId}.png" target="_blank" rel="noopener">${downloadIconSvg()} Download</a>
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
        toast('Code forked!')
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
          toast('Report sent. Thanks for helping keep Codery safe.')
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
    const MIN_ZOOM = 50, MAX_ZOOM = 300, ZOOM_STEP = 10, DEFAULT_ZOOM = 100, FULLSCREEN_ZOOM = 70
    let zoom = DEFAULT_ZOOM

    function applyZoom() {
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
      // WAJIB pakai !important: stylesheet punya
      // `.code-view code { font-size: 13.5px !important }` yang mengalahkan
      // inline style biasa — ini penyebab pinch/tombol zoom "tidak kerja".
      const px = (BASE_FONT * zoom / 100) + 'px'
      codeBlock.style.setProperty('font-size', px, 'important')
      if (codeViewPre) codeViewPre.style.setProperty('font-size', px, 'important')
      if (zoomLevelEl) zoomLevelEl.textContent = Math.round(zoom) + '%'
    }
    function resetZoom() {
      zoom = DEFAULT_ZOOM
      codeBlock.style.removeProperty('font-size')
      if (codeViewPre) codeViewPre.style.removeProperty('font-size')
      if (zoomLevelEl) zoomLevelEl.textContent = DEFAULT_ZOOM + '%'
    }

    document.getElementById('zoomInBtn').onclick = () => { zoom += ZOOM_STEP; applyZoom() }
    document.getElementById('zoomOutBtn').onclick = () => { zoom -= ZOOM_STEP; applyZoom() }

    // --- Word wrap toggle ---
    const wrapBtn = document.getElementById('codeWrapBtn')
    let wrapOn = false
    function setWrap(on) {
      wrapOn = !!on
      if (codeViewPre) codeViewPre.classList.toggle('code-wrap', wrapOn)
      if (codeBlock) codeBlock.classList.toggle('code-wrap', wrapOn)
      if (wrapBtn) {
        wrapBtn.classList.toggle('active', wrapOn)
        wrapBtn.title = wrapOn ? 'Unwrap lines' : 'Wrap lines'
      }
    }
    if (wrapBtn) wrapBtn.onclick = () => setWrap(!wrapOn)

    // --- Find in code (grep) ---
    const grepBtn = document.getElementById('codeGrepBtn')
    const grepBar = document.getElementById('codeGrepBar')
    const grepInput = document.getElementById('codeGrepInput')
    const grepCount = document.getElementById('codeGrepCount')
    const grepPrev = document.getElementById('codeGrepPrev')
    const grepNext = document.getElementById('codeGrepNext')
    const grepClose = document.getElementById('codeGrepClose')
    const originalCodeHtml = codeBlock.innerHTML
    let grepMatches = []
    let grepIndex = -1

    function clearGrepHighlights() {
      codeBlock.innerHTML = originalCodeHtml
      grepMatches = []
      grepIndex = -1
      if (grepCount) grepCount.textContent = ''
    }

    function runGrep(query) {
      clearGrepHighlights()
      if (!query) return
      const text = codeBlock.textContent || ''
      const lowerText = text.toLowerCase()
      const lowerQ = query.toLowerCase()
      const ranges = []
      let pos = 0
      while (true) {
        const i = lowerText.indexOf(lowerQ, pos)
        if (i < 0) break
        ranges.push([i, i + query.length])
        pos = i + Math.max(1, query.length)
      }
      if (!ranges.length) {
        if (grepCount) grepCount.textContent = '0'
        return
      }
      let out = ''
      let last = 0
      ranges.forEach(([start, end], idx) => {
        out += escapeHtml(text.slice(last, start))
        out += `<mark class="code-grep-hit" data-grep-i="${idx}">${escapeHtml(text.slice(start, end))}</mark>`
        last = end
      })
      out += escapeHtml(text.slice(last))
      codeBlock.innerHTML = out
      grepMatches = Array.from(codeBlock.querySelectorAll('mark.code-grep-hit'))
      grepIndex = 0
      updateGrepNav()
      scrollToGrepMatch(0)
    }

    function updateGrepNav() {
      if (!grepCount) return
      if (!grepMatches.length) {
        grepCount.textContent = '0'
        return
      }
      grepCount.textContent = `${grepIndex + 1}/${grepMatches.length}`
      grepMatches.forEach((m, i) => m.classList.toggle('code-grep-current', i === grepIndex))
    }

    function scrollToGrepMatch(i) {
      if (!grepMatches[i]) return
      grepMatches[i].scrollIntoView({ block: 'center', behavior: 'smooth' })
    }

    function gotoGrep(delta) {
      if (!grepMatches.length) return
      grepIndex = (grepIndex + delta + grepMatches.length) % grepMatches.length
      updateGrepNav()
      scrollToGrepMatch(grepIndex)
    }

    function openGrep() {
      if (!grepBar) return
      grepBar.hidden = false
      if (grepInput) {
        grepInput.value = ''
        grepInput.focus()
      }
      clearGrepHighlights()
    }

    function closeGrep() {
      if (!grepBar) return
      grepBar.hidden = true
      clearGrepHighlights()
    }

    if (grepBtn) grepBtn.onclick = () => {
      if (grepBar && !grepBar.hidden) closeGrep()
      else openGrep()
    }
    if (grepClose) grepClose.onclick = closeGrep
    if (grepPrev) grepPrev.onclick = () => gotoGrep(-1)
    if (grepNext) grepNext.onclick = () => gotoGrep(1)
    if (grepInput) {
      let grepTimer = null
      grepInput.addEventListener('input', () => {
        clearTimeout(grepTimer)
        grepTimer = setTimeout(() => runGrep(grepInput.value.trim()), 120)
      })
      grepInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          if (e.shiftKey) gotoGrep(-1)
          else gotoGrep(1)
        } else if (e.key === 'Escape') {
          e.preventDefault()
          closeGrep()
        }
      })
    }

    let pinchStartDist = 0, pinchStartZoom = 100
    function touchDist(touches) {
      const [a, b] = touches
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    }
    // Pinch-to-zoom HANYA di mode fullscreen: ubah ukuran font kode,
    // BUKAN zoom halaman web.
    function isCodeFullscreen() {
      return codeWindow.classList.contains('fullscreen')
    }
    function onPinchStart(e) {
      if (e.touches.length === 2 && isCodeFullscreen()) {
        pinchStartDist = touchDist(e.touches)
        pinchStartZoom = zoom
      }
    }
    function onPinchMove(e) {
      if (!isCodeFullscreen()) return
      if (e.touches.length === 2 && pinchStartDist > 5) {
        e.preventDefault()
        e.stopPropagation()
        const scale = touchDist(e.touches) / pinchStartDist
        zoom = pinchStartZoom * scale
        applyZoom()
      }
    }
    function onPinchEnd(e) {
      if (e.touches.length < 2) pinchStartDist = 0
    }
    ;[codeViewPre, codeWindow, codeBlock].forEach(el => {
      if (!el) return
      el.addEventListener('touchstart', onPinchStart, { passive: true })
      el.addEventListener('touchmove', onPinchMove, { passive: false })
      el.addEventListener('touchend', onPinchEnd, { passive: true })
      el.addEventListener('touchcancel', onPinchEnd, { passive: true })
    })

    // Viewport sudah di-set maximum-scale=1 / user-scalable=no di HTML.
    // Fungsi ini cuma memastikan meta tetap terkunci kalau ada yang
    // mengubahnya saat masuk/keluar fullscreen.
    function resetPageZoom() {
      const vp = document.querySelector('meta[name="viewport"]')
      if (!vp) return
      vp.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      )
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
      fullscreenBtn.title = isOpen ? 'Exit fullscreen' : 'Fullscreen'
      if (isOpen) { zoom = FULLSCREEN_ZOOM; applyZoom() } else resetZoom()
    }
    document.addEventListener('keydown', function escClose(e) {
      if (e.key === 'Escape' && codeWindow.classList.contains('fullscreen')) fullscreenBtn.click()
    })

    // Keyboard shortcuts (ignore when typing in inputs)
    document.addEventListener('keydown', function codeShortcuts(e) {
      const tag = (e.target && e.target.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable
      if (typing && e.key !== 'Escape') return
      if (e.ctrlKey || e.metaKey || e.altKey) {
        if ((e.key === 'f' || e.key === 'F') && !typing) {
          e.preventDefault()
          document.getElementById('codeGrepBtn')?.click()
        }
        return
      }
      if (e.key === '/' && !typing) {
        e.preventDefault()
        document.getElementById('codeGrepBtn')?.click()
        return
      }
      if (typing) return
      const k = e.key.toLowerCase()
      if (k === 'w') {
        e.preventDefault()
        document.getElementById('codeWrapBtn')?.click()
      } else if (k === 'f') {
        e.preventDefault()
        document.getElementById('codeFullscreenBtn')?.click()
      } else if (k === 'c' && !e.shiftKey) {
        // don't steal browser copy when selection exists
        const sel = window.getSelection && String(window.getSelection())
        if (sel && sel.length) return
        e.preventDefault()
        document.getElementById('copyBtn')?.click()
      }
    })

    const delBtn = document.getElementById('delBtn')
    if (delBtn) delBtn.onclick = async () => {
      if (!confirm('Delete this code?')) return
      try { await api(`/codes/${shortId}`, { method: 'DELETE' }); toast('Code deleted'); window.location.href = '/' }
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
      if (!title || !filename || !content) { toast('Title, filename, and code are required'); return }

      const nowWantsPin = editUsePin.checked
      const pinVal = editPinInput.value.trim()
      if (nowWantsPin && pinVal && !/^[a-zA-Z0-9]{4,8}$/.test(pinVal)) { toast('Password must be 4-8 letters or numbers'); return }
      if (nowWantsPin && !s.locked && !pinVal) { toast('Enter a password to lock this code.'); return }

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
        toast('Code updated!')
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
    <a href="${profileUrl(r.username)}" aria-label="View profile @${escapeHtml(r.username || '')}"><img class="avatar-circle avatar-circle-xs clickable" src="${r.avatar || ''}" onerror="this.style.visibility='hidden'" loading="lazy" decoding="async"></a>
    <div class="comment-body">
      <div class="comment-nickname">${escapeHtml(replyNick)}${roleBadgeHtml(r.role)}${devBadgeHtml(r.isDeveloper)}</div>
      <div class="comment-meta"><a class="user-link" href="${profileUrl(r.username || '')}">@${escapeHtml(r.username || '')}</a>${badgesHtml(r.badges)} · ${timeAgo(r.createdAt)}</div>
      ${commentBodyHtml(r, mentionHtml)}
      ${me ? `<button type="button" class="comment-action-btn reply-toggle-btn" data-id="${commentId}" data-target="${escapeHtml(r.username || '')}" data-target-nick="${escapeHtml(replyNick)}">${replyIconSvg()} Reply</button>` : ''}
    </div>
    ${canDeleteReply ? `<button class="comment-del" data-role="delete-reply" data-comment-id="${commentId}" data-reply-id="${r.id}" title="Delete reply">${trashIconSvg()}</button>` : ''}
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
    <a href="${profileUrl(c.username)}" aria-label="View profile @${escapeHtml(c.username || '')}"><img class="avatar-circle avatar-circle-sm clickable" src="${c.avatar || ''}" onerror="this.style.visibility='hidden'" loading="lazy" decoding="async"></a>
    <div class="comment-body">
      <div class="comment-nickname">${escapeHtml(c.nickname || c.username)}${roleBadgeHtml(c.role)}${devBadgeHtml(c.isDeveloper)}</div>
      <div class="comment-meta"><a class="user-link" href="${profileUrl(c.username)}">@${escapeHtml(c.username)}</a>${badgesHtml(c.badges)} · ${timeAgo(c.createdAt)}</div>
      ${commentBodyHtml(c)}

      ${me ? `<button type="button" class="comment-action-btn reply-toggle-btn" data-id="${c.id}" data-target="${escapeHtml(c.username || '')}" data-target-nick="${escapeHtml(c.nickname || c.username || '')}">${replyIconSvg()} Reply</button>` : ''}

      ${replies.length ? `
      <button type="button" class="view-replies-btn" data-id="${c.id}" aria-expanded="false">
        <span class="view-replies-line"></span>
        <span class="view-replies-label">View ${replies.length} replies</span>
        <svg class="view-replies-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="reply-thread" id="replies-${c.id}" style="display:none">
        ${replies.map(r => replyItemHtml(r, c.id, isOwner, c.username)).join('')}
      </div>` : ''}
    </div>
    ${canDelete ? `<button class="comment-del" data-role="delete-comment" title="Delete comment">${trashIconSvg()}</button>` : ''}
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

function markdownIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16v11H4z"/><path d="M7 15V9l2.5 3L12 9v6"/><path d="M15.5 12.5 17 15l1.5-2.5"/><path d="M17 9v6"/></svg>`
}
function wrapIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h12"/><path d="M4 12h16"/><path d="M4 17h8"/><path d="M15 15l3 3-3 3"/><path d="M18 18h2a2 2 0 0 0 0-4h-1"/></svg>`
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
             <textarea id="commentInput" class="comment-input" placeholder="Write a comment..." maxlength="500" rows="1"></textarea>
           </div>
           <button class="send-icon-btn" id="commentSendBtn" title="Kirim">${sendIconSvg()}</button>
         </div>
       </div>`
    : `<div class="comment-form-locked">${t('signInToComment')} <a href="/auth">${t('signIn')}</a></div>`

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
      input.placeholder = `Reply to ${nickname || username}...`
      input.focus()
    }
    document.getElementById('commentFormWrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function exitReplyMode() {
    replyTarget = null
    if (chip) chip.style.display = 'none'
    if (input) input.placeholder = 'Write a comment about this code...'
  }

  chipCancel?.addEventListener('click', exitReplyMode)

  async function loadComments() {
    try {
      const comments = await api(`/codes/${shortId}/comments`)
      countEl.textContent = comments.length ? `(${comments.length})` : ''
      listEl.innerHTML = comments.length
        ? comments.slice().reverse().map(c => commentCardHtml(c, me && (me.username === c.username || isOwner), isOwner)).join('')
        : `<div class="empty-state-sm">${t('noComments')}</div>`

      listEl.querySelectorAll('[data-role="delete-comment"]').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.closest('.comment-item').dataset.id
          if (!confirm('Delete this comment?')) return
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
          if (label) label.textContent = willExpand ? 'Hide replies' : `View ${count} replies`
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
          if (!confirm('Delete this reply?')) return
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


function embedIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 8 5 12l4 4"/><path d="M15 8l4 4-4 4"/><path d="M13 6l-2 12"/></svg>`
}

function wireCodeKeyboard(s) {
  if (window.__coderyKeyWired) return
  window.__coderyKeyWired = true
  document.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
    if (e.key === 'c' || e.key === 'C') {
      if (!s?.content) return
      navigator.clipboard.writeText(s.content)
      toast('Copied!')
    }
  })
}

function highlightLinesFromHash() {
  const pre = document.getElementById('codeViewPre')
  if (!pre) return
  const m = location.hash.match(/^#L(\d+)(?:-L?(\d+))?$/i)
  if (!m) return
  const start = parseInt(m[1], 10)
  const end = m[2] ? parseInt(m[2], 10) : start
  const code = pre.querySelector('code')
  if (!code) return
  const lines = code.innerHTML.split('\n')
  const out = lines.map((line, i) => {
    const n = i + 1
    if (n >= start && n <= end) return `<span class="line-hl">${line}</span>`
    return line
  })
  code.innerHTML = out.join('\n')
  const hl = pre.querySelector('.line-hl')
  if (hl) hl.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

async function loadRelatedCodes(s) {
  const box = document.getElementById('relatedCodes')
  if (!box || !s) return
  try {
    const all = await api('/codes')
    const tags = new Set((s.tags || []).map(t => t.toLowerCase()))
    const lang = (s.language || '').toLowerCase()
    const related = all
      .filter(x => x.shortId !== s.shortId)
      .map(x => {
        let score = 0
        if ((x.language || '').toLowerCase() === lang) score += 2
        ;(x.tags || []).forEach(t => { if (tags.has(t.toLowerCase())) score += 3 })
        return { x, score }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || b.x.createdAt - a.x.createdAt)
      .slice(0, 4)
      .map(r => r.x)
    if (!related.length) return
    box.style.display = 'block'
    box.innerHTML = `
      <div class="related-title">${t('relatedCode')}</div>
      <div class="related-scroll" role="list">
        ${related.map(r => `
          <a class="related-card" href="${codeUrl(r.shortId)}" role="listitem">
            <div class="related-card-head">
              ${avatarHtml(r.ownerAvatar, r.ownerNickname || r.ownerUsername || '?', 'avatar-tiny')}
              <div class="related-card-who">
                <span class="related-card-nick">${escapeHtml(r.ownerNickname || r.ownerUsername || '')}</span>
                <span class="related-card-user">@${escapeHtml(r.ownerUsername || '')}</span>
              </div>
            </div>
            <div class="related-card-title">${escapeHtml(r.title)}</div>
            ${r.description ? `<div class="related-card-desc">${escapeHtml(r.description)}</div>` : ''}
          </a>
        `).join('')}
      </div>
    `
  } catch {}
}


function moreDotsSvg() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>`
}
function editIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`
}

