/* API Docs — complete rewrite with expanded endpoints & cleaner layout */

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

let currentKey = null
let keyVisible = false

function apiBase() { return `${location.origin}/api/public` }

function buildApiList() {
  const base = apiBase()
  const shown = () => currentKey || 'YOUR_API_KEY'

  return [
    {
      id: 'public-snippet',
      name: 'Get Public Snippet',
      tagline: 'Fetch one public snippet by shortId',
      method: 'GET',
      endpoint: '/snippet/:shortId',
      keyRequired: false,
      usage: 'Embed a public code preview on your portfolio, blog, or bot without authentication.',
      params: [
        { name: 'shortId', type: 'string (path)', required: true, desc: 'Short ID from the URL, e.g. aB3xQ1' }
      ],
      curl: () => `curl "${base}/snippet/aB3xQ1"`,
      js: () => `const res = await fetch('${base}/snippet/aB3xQ1')\nconst data = await res.json()\nconsole.log(data)`,
      response: `{\n  "shortId": "aB3xQ1",\n  "title": "Hello World",\n  "filename": "main.js",\n  "language": "javascript",\n  "isPublic": true,\n  "createdAt": 1755311234000,\n  "views": 36,\n  "likes": 4,\n  "expired": false\n}`
    },
    {
      id: 'public-user',
      name: 'Get User Profile',
      tagline: 'Public profile + counts for any username',
      method: 'GET',
      endpoint: '/user/:username',
      keyRequired: false,
      usage: 'Show author cards, follower counts, or link to a Codery profile from another site.',
      params: [
        { name: 'username', type: 'string (path)', required: true, desc: 'Codery username' }
      ],
      curl: () => `curl "${base}/user/reyzdesu"`,
      js: () => `const res = await fetch('${base}/user/reyzdesu')\nconst data = await res.json()\nconsole.log(data)`,
      response: `{\n  "username": "reyzdesu",\n  "nickname": "Reyz",\n  "bio": "night coder",\n  "avatar": "https://...",\n  "badges": ["contributor"],\n  "counts": { "snippets": 12, "followers": 40, "following": 8 }\n}`
    },
    {
      id: 'public-user-snippets',
      name: 'User Public Snippets',
      tagline: 'List all public snippets of a user',
      method: 'GET',
      endpoint: '/user/:username/snippets',
      keyRequired: false,
      usage: 'Build a “latest codes” widget for any public profile.',
      params: [
        { name: 'username', type: 'string (path)', required: true, desc: 'Codery username' }
      ],
      curl: () => `curl "${base}/user/reyzdesu/snippets"`,
      js: () => `const res = await fetch('${base}/user/reyzdesu/snippets')\nconst data = await res.json()\nconsole.log(data.snippets)`,
      response: `{\n  "username": "reyzdesu",\n  "count": 2,\n  "snippets": [ { "shortId": "aB3xQ1", "title": "...", "views": 10, "likes": 2 } ]\n}`
    },
    {
      id: 'public-leaderboard',
      name: 'Leaderboard',
      tagline: 'Top uploaders, most liked, most followed',
      method: 'GET',
      endpoint: '/leaderboard',
      keyRequired: false,
      usage: 'Display community rankings without scraping the leaderboard page.',
      params: [],
      curl: () => `curl "${base}/leaderboard"`,
      js: () => `const res = await fetch('${base}/leaderboard')\nconst data = await res.json()\nconsole.log(data.topUploaders)`,
      response: `{\n  "topUploaders": [{ "username": "reyzdesu", "value": 42 }],\n  "topLiked": [{ "username": "alice", "value": 120 }],\n  "topFollowed": [{ "username": "bob", "value": 88 }]\n}`
    },
    {
      id: 'me',
      name: 'Me',
      tagline: 'Your account info via API key',
      method: 'GET',
      endpoint: '/me',
      keyRequired: true,
      usage: 'Verify the key owner and read your profile counts.',
      params: [],
      curl: () => `curl "${base}/me" \\\n  -H "X-API-Key: ${shown()}"`,
      js: () => `const res = await fetch('${base}/me', {\n  headers: { 'X-API-Key': '${shown()}' }\n})\nconst data = await res.json()\nconsole.log(data)`,
      response: `{\n  "username": "reyzdesu",\n  "nickname": "Reyz",\n  "bio": "...",\n  "avatar": "https://...",\n  "counts": { "snippets": 15, "public": 12, "followers": 40, "following": 8 }\n}`
    },
    {
      id: 'my-snippets',
      name: 'My Snippets',
      tagline: 'List your snippets (public by default)',
      method: 'GET',
      endpoint: '/snippets',
      keyRequired: true,
      usage: 'Sync your codes to another dashboard. Add ?private=1 to include private ones.',
      params: [
        { name: 'private', type: 'query', required: false, desc: 'Set to 1 to include private snippets' }
      ],
      curl: () => `curl "${base}/snippets" \\\n  -H "X-API-Key: ${shown()}"`,
      js: () => `const res = await fetch('${base}/snippets', {\n  headers: { 'X-API-Key': '${shown()}' }\n})\nconst data = await res.json()\nconsole.log(data)`,
      response: `{\n  "username": "reyzdesu",\n  "count": 12,\n  "snippets": [ { "shortId": "...", "title": "...", "views": 5, "likes": 1, "expired": false } ]\n}`
    },
    {
      id: 'create-snippet',
      name: 'Create Snippet',
      tagline: 'Upload a new code via API',
      method: 'POST',
      endpoint: '/snippets',
      keyRequired: true,
      usage: 'Automate uploads from CI, scripts, or bots. Supports expiresAt (epoch ms).',
      params: [
        { name: 'title', type: 'string', required: true, desc: 'Snippet title' },
        { name: 'content', type: 'string', required: true, desc: 'Source code body' },
        { name: 'filename', type: 'string', required: false, desc: 'Default: main.txt' },
        { name: 'language', type: 'string', required: false, desc: 'e.g. javascript, python' },
        { name: 'description', type: 'string', required: false, desc: 'Optional description' },
        { name: 'tags', type: 'string|array', required: false, desc: 'Comma-separated or array, max 5' },
        { name: 'isPublic', type: 'boolean', required: false, desc: 'Default true' },
        { name: 'expiresAt', type: 'number|null', required: false, desc: 'Epoch ms; null = permanent' }
      ],
      curl: () => `curl -X POST "${base}/snippets" \\\n  -H "X-API-Key: ${shown()}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Hi","content":"console.log(1)","language":"javascript"}'`,
      js: () => `const res = await fetch('${base}/snippets', {\n  method: 'POST',\n  headers: {\n    'X-API-Key': '${shown()}',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    title: 'Hi',\n    content: 'console.log(1)',\n    language: 'javascript',\n    expiresAt: Date.now() + 86400000\n  })\n})\nconst data = await res.json()\nconsole.log(data)`,
      response: `{\n  "shortId": "xY9k2m",\n  "title": "Hi",\n  "language": "javascript",\n  "isPublic": true,\n  "expiresAt": null,\n  "expired": false\n}`
    },
    {
      id: 'update-snippet',
      name: 'Update Snippet',
      tagline: 'Edit one of your snippets',
      method: 'PATCH',
      endpoint: '/snippets/:shortId',
      keyRequired: true,
      usage: 'Change title, content, visibility, tags, or expiration.',
      params: [
        { name: 'shortId', type: 'string (path)', required: true, desc: 'Snippet short ID' },
        { name: 'title, content, …', type: 'body', required: false, desc: 'Same fields as create; only send what you change' },
        { name: 'expiresAt', type: 'number|null', required: false, desc: 'null removes expiration' }
      ],
      curl: () => `curl -X PATCH "${base}/snippets/xY9k2m" \\\n  -H "X-API-Key: ${shown()}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Updated title"}'`,
      js: () => `const res = await fetch('${base}/snippets/xY9k2m', {\n  method: 'PATCH',\n  headers: {\n    'X-API-Key': '${shown()}',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({ title: 'Updated title' })\n})\nconsole.log(await res.json())`,
      response: `{\n  "shortId": "xY9k2m",\n  "title": "Updated title",\n  "expired": false\n}`
    },
    {
      id: 'delete-snippet',
      name: 'Delete Snippet',
      tagline: 'Permanently delete one of your snippets',
      method: 'DELETE',
      endpoint: '/snippets/:shortId',
      keyRequired: true,
      usage: 'Clean up from scripts or admin tools. Only works on your own codes.',
      params: [
        { name: 'shortId', type: 'string (path)', required: true, desc: 'Snippet short ID' }
      ],
      curl: () => `curl -X DELETE "${base}/snippets/xY9k2m" \\\n  -H "X-API-Key: ${shown()}"`,
      js: () => `const res = await fetch('${base}/snippets/xY9k2m', {\n  method: 'DELETE',\n  headers: { 'X-API-Key': '${shown()}' }\n})\nconsole.log(await res.json())`,
      response: `{\n  "ok": true,\n  "shortId": "xY9k2m"\n}`
    }
  ]
}

