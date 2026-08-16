/* ============================================================
   Halaman Dokumentasi API
   - API key TIDAK PERNAH dibuat otomatis. Hanya dibuat saat
     pengguna menekan tombol "Generate API Key" sendiri.
   - Daftar API di bawah dikelompokkan menjadi "Tanpa API Key"
     dan "Butuh API Key" agar mudah dipahami pemula.
   - Contoh request/response ditampilkan dalam bentuk jendela
     kode, konsisten dengan gaya pratinjau kode di Feed.
   ============================================================ */

function eyeIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
}
function eyeOffIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
}
function docCopyIconSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
}
function keyIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4M17 6l2 2M14 9l2 2"/></svg>`
}
function lockMiniIconSvg() {
  return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
}
function unlockMiniIconSvg() {
  return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.5-2.2"/></svg>`
}

function maskKey(key) {
  if (!key) return ''
  if (key.length <= 10) return '•'.repeat(key.length)
  return key.slice(0, 8) + '•'.repeat(10) + key.slice(-4)
}

// currentKey: null = belum pernah dibuat. string = key aktif.
let currentKey = null
let keyVisible = false

function apiBase() { return `${location.origin}/api/public` }

// ---- Data semua endpoint (dipakai untuk render index + kartu) ----------
function buildApiList() {
  const base = apiBase()
  const shown = () => currentKey || 'API_KEY_ANDA'

  return [
    {
      id: 'public-snippet',
      name: 'Public Snippet',
      tagline: 'Mengambil detail satu kode publik berdasarkan shortId',
      method: 'GET',
      endpoint: '/snippet/:shortId',
      keyRequired: false,
      usage: 'Cocok untuk menampilkan pratinjau kode publik di situs atau aplikasi lain tanpa perlu login, misalnya widget "kode terbaru saya" di portofolio.',
      params: [
        { name: 'shortId', type: 'string (path)', required: true, desc: 'ID pendek snippet, contoh: aB3xQ1 (terlihat pada URL codery.app/c/aB3xQ1)' }
      ],
      curl: () => `curl "${base}/snippet/aB3xQ1"`,
      js: () => `const res = await fetch('${base}/snippet/aB3xQ1')\nconst data = await res.json()\nconsole.log(data)`,
      response: `{
  "shortId": "aB3xQ1",
  "title": "Notrack Ai",
  "filename": "notrack.js",
  "language": "javascript",
  "isPublic": true,
  "createdAt": 1755311234000,
  "views": 36,
  "likes": 4
}`
    },
    {
      id: 'me',
      name: 'Me',
      tagline: 'Informasi akun Anda sendiri yang sedang login melalui API key',
      method: 'GET',
      endpoint: '/me',
      keyRequired: true,
      usage: 'Digunakan untuk memeriksa "API key ini milik siapa" — biasanya langkah pertama saat mencoba integrasi API.',
      params: [],
      curl: () => `curl "${base}/me" \\\n  -H "X-API-Key: ${shown()}"`,
      js: () => `const res = await fetch('${base}/me', {\n  headers: { 'X-API-Key': '${shown()}' }\n})\nconst data = await res.json()\nconsole.log(data)`,
      response: `{
  "username": "reyzdesu",
  "nickname": "Reyz",
  "bio": "suka ngoding pas malam",
  "avatar": "https://.../avatar/reyzdesu",
  "createdAt": 1712345678000
}`
    },
    {
      id: 'all-snippets',
      name: 'All Snippets',
      tagline: 'Seluruh kode publik yang telah Anda unggah',
      method: 'GET',
      endpoint: '/snippets',
      keyRequired: true,
      usage: 'Digunakan untuk menampilkan daftar lengkap kode Anda di tempat lain (portofolio, bot, dashboard pribadi, dan sejenisnya) tanpa perlu scraping halaman profil.',
      params: [],
      curl: () => `curl "${base}/snippets" \\\n  -H "X-API-Key: ${shown()}"`,
      js: () => `const res = await fetch('${base}/snippets', {\n  headers: { 'X-API-Key': '${shown()}' }\n})\nconst data = await res.json()\nconsole.log(data)`,
      response: `{
  "username": "reyzdesu",
  "count": 2,
  "snippets": [
    {
      "shortId": "aB3xQ1",
      "title": "Notrack Ai",
      "language": "javascript",
      "isPublic": true,
      "views": 36,
      "likes": 4
    }
  ]
}`
    },
    {
      id: 'upload',
      name: 'Upload',
      tagline: 'Mengunggah kode baru ke akun Anda',
      method: 'POST',
      endpoint: '/snippets',
      keyRequired: true,
      usage: 'Cocok untuk pengunggahan otomatis dari script atau CI Anda, misalnya setiap kali menyimpan snippet baru di editor lokal, langsung terkirim ke Codery.',
      params: [
        { name: 'filename', type: 'string', required: true, desc: 'Nama file, contoh: script.js' },
        { name: 'content', type: 'string', required: true, desc: 'Isi kode' },
        { name: 'title', type: 'string', required: false, desc: 'Judul kode, default mengikuti nama file' },
        { name: 'description', type: 'string', required: false, desc: 'Deskripsi singkat (maksimal 500 karakter)' },
        { name: 'language', type: 'string', required: false, desc: 'Contoh: javascript, python, dan sebagainya' },
        { name: 'tags', type: 'array/string', required: false, desc: 'Maksimal 5 tag' },
        { name: 'isPublic', type: 'boolean', required: false, desc: 'Menentukan tampil atau tidaknya di feed publik' },
        { name: 'pin', type: 'string', required: false, desc: 'Opsional, PIN kunci 4-8 digit' }
      ],
      curl: () => `curl -X POST "${base}/snippets" \\\n  -H "X-API-Key: ${shown()}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"filename":"script.js","content":"console.log(1)","title":"Script Saya","isPublic":true}'`,
      js: () => `const res = await fetch('${base}/snippets', {\n  method: 'POST',\n  headers: {\n    'X-API-Key': '${shown()}',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    filename: 'script.js',\n    content: 'console.log(1)',\n    title: 'Script Saya',\n    isPublic: true\n  })\n})\nconst data = await res.json()\nconsole.log(data)`,
      response: `{
  "shortId": "kL9pT2",
  "title": "script.js",
  "filename": "script.js",
  "language": "javascript",
  "isPublic": true,
  "createdAt": 1755311234000
}`
    }
  ]
}

