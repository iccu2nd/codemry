const UPLOAD_DRAFT_KEY = 'codery-upload-draft'

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(UPLOAD_DRAFT_KEY) || 'null') } catch { return null }
}
function saveDraft(data) {
  try { localStorage.setItem(UPLOAD_DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() })) } catch {}
}
function clearDraft() {
  try { localStorage.removeItem(UPLOAD_DRAFT_KEY) } catch {}
}

async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  let step = 1
  const TOTAL = 3
  const saved = {}
  const draft = loadDraft()
  if (draft) {
    Object.assign(saved, draft)
    if (draft.content) toast('Draft restored')
  }

  const EXT_LANG = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', html: 'html', htm: 'html', css: 'css', json: 'json',
    java: 'java', php: 'php', sh: 'bash', md: 'markdown', txt: 'text',
    c: 'text', cpp: 'text', go: 'text', rb: 'text', rs: 'text',
    kt: 'text', swift: 'text', xml: 'text', yml: 'text', yaml: 'text', sql: 'text', env: 'text'
  }
  const LANG_EXT = {
    javascript: 'js', typescript: 'ts', python: 'py', html: 'html', css: 'css',
    json: 'json', java: 'java', php: 'php', bash: 'sh', markdown: 'md', text: 'txt'
  }

  function stepDots() {
    return Array.from({ length: TOTAL }, (_, i) => {
      const n = i + 1
      const cls = n < step ? 'done' : (n === step ? 'active' : '')
      return `<div class="upload-step-dot ${cls}"><span>${n}</span></div>`
    }).join('<div class="upload-step-line"></div>')
  }

  function snapshot() {
    const form = document.getElementById('uploadForm')
    if (!form) return
    ;['content', 'language', 'title', 'description', 'filename', 'tags'].forEach(n => {
      const el = form.elements[n]
      if (el) saved[n] = el.value
    })
    const pub = document.getElementById('isPublic')
    const pin = document.getElementById('usePin')
    const pinVal = document.getElementById('pinInput')
    const expires = document.getElementById('expiresSelect')
    if (pub) saved.isPublic = pub.checked
    if (pin) saved.usePin = pin.checked
    if (pinVal) saved.pin = pinVal.value
    if (expires) saved.expiresSelect = expires.value
    if (saved.content) saveDraft(saved)
  }

  function restore() {
    const form = document.getElementById('uploadForm')
    if (!form) return
    Object.keys(saved).forEach(n => {
      if (n === 'isPublic' || n === 'usePin' || n === 'pin') return
      const el = form.elements[n]
      if (el && saved[n] != null) el.value = saved[n]
    })
    const pub = document.getElementById('isPublic')
    const pin = document.getElementById('usePin')
    const pinField = document.getElementById('pinField')
    const pinVal = document.getElementById('pinInput')
    const expires = document.getElementById('expiresSelect')
    if (pub && saved.isPublic != null) pub.checked = saved.isPublic
    if (pin && saved.usePin != null) {
      pin.checked = saved.usePin
      if (pinField) pinField.style.display = saved.usePin ? 'block' : 'none'
    }
    if (pinVal && saved.pin != null) pinVal.value = saved.pin
    if (expires && saved.expiresSelect != null) expires.value = saved.expiresSelect
  }

  function render() {
    snapshot()
    document.getElementById('uploadPage').innerHTML = `
    <div class="card upload-wizard">
      <div class="upload-steps">${stepDots()}</div>
      <div class="upload-step-labels">
        <span class="${step === 1 ? 'on' : ''}">Code</span>
        <span class="${step === 2 ? 'on' : ''}">Details</span>
        <span class="${step === 3 ? 'on' : ''}">Publish</span>
      </div>
      <form id="uploadForm" autocomplete="off">
        <div class="upload-panel" style="display:${step === 1 ? 'block' : 'none'}">
          <div class="upload-value">
            <div class="upload-value-title">${t('uploadValueTitle')}</div>
            <div class="upload-value-sub">${t('uploadValueSub')}</div>
          </div>
          <div class="upload-panel-title">${t('yourCode')}</div>
          <div class="upload-panel-sub">${t('yourCodeSub')}</div>
          ${draft && draft.content ? `<div class="upload-draft-note">Draft restored from this device. <button type="button" class="link-btn-inline" id="clearDraftBtn">Discard draft</button></div>` : ''}
          <div class="upload-source-row">
            <button type="button" class="btn btn-white btn-block" id="pickFileBtn">${uploadIconSvg()} ${t('chooseFile')}</button>
            <input type="file" id="fileInput" style="display:none" accept=".js,.jsx,.ts,.tsx,.py,.html,.htm,.css,.json,.java,.php,.sh,.md,.txt,.c,.cpp,.go,.rb,.rs,.kt,.swift,.xml,.yml,.yaml,.sql,.env">
          </div>
          <div class="field-hint" style="margin-bottom:12px">File name → title, filename, and language auto-fill.</div>
          <div class="field"><label>Language</label>
            <select name="language">
              <option>javascript</option><option>typescript</option><option>python</option><option>html</option>
              <option>css</option><option>json</option><option>java</option><option>php</option>
              <option>bash</option><option>markdown</option><option>text</option>
            </select>
          </div>
          <div class="field"><label>Code</label>
            <textarea name="content" placeholder="Paste your code here…" required rows="12"></textarea>
          </div>
          <div class="upload-nav">
            <span class="upload-nav-hint">Step 1 of 3</span>
            <button type="button" class="btn btn-primary" id="next1">Continue</button>
          </div>
        </div>
        <div class="upload-panel" style="display:${step === 2 ? 'block' : 'none'}">
          <div class="upload-panel-title">Details</div>
          <div class="upload-panel-sub">A clear title helps people find your code. Description and tags are optional.</div>
          <div class="field"><label>Title</label>
            <input name="title" placeholder="e.g. Search script for MLBB" required>
          </div>
          <div class="field">
            <label>Description <span class="label-opt">(optional)</span></label>
            <div class="textarea-counter-wrap">
              <textarea name="description" id="descriptionInput" class="textarea-autogrow" placeholder="Short description…" style="min-height:70px" rows="2" maxlength="500"></textarea>
              <span class="char-counter" id="descCount">0 / 500</span>
            </div>
          </div>
          <div class="field">
            <label>Filename</label>
            <input name="filename" placeholder="script.js" required>
            <div class="field-hint">Extension is added automatically if missing.</div>
          </div>
          <div class="field">
            <label>Tags <span class="label-opt">(optional, max 5)</span></label>
            <input name="tags" placeholder="#search #tools">
            <div class="field-hint">Separate with spaces or commas.</div>
          </div>
          <div class="upload-nav">
            <button type="button" class="btn btn-white" id="back2">Back</button>
            <button type="button" class="btn btn-primary" id="next2">Continue</button>
          </div>
        </div>
        <div class="upload-panel" style="display:${step === 3 ? 'block' : 'none'}">
          <div class="upload-panel-title">Review & publish</div>
          <div class="upload-panel-sub">Check the preview, then choose who can see it</div>
          <div class="upload-preview-box" id="uploadPreviewBox"></div>
          <div class="upload-options">
            <label class="upload-option">
              <input type="checkbox" name="isPublic" id="isPublic" checked>
              <div>
                <div class="upload-option-title">Public on feed</div>
                <div class="upload-option-desc">Anyone can find it. Uncheck for link-only access.</div>
              </div>
            </label>
            <label class="upload-option">
              <input type="checkbox" id="usePin">
              <div>
                <div class="upload-option-title">Password lock</div>
                <div class="upload-option-desc">Viewers must enter the password first</div>
              </div>
            </label>
          </div>
          <div class="field" id="pinField" style="display:none">
            <label>Password (4–8 characters, letters/numbers)</label>
            <input type="password" id="pinInput" maxlength="8" placeholder="e.g. r4hasia">
          </div>
          <div class="field">
            <label>${t('expirationLabel')} <span class="label-opt">(${t('optional')})</span></label>
            ${expirySelectHtml('expiresSelect', 'create')}
            <div class="field-hint" id="expiresHint">${t('expirationHint')}</div>
          </div>
          <div class="upload-summary" id="uploadSummary"></div>
          <div class="upload-progress" id="uploadProgress" hidden>
            <div class="up-prog-track"><div class="up-prog-bar"></div></div>
            <div class="up-prog-label">Publishing your code…</div>
          </div>
          <div class="upload-privacy-note">You can edit or delete anytime. Password protects the code body; the title stays visible.</div>
          <div class="upload-nav">
            <button type="button" class="btn btn-white" id="back3">Back</button>
            <button class="btn btn-primary" type="submit" id="submitBtn">Publish code</button>
          </div>
        </div>
      </form>
    </div>`
    restore()

    function updatePreview() {
      const box = document.getElementById('uploadPreviewBox')
      if (!box) return
      const title = (document.querySelector('[name=title]')?.value || saved.title || 'Untitled').trim()
      const lang = document.querySelector('[name=language]')?.value || saved.language || 'text'
      const filename = (document.querySelector('[name=filename]')?.value || saved.filename || '').trim()
      const content = document.querySelector('[name=content]')?.value || saved.content || ''
      const lines = content.split('\n').filter(Boolean).slice(0, 5).join('\n')
      const desc = (document.querySelector('[name=description]')?.value || saved.description || '').trim()
      const tagsRaw = (document.querySelector('[name=tags]')?.value || saved.tags || '').trim()
      const tags = tagsRaw.split(/[\s,]+/).map(t => t.replace(/^#/, '')).filter(Boolean).slice(0, 5)
      const nick = (me && (me.nickname || me.username)) || 'You'
      const uname = (me && me.username) || 'you'
      const av = me ? me.avatar : null
      box.innerHTML = `
        <div class="up-prev-label">Preview</div>
        <div class="up-prev-card">
          <div class="up-prev-head">
            ${avatarHtml(av, nick, 'avatar-circle-sm')}
            <div class="up-prev-names">
              <div class="up-prev-nick">${escapeHtml(nick)}</div>
              <div class="up-prev-user">@${escapeHtml(uname)}</div>
            </div>
            <span class="up-prev-lang">${escapeHtml(lang)}</span>
          </div>
          <div class="up-prev-title">${escapeHtml(title)}</div>
          ${desc ? `<div class="up-prev-desc">${escapeHtml(desc)}</div>` : ''}
          ${tags.length ? `<div class="up-prev-tags">${tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          <div class="up-prev-code-wrap">
            <div class="up-prev-file">${escapeHtml(filename || 'file')}</div>
            <pre class="up-prev-code"><code class="language-${hljsLang(lang)}">${escapeHtml(lines || '// empty')}</code></pre>
          </div>
        </div>
      `
      if (window.hljs) hljs.highlightElement(box.querySelector('.up-prev-code code'))
    }
    updatePreview()

    wire()
    if (step === 3) {
      const sum = document.getElementById('uploadSummary')
      if (sum) {
        const expiresMs = Number(saved.expiresSelect || 0)
        const expiresLabel = expiresMs
          ? new Date(Date.now() + expiresMs).toLocaleDateString()
          : t('expiresPermanent')
        sum.innerHTML = `
          <div class="upload-sum-row"><span>Title</span><b>${escapeHtml(saved.title || '')}</b></div>
          <div class="upload-sum-row"><span>File</span><b>${escapeHtml(saved.filename || '')}</b></div>
          <div class="upload-sum-row"><span>Language</span><b>${escapeHtml(saved.language || '')}</b></div>
          <div class="upload-sum-row"><span>${t('expirationLabel')}</span><b>${escapeHtml(expiresLabel)}</b></div>`
      }
    }
  }

  function wire() {
    const form = document.getElementById('uploadForm')
    const fileInput = document.getElementById('fileInput')
    const usePinCb = document.getElementById('usePin')
    const pinField = document.getElementById('pinField')
    const pinInput = document.getElementById('pinInput')
    const filenameInput = form.elements['filename']
    const languageInput = form.elements['language']
    const descriptionInput = document.getElementById('descriptionInput')
    const descCount = document.getElementById('descCount')
    const submitBtn = document.getElementById('submitBtn')
    const contentInput = form.elements['content']
    const titleInput = form.elements['title']

    if (filenameInput) wireFilenameSpaces(filenameInput)
    if (descriptionInput) {
      wireAutoGrowTextarea(descriptionInput)
      const updateDescCount = () => {
        if (!descCount) return
        descCount.textContent = `${descriptionInput.value.length} / 500`
        descCount.classList.toggle('char-counter-limit', descriptionInput.value.length >= 500)
      }
      descriptionInput.addEventListener('input', updateDescCount)
      updateDescCount()
    }

    function applyAutoExtension() {
      if (!filenameInput || !languageInput) return
      const name = filenameInput.value.trim()
      if (!name || name.includes('.')) return
      filenameInput.value = `${name}.${LANG_EXT[languageInput.value] || 'txt'}`
    }
    filenameInput?.addEventListener('blur', applyAutoExtension)
    languageInput?.addEventListener('change', applyAutoExtension)

    if (usePinCb) {
      usePinCb.onchange = () => {
        pinField.style.display = usePinCb.checked ? 'block' : 'none'
        if (!usePinCb.checked && pinInput) pinInput.value = ''
      }
    }

    const expiresSelect = document.getElementById('expiresSelect')
    const expiresHint = document.getElementById('expiresHint')
    if (expiresSelect && expiresHint) {
      const updateExpiresHint = () => {
        const ms = Number(expiresSelect.value)
        expiresHint.textContent = ms
          ? `${t('expiresOn')} ${new Date(Date.now() + ms).toLocaleString()}`
          : t('expirationHint')
      }
      expiresSelect.addEventListener('change', updateExpiresHint)
      updateExpiresHint()
    }

    document.getElementById('pickFileBtn')?.addEventListener('click', () => fileInput?.click())
    if (fileInput) {
      fileInput.onchange = async () => {
        const file = fileInput.files[0]
        if (!file) return
        const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
        if (!ext || !EXT_LANG.hasOwnProperty(ext)) {
          toast('Only code files (.js, .py, .html, etc.)')
          fileInput.value = ''
          return
        }
        try {
          const text = await file.text()
          if (contentInput) contentInput.value = text
          if (filenameInput) filenameInput.value = file.name.replace(/\s/g, '_')
          if (languageInput) languageInput.value = EXT_LANG[ext] || 'text'
          if (titleInput && !titleInput.value.trim()) {
            titleInput.value = ext ? file.name.slice(0, -(ext.length + 1)) : file.name
          }
          toast('File loaded')
        } catch { toast('Failed to read file') }
        finally { fileInput.value = '' }
      }
    }

    document.getElementById('next1')?.addEventListener('click', () => {
      if (!contentInput?.value.trim()) { toast('Please add code first'); return }
      step = 2
      render()
    })
    document.getElementById('next2')?.addEventListener('click', () => {
      if (!titleInput?.value.trim()) { toast('Please add a title'); return }
      if (!filenameInput?.value.trim()) { toast('Please add a filename'); return }
      applyAutoExtension()
      step = 3
      render()
    })
    document.getElementById('back2')?.addEventListener('click', () => { step = 1; render() })
    document.getElementById('back3')?.addEventListener('click', () => { step = 2; render() })

    document.getElementById('clearDraftBtn')?.addEventListener('click', () => {
      clearDraft()
      toast('Draft discarded')
      location.reload()
    })

    form.onsubmit = async (e) => {
      e.preventDefault()
      if (submitBtn?.disabled) return
      applyAutoExtension()
      const pin = usePinCb?.checked ? (pinInput?.value.trim() || '') : ''
      if (usePinCb?.checked && !/^[a-zA-Z0-9]{4,8}$/.test(pin)) { toast('Password must be 4–8 characters (letters/numbers)'); return }
      const expiresMs = Number(expiresSelect?.value || 0)
      const expiresAt = expiresMs ? Date.now() + expiresMs : null
      const f = new FormData(form)
      setBtnLoading(submitBtn, true)
      const progress = document.getElementById('uploadProgress')
      if (progress) { progress.hidden = false; progress.querySelector('.up-prog-bar').style.width = '35%' }
      try {
        if (progress) progress.querySelector('.up-prog-bar').style.width = '70%'
        const s = await api('/codes', {
          method: 'POST',
          body: JSON.stringify({
            title: f.get('title'),
            filename: f.get('filename'),
            content: f.get('content'),
            language: f.get('language'),
            description: f.get('description'),
            tags: f.get('tags'),
            isPublic: f.get('isPublic') === 'on',
            pin,
            expiresAt
          })
        })
        clearDraft()
        toast(t('published'))
        window.location.href = codeUrl(s.shortId)
      } catch (err) {
        toast(err.message)
        setBtnLoading(submitBtn, false)
        if (progress) progress.hidden = true
      }
    }
  }

  render()
}

function uploadIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 18.5h15"/></svg>`
}

init()