function methodBadge(method) {
  const c = { GET: 'm-get', POST: 'm-post', PATCH: 'm-patch', DELETE: 'm-del' }[method] || ''
  return `<span class="api-method ${c}">${method}</span>`
}

function endpointCard(ep) {
  const keyBadge = ep.keyRequired
    ? `<span class="api-key-badge need">${lockMiniIconSvg()} API key</span>`
    : `<span class="api-key-badge free">${unlockMiniIconSvg()} Public</span>`
  const params = ep.params.length
    ? `<div class="api-params"><div class="api-subhead">Parameters</div>
        <table class="api-param-table"><thead><tr><th>Name</th><th>Type</th><th>Desc</th></tr></thead>
        <tbody>${ep.params.map(p => `<tr><td><code>${escapeHtml(p.name)}</code>${p.required ? ' <span class="req">*</span>' : ''}</td><td>${escapeHtml(p.type)}</td><td>${escapeHtml(p.desc)}</td></tr>`).join('')}</tbody></table></div>`
    : ''
  return `
  <div class="api-endpoint card" id="ep-${ep.id}">
    <div class="api-ep-head">
      <div class="api-ep-title-row">
        ${methodBadge(ep.method)}
        <code class="api-ep-path">${escapeHtml(ep.endpoint)}</code>
        ${keyBadge}
      </div>
      <div class="api-ep-name">${escapeHtml(ep.name)}</div>
      <div class="api-ep-tagline">${escapeHtml(ep.tagline)}</div>
    </div>
    <p class="api-ep-usage">${escapeHtml(ep.usage)}</p>
    ${params}
    <div class="api-examples">
      <div class="api-tabs">
        <button type="button" class="api-tab active" data-tab="curl">cURL</button>
        <button type="button" class="api-tab" data-tab="js">JavaScript</button>
        <button type="button" class="api-tab" data-tab="res">Response</button>
      </div>
      <div class="api-code-panel" data-panel="curl"><pre class="api-code"><code class="language-bash">${escapeHtml(ep.curl())}</code></pre><button type="button" class="api-copy" data-copy>${docCopyIconSvg()}</button></div>
      <div class="api-code-panel" data-panel="js" hidden><pre class="api-code"><code class="language-javascript">${escapeHtml(ep.js())}</code></pre><button type="button" class="api-copy" data-copy>${docCopyIconSvg()}</button></div>
      <div class="api-code-panel" data-panel="res" hidden><pre class="api-code"><code class="language-json">${escapeHtml(ep.response)}</code></pre><button type="button" class="api-copy" data-copy>${docCopyIconSvg()}</button></div>
    </div>
  </div>`
}