function keyBadgeHtml(required) {
  return required
    ? `<span class="apikey-badge apikey-badge-required">${lockMiniIconSvg()} Butuh Key</span>`
    : `<span class="apikey-badge apikey-badge-free">${unlockMiniIconSvg()} Tanpa Key</span>`
}

function apiIndexRowHtml(a) {
  return `
    <a class="api-index-row" href="#api-${a.id}">
      <span class="doc-method-pill api-index-method method-${a.method.toLowerCase()}">${a.method}</span>
      <span class="api-index-info">
        <span class="api-index-name">${escapeHtml(a.name)}</span>
        <span class="api-index-endpoint">${escapeHtml(a.endpoint)}</span>
      </span>
      ${keyBadgeHtml(a.keyRequired)}
    </a>`
}

// Jendela kode bergaya pratinjau Feed: header titik merah/kuning/hijau + nama file.
function codeWindowHtml(filename, langClass, dataAttr) {
  return `
    <div class="doc-code-window">
      <div class="code-window-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="code-window-filename">${escapeHtml(filename)}</span></div>
      <div class="doc-code-block"><pre><code class="language-${langClass}" data-api-example="${dataAttr}"></code></pre></div>
    </div>`
}

function apiCardHtml(a) {
  const paramsTable = a.params.length ? `
    <div class="api-card-subtitle">Parameter</div>
    <table class="doc-param-table">
      <thead><tr><th>Nama</th><th>Tipe</th><th>Keterangan</th></tr></thead>
      <tbody>
        ${a.params.map(p => `<tr><td><code>${escapeHtml(p.name)}</code>${p.required ? ' <span class="param-required">*</span>' : ''}</td><td>${escapeHtml(p.type)}</td><td>${escapeHtml(p.desc)}</td></tr>`).join('')}
      </tbody>
    </table>` : `<div class="api-card-subtitle">Parameter</div><div class="empty-state-sm" style="padding:6px 0">Tidak ada parameter, panggil langsung endpoint ini.</div>`

  return `
  <div class="card api-doc-card" id="api-${a.id}">
    <div class="api-card-head">
      <div class="api-card-head-left">
        <span class="doc-method-pill api-index-method method-${a.method.toLowerCase()}">${a.method}</span>
        <span class="api-card-name">${escapeHtml(a.name)}</span>
      </div>
      ${keyBadgeHtml(a.keyRequired)}
    </div>
    <div class="doc-endpoint-path api-card-endpoint">${escapeHtml(a.endpoint)}</div>
    <div class="snippet-desc api-card-tagline">${escapeHtml(a.tagline)}</div>

    ${paramsTable}

    <div class="api-card-subtitle">Contoh Pemakaian</div>
    <div class="snippet-desc" style="margin-bottom:0">${escapeHtml(a.usage)}</div>

    <div class="doc-endpoint-row" style="margin-top:16px"><span class="doc-method-pill api-index-method method-${a.method.toLowerCase()}">${a.method}</span><span class="doc-endpoint-path">${escapeHtml(a.endpoint)}</span></div>
    <div class="api-card-subtitle" style="margin-top:10px">Contoh Request (cURL)</div>
    ${codeWindowHtml('terminal', 'bash', `${a.id}-curl`)}
    <div class="api-card-subtitle">Contoh Request (JavaScript fetch)</div>
    ${codeWindowHtml('fetch.js', 'javascript', `${a.id}-js`)}
    <div class="api-card-subtitle">Contoh Respons</div>
    <div class="doc-code-window">
      <div class="code-window-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="code-window-filename">response.json</span></div>
      <div class="doc-code-block"><pre><code class="language-json">${escapeHtml(a.response)}</code></pre></div>
    </div>
  </div>`
}

