function eyeIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
}
function eyeOffIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
}
function docCopyIconSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`
}

function maskKey(key) {
  if (!key) return ''
  if (key.length <= 10) return '•'.repeat(key.length)
  return key.slice(0, 8) + '•'.repeat(10) + key.slice(-4)
}

let currentKey = ''
let keyVisible = false

function renderExamples(key) {
  const shown = key || 'API_KEY_KAMU'
  const base = `${location.origin}/api/public`
  document.getElementById('apiBaseUrl').textContent = '/api/public'
  document.getElementById('curlExample').textContent =
    `curl "${base}/snippets" \\\n  -H "X-API-Key: ${shown}"`
  document.getElementById('jsExample').textContent =
`const res = await fetch('${base}/snippets', {
  headers: { 'X-API-Key': '${shown}' }
})
const data = await res.json()
console.log(data)`
  if (window.hljs) {
    document.querySelectorAll('#app pre code').forEach(el => hljs.highlightElement(el))
  }
}

function renderKeyBox() {
  const valueEl = document.getElementById('apiKeyValue')
  valueEl.textContent = keyVisible ? currentKey : maskKey(currentKey)
  document.getElementById('apiKeyEyeBtn').innerHTML = keyVisible ? eyeOffIconSvg() : eyeIconSvg()
}

async function loadApiKey() {
  try {
    const r = await api('/users/me/apikey')
    currentKey = r.apiKey
    renderKeyBox()
    renderExamples(currentKey)
  } catch (e) {
    document.getElementById('apiKeyValue').textContent = 'Gagal memuat key'
    toast(e.message)
  }
}

document.getElementById('apiKeyCopyBtn').innerHTML = docCopyIconSvg()
document.getElementById('apiKeyEyeBtn').innerHTML = eyeIconSvg()

document.getElementById('apiKeyEyeBtn').onclick = () => {
  keyVisible = !keyVisible
  renderKeyBox()
}
document.getElementById('apiKeyCopyBtn').onclick = () => {
  if (!currentKey) return
  navigator.clipboard.writeText(currentKey)
  toast('API key disalin!')
}
document.getElementById('apiKeyRegenBtn').onclick = async () => {
  if (!confirm('Yakin generate ulang? Key lama bakal langsung gak berlaku lagi.')) return
  try {
    const r = await api('/users/me/apikey/regenerate', { method: 'POST' })
    currentKey = r.apiKey
    keyVisible = true
    renderKeyBox()
    renderExamples(currentKey)
    toast('API key baru dibuat!')
  } catch (e) { toast(e.message) }
}

refreshAuth().then(() => { if (!me) window.location.href = '/auth' })
renderExamples('')
loadApiKey()