function renderKeyCard() {
  if (!me) {
    return `<div class="card api-key-card">
      <div class="dev-section-title">${keyIconSvg()} Your API Key</div>
      <p class="snippet-desc">Sign in to generate and manage an API key for programmatic access.</p>
      <a class="btn btn-primary" href="/auth">Sign in</a>
    </div>`
  }
  const hasKey = !!currentKey
  return `<div class="card api-key-card">
    <div class="dev-section-title">${keyIconSvg()} Your API Key</div>
    <p class="snippet-desc">Send the key in the <code>X-API-Key</code> header (or <code>?key=</code> query). Never share it publicly.</p>
    ${hasKey ? `
      <div class="api-key-row">
        <code class="api-key-value" id="apiKeyValue">${keyVisible ? escapeHtml(currentKey) : maskKey(currentKey)}</code>
        <button type="button" class="btn btn-white btn-sm" id="toggleKeyVis" title="Show/hide">${keyVisible ? eyeOffIconSvg() : eyeIconSvg()}</button>
        <button type="button" class="btn btn-white btn-sm" id="copyKeyBtn" title="Copy">${docCopyIconSvg()}</button>
      </div>
      <div class="btn-row" style="margin-top:12px">
        <button type="button" class="btn btn-white" id="regenKeyBtn">Regenerate</button>
        <button type="button" class="btn btn-danger" id="revokeKeyBtn">Revoke</button>
      </div>
    ` : `
      <button type="button" class="btn btn-primary" id="genKeyBtn">Generate API Key</button>
    `}
  </div>`
}

