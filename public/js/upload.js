
async function init() {
  await refreshAuth()
  if (!me) { window.location.replace('/auth'); return }

  document.getElementById('uploadPage').innerHTML = `
    <div class="card">
      <div class="hero-title" style="font-size:22px">Upload Kode</div>
      <div class="hero-rule"></div>
      <div class="field">
        <button type="button" class="btn btn-white btn-block" id="pickFileBtn">${uploadIconSvg()} Upload dari File</button>
        <input type="file" id="fileInput" style="display:none" accept=".js,.jsx,.ts,.tsx,.py,.html,.htm,.css,.json,.java,.php,.sh,.md,.txt,.c,.cpp,.go,.rb,.rs,.kt,.swift,.xml,.yml,.yaml,.sql,.env">
        <div class="field-hint" id="fileHint">Judul, nama file, bahasa, dan kode otomatis terisi dari file yang dipilih.</div>
      </div>
      <form id="uploadForm">
        <div class="field"><label>Judul</label><input name="title" placeholder="Fungsi cek prima" required></div>
        <div class="field">
          <label>Deskripsi (opsional)</label>
          <div class="textarea-counter-wrap">
            <textarea name="description" id="descriptionInput" class="textarea-autogrow" placeholder="Penjelasan singkat soal kode ini..." style="min-height:70px" rows="2" maxlength="500"></textarea>
            <span class="char-counter" id="descCount">0 / 500</span>
          </div>
        </div>
        <div class="field">
          <label>Nama File</label>
          <input name="filename" placeholder="prima.js" required>
          <div class="field-hint">Lupa taruh akhiran juga gapapa, otomatis nyesuain bahasa yang dipilih.</div>
        </div>
        <div class="field"><label>Bahasa</label>
          <select name="language">
            <option>javascript</option><option>typescript</option><option>python</option><option>html</option>
            <option>css</option><option>json</option><option>java</option><option>php</option>
            <option>bash</option><option>markdown</option><option>text</option>
          </select>
        </div>
        <div class="field">
          <label>Tag (opsional, maks 5)</label>
          <input name="tags" placeholder="#algoritma #tutorial atau algoritma, tutorial">
          <div class="field-hint">Pisah pakai koma atau spasi, pake # juga boleh.</div>
        </div>
        <div class="field"><label>Kode</label><textarea name="content" placeholder="Tempel kode di sini, atau upload file di atas..." required></textarea></div>
        <div class="checkbox-row"><input type="checkbox" name="isPublic" id="isPublic" checked><label for="isPublic">Publik (tampil di feed)</label></div>
        <div class="checkbox-row"><input type="checkbox" id="usePin"><label for="usePin">Kunci pakai PIN</label></div>
        <div class="field" id="pinField" style="display:none">
          <label>PIN (4-8 digit angka)</label>
          <input type="tel" inputmode="numeric" pattern="[0-9]*" id="pinInput" maxlength="8" placeholder="misal 1234">
        </div>
        <button class="btn btn-primary btn-block" type="submit">Bagikan</button>
      </form>
    </div>
  `

  const EXT_LANG = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', html: 'html', htm: 'html', css: 'css', json: 'json',
    java: 'java', php: 'php', sh: 'bash', md: 'markdown', txt: 'text',
    c: 'text', cpp: 'text', go: 'text', rb: 'text', rs: 'text',
    kt: 'text', swift: 'text', xml: 'text', yml: 'text', yaml: 'text', sql: 'text', env: 'text'
  }
  // Ekstensi default per bahasa, dipakai buat auto-lengkapin nama file yang
  // belum ada akhirannya (mis. user ngetik "tiktok" doang, dilengkapin jadi "tiktok.js").
  const LANG_EXT = {
    javascript: 'js', typescript: 'ts', python: 'py', html: 'html', css: 'css',
    json: 'json', java: 'java', php: 'php', bash: 'sh', markdown: 'md', text: 'txt'
  }
  const form = document.getElementById('uploadForm')
  const fileInput = document.getElementById('fileInput')
  const usePinCb = document.getElementById('usePin')
  const pinField = document.getElementById('pinField')
  const pinInput = document.getElementById('pinInput')
  const filenameInput = form.elements['filename']
  const languageInput = form.elements['language']
  const descriptionInput = document.getElementById('descriptionInput')
  const descCount = document.getElementById('descCount')
  const submitBtn = form.querySelector('button[type="submit"]')

  wireFilenameSpaces(filenameInput)
  wireAutoGrowTextarea(form.elements['description'])

  // Nama file otomatis dikasih akhiran sesuai bahasa yang dipilih kalau user
  // belum nulis akhirannya sendiri.
  function applyAutoExtension() {
    const name = filenameInput.value.trim()
    if (!name || name.includes('.')) return
    const ext = LANG_EXT[languageInput.value] || 'txt'
    filenameInput.value = `${name}.${ext}`
  }
  filenameInput.addEventListener('blur', applyAutoExtension)
  languageInput.addEventListener('change', applyAutoExtension)

  function updateDescCount() {
    descCount.textContent = `${descriptionInput.value.length} / 500`
    descCount.classList.toggle('char-counter-limit', descriptionInput.value.length >= 500)
  }
  descriptionInput.addEventListener('input', updateDescCount)
  updateDescCount()

  usePinCb.onchange = () => {
    pinField.style.display = usePinCb.checked ? 'block' : 'none'
    if (!usePinCb.checked) pinInput.value = ''
  }
  document.getElementById('pickFileBtn').onclick = () => fileInput.click()
  fileInput.onchange = async () => {
    const file = fileInput.files[0]
    if (!file) return
    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
    // Whitelist ekstensi kode aja (sama kayak daftar di atribut accept). Ini jaga-jaga
    // kalau user milih "All files" di file picker dan nyoba upload gambar/zip/dll,
    // soalnya file binary kalau dibaca via file.text() bakal jadi teks acak/rusak.
    if (!ext || !EXT_LANG.hasOwnProperty(ext)) {
      toast('Cuma file kode yang bisa diupload (.js, .py, .html, dll) - bukan gambar/zip/file binary lain.')
      fileInput.value = ''
      return
    }
    try {
      const text = await file.text()
      const titleInput = form.elements['title']
      form.elements['filename'].value = file.name.replace(/\s/g, '_')
      form.elements['content'].value = text
      form.elements['language'].value = EXT_LANG[ext] || 'text'
      if (!titleInput.value.trim()) titleInput.value = ext ? file.name.slice(0, -(ext.length + 1)) : file.name
      toast('File dimuat, cek isian di bawah lalu bagikan.')
    } catch (e) { toast('Gagal membaca file') }
    finally { fileInput.value = '' }
  }

  form.onsubmit = async (e) => {
    e.preventDefault()
    if (submitBtn.disabled) return // cegah double-submit kalau user spam klik
    applyAutoExtension()
    const pin = usePinCb.checked ? pinInput.value.trim() : ''
    if (usePinCb.checked && !/^\d{4,8}$/.test(pin)) { toast('PIN harus 4-8 digit angka'); return }
    const f = new FormData(e.target)

    // Langsung kasih feedback instan pas diklik, biar gak berasa nge-freeze
    // nunggu request selesai.
    submitBtn.disabled = true
    const originalLabel = submitBtn.textContent
    submitBtn.textContent = 'Mengupload...'
    submitBtn.classList.add('btn-loading')

    try {
      const s = await api('/codes', {
        method: 'POST',
        body: JSON.stringify({
          title: f.get('title'), filename: f.get('filename'),
          content: f.get('content'), language: f.get('language'),
          description: f.get('description'),
          tags: f.get('tags'),
          isPublic: f.get('isPublic') === 'on',
          pin
        })
      })
      toast('Berhasil diupload!')
      window.location.href = codeUrl(s.shortId)
    } catch (err) {
      toast(err.message)
      submitBtn.disabled = false
      submitBtn.textContent = originalLabel
      submitBtn.classList.remove('btn-loading')
    }
  }
}

function uploadIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`
}

init()