function renderApiDocs() {
  const list = buildApiList()
  const free = list.filter(a => !a.keyRequired)
  const auth = list.filter(a => a.keyRequired)

  document.getElementById('apiIndexList').innerHTML = `<div class="card api-index-card">${list.map(apiIndexRowHtml).join('')}</div>`
  document.getElementById('apiListFree').innerHTML = free.map(apiCardHtml).join('')
  document.getElementById('apiListAuth').innerHTML = auth.map(apiCardHtml).join('')

  list.forEach(a => {
    const curlEl = document.querySelector(`[data-api-example="${a.id}-curl"]`)
    const jsEl = document.querySelector(`[data-api-example="${a.id}-js"]`)
    if (curlEl) curlEl.textContent = a.curl()
    if (jsEl) jsEl.textContent = a.js()
  })

  if (window.hljs) {
    document.querySelectorAll('#app pre code').forEach(el => hljs.highlightElement(el))
  }
}

// ---- Bagian API key -----------------------------------------------------

function renderApiKeySection() {
  const box = document.getElementById('apiKeySection')

  if (!currentKey) {
    // Belum ada key — JANGAN dibuat otomatis. Tunggu pengguna menekan tombol.
    box.innerHTML = `
      <div class="apikey-empty-box">
        <div class="apikey-empty-text">Anda belum memiliki API key. Buat terlebih dahulu untuk mulai menggunakan endpoint yang membutuhkan autentikasi.</div>
        <button class="btn btn-primary btn-block" id="apiKeyGenBtn">${keyIconSvg()} Generate API Key</button>
      </div>`
    const genBtn = document.getElementById('apiKeyGenBtn')
    genBtn.onclick = async () => {
      genBtn.disabled = true
      genBtn.classList.add('btn-loading')
      try {
        const r = await api('/users/me/apikey/generate', { method: 'POST' })
        currentKey = r.apiKey
        keyVisible = true
        renderApiKeySection()
        renderApiDocs()
        toast('API key berhasil dibuat.')
      } catch (e) {
        toast(e.message)
        genBtn.disabled = false
        genBtn.classList.remove('btn-loading')
      }
    }
    return
  }

  box.innerHTML = `
    <div class="apikey-box">
      <span class="apikey-value" id="apiKeyValue">${escapeHtml(keyVisible ? currentKey : maskKey(currentKey))}</span>
      <button type="button" class="apikey-eye-btn" id="apiKeyEyeBtn" aria-label="Tampilkan atau sembunyikan key">${keyVisible ? eyeOffIconSvg() : eyeIconSvg()}</button>
      <button type="button" class="apikey-copy-btn" id="apiKeyCopyBtn" aria-label="Salin key">${docCopyIconSvg()}</button>
    </div>
    <div class="btn-row apikey-regen-row">
      <button class="btn btn-white btn-sm" id="apiKeyRegenBtn">Regenerate API Key</button>
    </div>
    <div class="field-hint">Regenerate akan langsung menonaktifkan key lama — semua tempat yang masih menggunakan key lama tidak akan bisa lagi mengakses API.</div>`

  document.getElementById('apiKeyEyeBtn').onclick = () => {
    keyVisible = !keyVisible
    renderApiKeySection()
  }
  document.getElementById('apiKeyCopyBtn').onclick = () => {
    if (!currentKey) return
    navigator.clipboard.writeText(currentKey)
    toast('API key disalin.')
  }
  document.getElementById('apiKeyRegenBtn').onclick = async () => {
    if (!confirm('Yakin ingin membuat ulang API key? Key lama akan langsung tidak berlaku dan tidak dapat dikembalikan.')) return
    const btn = document.getElementById('apiKeyRegenBtn')
    btn.disabled = true
    btn.classList.add('btn-loading')
    try {
      const r = await api('/users/me/apikey/regenerate', { method: 'POST' })
      currentKey = r.apiKey
      keyVisible = true
      renderApiKeySection()
      renderApiDocs()
      toast('API key baru berhasil dibuat.')
    } catch (e) {
      toast(e.message)
    } finally {
      btn.disabled = false
      btn.classList.remove('btn-loading')
    }
  }
}

async function loadApiKeyStatus() {
  try {
    // Endpoint ini hanya MEMERIKSA, tidak membuat key baru.
    const r = await api('/users/me/apikey')
    currentKey = r.apiKey || null
    keyVisible = false
  } catch (e) {
    currentKey = null
    toast(e.message)
  }
  renderApiKeySection()
  renderApiDocs()
}

document.getElementById('apiBaseUrl').textContent = '/api/public'
document.getElementById('apiKeySection').innerHTML = `<div class="empty-state-sm" style="padding:10px 0">Memuat status API key...</div>`
renderApiDocs()

refreshAuth().then(() => {
  if (!me) { window.location.href = '/auth'; return }
  loadApiKeyStatus()
})