function wireEndpointCards(root) {
  root.querySelectorAll('.api-endpoint').forEach(card => {
    const tabs = card.querySelectorAll('.api-tab')
    const panels = card.querySelectorAll('.api-code-panel')
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.toggle('active', t === tab))
        panels.forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab })
      }
    })
    card.querySelectorAll('[data-copy]').forEach(btn => {
      btn.onclick = () => {
        const code = btn.parentElement.querySelector('code')?.textContent || ''
        navigator.clipboard?.writeText(code).then(() => toast('Copied')).catch(() => {})
      }
    })
  })
  if (window.hljs) {
    root.querySelectorAll('pre code').forEach(el => { try { hljs.highlightElement(el) } catch {} })
  }
}

async function loadKey() {
  if (!me) return
  try {
    const data = await api('/dev/api-key')
    currentKey = data.key || null
  } catch { currentKey = null }
}

async function render() {
  const app = document.getElementById('app')
  const list = buildApiList()
  const publicEps = list.filter(e => !e.keyRequired)
  const privateEps = list.filter(e => e.keyRequired)

  app.innerHTML = `
    <div class="card">
      <div class="hero-title" style="font-size:22px">API Documentation</div>
      <div class="hero-rule"></div>
      <div class="hero-sub" style="margin-bottom:0">REST API for Codery. Public endpoints need no key; authenticated endpoints use your personal API key.</div>
    </div>
    ${renderKeyCard()}
    <div class="card">
      <div class="dev-section-title">Quick index</div>
      <div class="api-index">
        ${list.map(e => `<a class="api-index-item" href="#ep-${e.id}">${methodBadge(e.method)} <span>${escapeHtml(e.name)}</span></a>`).join('')}
      </div>
    </div>
    <div class="api-section-label">Public endpoints</div>
    ${publicEps.map(endpointCard).join('')}
    <div class="api-section-label">Authenticated endpoints</div>
    ${privateEps.map(endpointCard).join('')}
  `

  wireEndpointCards(app)

  const gen = document.getElementById('genKeyBtn')
  const regen = document.getElementById('regenKeyBtn')
  const revoke = document.getElementById('revokeKeyBtn')
  const toggle = document.getElementById('toggleKeyVis')
  const copy = document.getElementById('copyKeyBtn')

  if (gen) gen.onclick = async () => {
    try {
      const data = await api('/dev/api-key', { method: 'POST' })
      currentKey = data.key
      keyVisible = true
      toast('API key created')
      render()
    } catch (e) { toast(e.message) }
  }
  if (regen) regen.onclick = async () => {
    if (!confirm('Regenerate? The old key will stop working immediately.')) return
    try {
      const data = await api('/dev/api-key', { method: 'POST' })
      currentKey = data.key
      keyVisible = true
      toast('New key generated')
      render()
    } catch (e) { toast(e.message) }
  }
  if (revoke) revoke.onclick = async () => {
    if (!confirm('Revoke this key?')) return
    try {
      await api('/dev/api-key', { method: 'DELETE' })
      currentKey = null
      toast('Key revoked')
      render()
    } catch (e) { toast(e.message) }
  }
  if (toggle) toggle.onclick = () => { keyVisible = !keyVisible; render() }
  if (copy) copy.onclick = () => {
    if (!currentKey) return
    navigator.clipboard?.writeText(currentKey).then(() => toast('Key copied')).catch(() => {})
  }
}

async function init() {
  await refreshAuth()
  await loadKey()
  await render()
}

init()
