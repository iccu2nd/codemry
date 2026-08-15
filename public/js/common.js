
let me = null

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...opts
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')
  return data
}

function toast(msg) {
  const t = document.getElementById('toast')
  if (!t) return
  clearTimeout(t._hideTimer)
  clearTimeout(t._displayTimer)
  t.textContent = msg
  t.style.display = 'block'
  // reflow biar transition-nya kepicu ulang tiap kali toast dipanggil
  void t.offsetWidth
  t.classList.add('show')
  t._hideTimer = setTimeout(() => {
    t.classList.remove('show')
    t._displayTimer = setTimeout(() => { t.style.display = 'none' }, 260)
  }, 2200)
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}d lalu`
  if (s < 3600) return `${Math.floor(s / 60)}m lalu`
  if (s < 86400) return `${Math.floor(s / 3600)}j lalu`
  return `${Math.floor(s / 86400)}h lalu`
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function roleBadgeHtml(role) {
  return role ? `<span class="role-badge">${escapeHtml(role)}</span>` : ''
}

function linkifyUrls(s) {
  return s.replace(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi, (m) => {
    let trail = ''
    while (m.length && /[).,!?;:'"]$/.test(m)) { trail = m.slice(-1) + trail; m = m.slice(0, -1) }
    if (!m) return m + trail
    const href = /^https?:\/\//i.test(m) ? m : `https://${m}`
    return `<a class="desc-link" href="${href}" target="_blank" rel="noopener noreferrer">${m}</a>${trail}`
  })
}

function formatWaText(s) {
  return linkifyUrls(escapeHtml(s)).replace(/\*([^\s*](?:[^*]*[^\s*])?)\*/g, '<b>$1</b>')
}

function hljsLang(lang) {
  return lang === 'text' ? 'plaintext' : (lang || 'plaintext')
}

function qs(name) {
  return new URLSearchParams(location.search).get(name)
}

// Textarea deskripsi: tinggi otomatis nyesuaiin panjang teks (dipakai buat field
// deskripsi upload/edit, BUKAN buat textarea kode yang ukurannya harus tetap/fixed).
function autoGrowTextarea(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}
function wireAutoGrowTextarea(el) {
  if (!el) return
  autoGrowTextarea(el)
  el.addEventListener('input', () => autoGrowTextarea(el))
}

// Input nama file: otomatis ubah karakter spasi jadi underscore biar aman dipakai sebagai filename.
function wireFilenameSpaces(el) {
  if (!el) return
  const sanitize = () => {
    const pos = el.selectionStart
    const clean = el.value.replace(/\s/g, '_')
    if (clean !== el.value) {
      el.value = clean
      if (pos !== null) el.selectionStart = el.selectionEnd = pos
    }
  }
  el.addEventListener('input', sanitize)
  sanitize()
}

function profileUrl(username) { return `/profile?u=${encodeURIComponent(username)}` }
function codeUrl(shortId) { return `/code?id=${encodeURIComponent(shortId)}` }
function followUrl(username, type) { return `/follow?u=${encodeURIComponent(username)}&type=${type}` }

function formatViews(n) {
  n = n || 0
  if (n < 1000) return `${n} views`
  if (n < 1000000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}K views`
  return `${(n / 1000000).toFixed(1)}M views`
}

async function refreshAuth() {
  try { me = await api('/auth/me') } catch { me = null }
  renderAuthArea()
  return me
}

const BADGE_CATALOG = [
  {
    id: 'verified', label: 'Verified', color: '#20D5EC',
    icon: `<circle cx="12" cy="12" r="11" fill="#20D5EC"/><path d="M7.5 12.3l2.8 2.8 6.3-6.4" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
  },
  {
    id: 'staff', label: 'Staff', color: '#8b5cf6',
    icon: `<circle cx="12" cy="12" r="11" fill="#8b5cf6"/><path d="M12 5.5l5 2v3.6c0 3.3-2.1 5.9-5 6.9-2.9-1-5-3.6-5-6.9V7.5l5-2z" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
  },
  {
    id: 'contributor', label: 'Contributor', color: '#f97316',
    icon: `<circle cx="12" cy="12" r="11" fill="#f97316"/><path d="M9.5 8.5l-3 3.5 3 3.5M14.5 8.5l3 3.5-3 3.5" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`
  },
  {
    id: 'supporter', label: 'Supporter', color: '#ec4899',
    icon: `<circle cx="12" cy="12" r="11" fill="#ec4899"/><path d="M12 16.8s-4.2-2.6-5.6-5.2C5.6 9.6 6.5 7.5 8.5 7.5c1.1 0 2 .6 2.6 1.5.6-.9 1.5-1.5 2.6-1.5 2 0 2.9 2.1 2.1 4.1-1.4 2.6-5.6 5.2-5.6 5.2z" fill="white"/>`
  }
]
const BADGE_BY_ID = Object.fromEntries(BADGE_CATALOG.map(b => [b.id, b]))

function verifiedBadgeSvg() {
  const b = BADGE_BY_ID.verified
  return `<span class="verified-icon" title="${b.label}"><svg viewBox="0 0 24 24">${b.icon}</svg></span>`
}

function badgesHtml(badges) {
  if (!badges || !badges.length) return ''
  return BADGE_CATALOG
    .filter(b => badges.includes(b.id))
    .map(b => `<span class="verified-icon" title="${b.label}"><svg viewBox="0 0 24 24">${b.icon}</svg></span>`)
    .join('')
}

function devBadgeHtml(isDeveloper) {
  if (!isDeveloper) return ''
  return `<span class="dev-badge" title="Developer Codery">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
    Developer
  </span>`
}

function renderAuthArea() {
  const authArea = document.getElementById('authArea')
  if (!authArea) return
  const onProfilePage = location.pathname.startsWith('/profile')
  authArea.innerHTML = me
    ? `${onProfilePage ? '' : `<a class="link-btn link-btn-avatar" href="${profileUrl(me.username)}">
         <img class="avatar-circle avatar-circle-xs" src="${me.avatar}"> ${escapeHtml(me.nickname || me.username)}${badgesHtml(me.badges)}${devBadgeHtml(me.isDeveloper)}${roleBadgeHtml(me.role)}
       </a>`}
       <button class="link-btn" id="logoutBtn">Keluar</button>`
    : `<a class="link-btn" href="/auth">Masuk</a>`
  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => {})
      me = null
      window.location.href = '/'
    }
  }
  injectDevMenuLink()
  injectAccountLinks()
  updateBottomNavProfile()
  refreshNotifBadge()
}

function injectDevMenuLink() {
  const topnav = document.getElementById('topnav')
  if (!topnav) return
  let devLink = document.getElementById('devMenuLink')
  let modLink = document.getElementById('modMenuLink')
  const authArea = document.getElementById('authArea')

  // "Developer" cuma buat akun developer asli. "Moderasi" dicek terpisah lewat
  // me.isModerator (developer otomatis termasuk, tapi role 'moderator'/'admin'
  // juga dapet akses tanpa harus jadi developer).
  if (!me || !me.isDeveloper) {
    if (devLink) devLink.remove()
  } else if (!devLink) {
    devLink = document.createElement('a')
    devLink.id = 'devMenuLink'
    devLink.className = 'link-btn link-btn-dev'
    devLink.href = '/devpanel'
    devLink.innerHTML = `${devIconSvg()} Developer`
    topnav.insertBefore(devLink, authArea)
  }

  if (!me || !me.isModerator) {
    if (modLink) modLink.remove()
  } else if (!modLink) {
    modLink = document.createElement('a')
    modLink.id = 'modMenuLink'
    modLink.className = 'link-btn link-btn-dev'
    modLink.href = '/moderasi'
    modLink.innerHTML = `${flagIconSvg()} Moderasi`
    topnav.insertBefore(modLink, authArea)
  }
}

function devIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`
}

function closeHamburgerMenu() {
  document.getElementById('hamburgerBtn')?.classList.remove('open')
  document.getElementById('topnav')?.classList.remove('open')
  document.getElementById('navBackdrop')?.classList.remove('open')
}

function injectMenuHeader(topnav, closeMenu) {
  if (document.getElementById('navMenuHeader')) return
  const header = document.createElement('div')
  header.id = 'navMenuHeader'
  header.className = 'nav-header'
  header.innerHTML = `<span>Menu</span>
    <button type="button" class="nav-close-btn" id="navCloseBtn" aria-label="Tutup menu">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`
  topnav.insertBefore(header, topnav.firstChild)
  document.getElementById('navCloseBtn').addEventListener('click', closeMenu)
}

function injectAccountLinks() {
  const topnav = document.getElementById('topnav')
  const authArea = document.getElementById('authArea')
  if (!topnav || !authArea) return
  const onProfilePage = location.pathname.startsWith('/profile')
  let likedLink = document.getElementById('likedMenuLink')
  let savedLink = document.getElementById('savedMenuLink')
  let scrapeLink = document.getElementById('scrapeMenuLink')
  if (!me || !onProfilePage) {
    if (likedLink) likedLink.remove()
    if (savedLink) savedLink.remove()
    if (scrapeLink) scrapeLink.remove()
    return
  }
  if (!likedLink) {
    likedLink = document.createElement('a')
    likedLink.id = 'likedMenuLink'
    likedLink.className = 'link-btn'
    likedLink.href = '/liked'
    likedLink.textContent = 'Kode Disukai'
    topnav.insertBefore(likedLink, authArea)
  }
  if (!savedLink) {
    savedLink = document.createElement('a')
    savedLink.id = 'savedMenuLink'
    savedLink.className = 'link-btn'
    savedLink.href = '/bookmarks'
    savedLink.textContent = 'Kode Tersimpan'
    topnav.insertBefore(savedLink, authArea)
  }
  if (!scrapeLink) {
    scrapeLink = document.createElement('a')
    scrapeLink.id = 'scrapeMenuLink'
    scrapeLink.className = 'link-btn'
    scrapeLink.href = '/scrape-requests'
    scrapeLink.textContent = 'List Scraping'
    topnav.insertBefore(scrapeLink, authArea)
  }
}

function injectStaticMenuLinks(topnav) {
  if (location.pathname !== '/') {
    document.getElementById('leaderboardMenuLink')?.remove()
    document.getElementById('requestScrapeMenuLink')?.remove()
    document.getElementById('panduanMenuLink')?.remove()
    return
  }
  if (document.getElementById('leaderboardMenuLink')) return
  const authArea = document.getElementById('authArea')

  const leaderboardLink = document.createElement('a')
  leaderboardLink.id = 'leaderboardMenuLink'
  leaderboardLink.className = 'link-btn'
  leaderboardLink.href = '/leaderboard'
  leaderboardLink.textContent = 'Leaderboard'
  topnav.insertBefore(leaderboardLink, authArea)

  const requestScrapeLink = document.createElement('a')
  requestScrapeLink.id = 'requestScrapeMenuLink'
  requestScrapeLink.className = 'link-btn'
  requestScrapeLink.href = '/request-scrape'
  requestScrapeLink.textContent = 'Request Scrape'
  topnav.insertBefore(requestScrapeLink, authArea)

  const panduanLink = document.createElement('a')
  panduanLink.id = 'panduanMenuLink'
  panduanLink.className = 'link-btn'
  panduanLink.href = '/panduan'
  panduanLink.textContent = 'Panduan'
  topnav.insertBefore(panduanLink, authArea)
}

function initHamburger() {
  const hamburgerBtn = document.getElementById('hamburgerBtn')
  const topnav = document.getElementById('topnav')
  const navBackdrop = document.getElementById('navBackdrop')
  if (!hamburgerBtn || !topnav || !navBackdrop) return

  function closeMenu() {
    hamburgerBtn.classList.remove('open')
    topnav.classList.remove('open')
    navBackdrop.classList.remove('open')
  }
  function toggleMenu() {
    hamburgerBtn.classList.toggle('open')
    topnav.classList.toggle('open')
    navBackdrop.classList.toggle('open')
  }

  injectMenuHeader(topnav, closeMenu)
  injectStaticMenuLinks(topnav)
  hamburgerBtn.addEventListener('click', toggleMenu)
  navBackdrop.addEventListener('click', closeMenu)
  topnav.querySelectorAll('a, button').forEach(el => el.addEventListener('click', () => {
    if (el.id !== 'logoutBtn') closeMenu()
  }))
}

// Bottom Navigation Bar: dipasang otomatis di semua halaman kecuali yang punya
// atribut data-no-bottom-nav di <body> (mis. halaman login).
function initBottomNav() {
  if (document.body.hasAttribute('data-no-bottom-nav')) return
  if (document.getElementById('bottomNav')) return

  const path = location.pathname
  const isActive = (p) => (p === '/' ? path === '/' : path.startsWith(p))

  // Urutan tetap 5 item kiri->kanan: Feed, Search, Upload (FAB tengah),
  // Notifikasi, Profile. Upload sengaja jadi elemen ke-3 (persis di tengah)
  // supaya justify-content:space-around di .bottom-nav otomatis menaruhnya
  // di pusat baris, gak perlu positioning absolute manual.
  const nav = document.createElement('nav')
  nav.className = 'bottom-nav'
  nav.id = 'bottomNav'
  nav.innerHTML = `
    <a class="bnav-item ${isActive('/') ? 'active' : ''}" href="/">${houseIconSvg()}<span>Feed</span></a>
    <a class="bnav-item ${isActive('/search') ? 'active' : ''}" href="/search">${searchIconSvg()}<span>Search</span></a>
    <a class="bnav-fab" href="/upload" aria-label="Upload"><span class="bnav-fab-circle">${plusIconSvg()}</span></a>
    <a class="bnav-item ${isActive('/notifications') ? 'active' : ''}" id="bnavNotif" href="/notifications">
      <span class="bnav-icon-wrap">${bellIconSvg()}<span class="bnav-badge" id="notifDot" style="display:none"></span></span>
      <span>Notif</span>
    </a>
    <a class="bnav-item" id="bnavProfile" href="/auth">${userIconSvg()}<span>Profile</span></a>
  `
  document.body.appendChild(nav)

  // Ruang buat nav udah dicadangkan dari CSS (lewat atribut data-no-bottom-nav),
  // jadi di sini kita cuma butuh fade+slide-in halus, gak ada lagi jump konten.
  requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.add('bnav-visible')))

  updateBottomNavProfile()
  refreshNotifBadge()
}

// Tombol back generik: dipasang di halaman yang punya <button id="backBtn">
// (mis. halaman view code). Balik ke history kalau ada asal-usul yang jelas,
// kalau enggak (buka tab baru / link langsung) jatuh ke beranda biar gak nyasar.
function initBackButton() {
  const btn = document.getElementById('backBtn')
  if (!btn) return
  btn.addEventListener('click', () => {
    if (history.length > 1 && document.referrer && new URL(document.referrer).origin === location.origin) {
      history.back()
    } else {
      location.href = '/'
    }
  })
}

// Dipanggil ulang tiap status login berubah (dari renderAuthArea) biar tab
// Profil di bottom nav nunjuk ke profil yang bener & kepilih aktif kalo perlu.
function updateBottomNavProfile() {
  const link = document.getElementById('bnavProfile')
  if (!link) return
  const path = location.pathname
  if (me) {
    link.href = profileUrl(me.username)
    link.classList.toggle('active', path === '/profile' && qs('u') === me.username)
  } else {
    link.href = '/auth'
    link.classList.toggle('active', path === '/auth')
  }
}

// Badge inline SVG per bahasa (ganti Font Awesome biar gak nge-load font/CSS gede tiap halaman).
const LANG_ICON = {
  javascript: { label: 'JS', color: '#f0db4f', text: '#1a1a1a' },
  typescript: { label: 'TS', color: '#3178c6' },
  python: { label: 'PY', color: '#3776ab' },
  html: { label: '5', color: '#e34c26' },
  css: { label: '3', color: '#264de4' },
  json: { label: '{ }', color: '#6b7280' },
  java: { label: 'J', color: '#f89820' },
  php: { label: 'PHP', color: '#777bb4' },
  bash: { label: '>_', color: '#16a34a' },
  markdown: { label: 'M↓', color: '#374151' },
  text: { label: 'TXT', color: '#6b7280' }
}
function langBadgeSvg(label, bg, fg) { return `<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${bg}"/><text x="12" y="15.5" font-family="'JetBrains Mono',monospace" font-size="${label.length > 2 ? 7.5 : 10}" font-weight="700" fill="${fg}" text-anchor="middle">${escapeHtml(label)}</text></svg>` }
function langIconHtml(lang) {
  const key = (lang || '').toLowerCase()
  const conf = LANG_ICON[key] || LANG_ICON.text
  return `<span class="lang-icon" title="${escapeHtml(lang || '')}" aria-label="${escapeHtml(lang || '')}">${langBadgeSvg(conf.label, conf.color, conf.text || '#fff')}</span>`
}
function houseIconSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>` }
function plusIconSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>` }
function userIconSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>` }
function searchIconSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>` }
function chevronLeftSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>` }
function chevronRightSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>` }
function listCheckSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 7 5 9 9 5"/><line x1="12" y1="7" x2="21" y2="7"/><polyline points="3 15 5 17 9 13"/><line x1="12" y1="15" x2="21" y2="15"/></svg>` }

function truncateText(s, maxLen) {
  if (!s || s.length <= maxLen) return s
  const cut = s.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…'
}

function snippetCard(s) {
  const rawLines = (s.preview || '').split('\n')
  let previewStart = 0
  while (previewStart < rawLines.length && rawLines[previewStart].trim() === '') previewStart++
  const trimmedPreview = rawLines.slice(previewStart).join('\n')
  const previewText = trimmedPreview ? escapeHtml(trimmedPreview) : ''
  return `
  <div class="snippet-card">
    <div class="snippet-head">
      <div class="snippet-head-info">
        <a href="${profileUrl(s.ownerUsername)}" aria-label="Lihat profil @${escapeHtml(s.ownerUsername)}">
          <img class="avatar-circle avatar-circle-sm clickable" src="${s.ownerAvatar || ''}" onerror="this.style.visibility='hidden'" loading="lazy" decoding="async">
        </a>
        <div>
          <div class="snippet-uploader">${escapeHtml(s.ownerNickname || s.ownerUsername)}${badgesHtml(s.ownerBadges)}${devBadgeHtml(s.ownerIsDeveloper)}${roleBadgeHtml(s.ownerRole)}</div>
          <div class="snippet-meta"><a class="user-link" href="${profileUrl(s.ownerUsername)}">@${escapeHtml(s.ownerUsername)}</a> · ${timeAgo(s.createdAt)} · ${formatViews(s.views)}</div>
        </div>
      </div>
      <div class="snippet-head-right">
        ${langIconHtml(s.language)}
        ${s.isLocked ? `<span class="lock-badge" title="Dikunci PIN">${lockIconSvg()}</span>` : ''}
      </div>
    </div>
    <div class="snippet-title">${escapeHtml(s.title)}</div>
    ${s.description ? `<div class="snippet-desc">${formatWaText(truncateText(s.description, 150))}</div>` : ''}
    ${s.tags && s.tags.length ? `<div class="tag-row">${s.tags.map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    ${s.isLocked
      ? `<a class="code-preview-wrap code-preview-locked" href="${codeUrl(s.shortId)}">
           <div class="lock-preview-body">${lockIconSvg()} <span>Kode ini dikunci PIN</span></div>
         </a>`
      : previewText ? `
    <a class="code-preview-wrap" href="${codeUrl(s.shortId)}">
      <div class="code-window-bar"><span class="dot red"></span><span class="dot yellow"></span><span class="dot green"></span><span class="code-window-filename">${escapeHtml(s.filename || '')}</span></div>
      <div class="code-preview-body">
        <pre class="code-preview"><code class="language-${hljsLang(s.language)}">${previewText}</code></pre>
        <div class="code-preview-fade"></div>
      </div>
      <div class="code-preview-footer">${expandIconSvg()} Lihat kode lengkap</div>
    </a>` : ''}
    <div class="snippet-actions">
      <a class="btn btn-primary btn-sm" href="${codeUrl(s.shortId)}">View</a>
      <a class="btn btn-white btn-sm" href="/raw/${s.shortId}" target="_blank" rel="noopener">Raw</a>
      <a class="btn btn-white btn-sm" href="${profileUrl(s.ownerUsername)}">Profil</a>
      <button type="button" class="like-btn t-like ${s.likedByMe ? 'liked' : ''}" data-role="like" data-short="${s.shortId}" data-liked="${s.likedByMe ? 'true' : 'false'}" title="Suka">
        <span class="t-like-icon">${heartIconSvg()}</span>
        <span class="t-like-particles">${likeParticlesHtml()}</span>
        <span class="like-count">${s.likes || 0}</span>
      </button>
      <button type="button" class="bookmark-btn ${s.savedByMe ? 'saved' : ''}" data-role="bookmark" data-short="${s.shortId}" data-saved="${s.savedByMe ? 'true' : 'false'}" title="Simpan">
        ${bookmarkIconSvg()}
      </button>
    </div>
  </div>`
}

function lockIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
}

function heartIconSvg() {
  return `<svg class="t-like-heart" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12.001 4.529c2.349-2.532 6.155-2.532 8.504 0 2.35 2.532 2.35 6.638 0 9.17l-8.201 8.3a.42.42 0 0 1-.606 0l-8.201-8.3c-2.35-2.532-2.35-6.638 0-9.17 2.349-2.532 6.155-2.532 8.504 0z"/></svg>`
}

function likeParticlesHtml() {
  return '<i></i>'.repeat(8)
}

function burstLikeParticles(btn) {
  const dots = btn.querySelectorAll('.t-like-particles i')
  const n = dots.length || 8
  dots.forEach((el, i) => {
    const angle = (360 / n) * i + (Math.random() * 24 - 12)
    const rad = angle * Math.PI / 180
    const dist = 16 + Math.random() * 14
    el.style.setProperty('--px', `${(Math.cos(rad) * dist).toFixed(1)}px`)
    el.style.setProperty('--py', `${(Math.sin(rad) * dist).toFixed(1)}px`)
    el.style.setProperty('--pdur', `${(500 + Math.random() * 220).toFixed(0)}ms`)
    el.style.setProperty('--pdelay', `${(Math.random() * 60).toFixed(0)}ms`)
    el.style.setProperty('--p-end-scale', (0.4 + Math.random() * 0.4).toFixed(2))
    el.style.setProperty('--psize', (0.8 + Math.random() * 0.9).toFixed(2))
  })
  btn.classList.remove('is-bursting')
  void btn.offsetWidth
  btn.classList.add('is-bursting')
  clearTimeout(btn._burstTimer)
  btn._burstTimer = setTimeout(() => btn.classList.remove('is-bursting'), 900)
}

function wireBookmarkButtons(root, opts = {}) {
  ;(root || document).querySelectorAll('[data-role="bookmark"]').forEach(btn => {
    if (btn.dataset.wired) return
    btn.dataset.wired = '1'
    btn.onclick = async (e) => {
      e.preventDefault()
      if (!me) { window.location.href = '/auth'; return }
      if (btn.dataset.busy) return
      btn.dataset.busy = '1'
      const shortId = btn.dataset.short
      const wasSaved = btn.classList.contains('saved')
      const nextSaved = !wasSaved
      btn.classList.toggle('saved', nextSaved)
      btn.dataset.saved = nextSaved ? 'true' : 'false'
      try {
        const { saved } = await api(`/codes/${shortId}/bookmark`, { method: 'POST' })
        btn.classList.toggle('saved', saved)
        btn.dataset.saved = saved ? 'true' : 'false'
        toast(saved ? 'Kode disimpan' : 'Kode dihapus dari simpanan')
        if (!saved && opts.removeOnUnsave) {
          const card = btn.closest('.snippet-card')
          if (card) { card.style.transition = 'opacity .2s ease'; card.style.opacity = '0'; setTimeout(() => card.remove(), 200) }
        }
      } catch (err) {
        btn.classList.toggle('saved', wasSaved)
        btn.dataset.saved = wasSaved ? 'true' : 'false'
        toast(err.message)
      } finally {
        delete btn.dataset.busy
      }
    }
  })
}

function bookmarkIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bookmark-icon"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
}

function bellIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`
}

// Badge notifikasi: nempel di tombol "Notif" pada bottom nav (kayak TikTok),
// jadi angka belum-dibaca kebaca dari mana aja tanpa perlu buka halamannya dulu.
async function refreshNotifBadge() {
  const dot = document.getElementById('notifDot')
  if (!dot) return
  if (!me) { dot.style.display = 'none'; return }
  try {
    const { count } = await api('/notifications/unread-count')
    dot.style.display = count > 0 ? 'flex' : 'none'
    dot.textContent = count > 9 ? '9+' : (count > 0 ? String(count) : '')
  } catch { dot.style.display = 'none' }
}

function wireLikeButtons(root) {
  ;(root || document).querySelectorAll('[data-role="like"]').forEach(btn => {
    if (btn.dataset.wired) return
    btn.dataset.wired = '1'
    btn.onclick = async (e) => {
      e.preventDefault()
      if (!me) { window.location.href = '/auth'; return }
      if (btn.dataset.busy) return
      btn.dataset.busy = '1'
      const shortId = btn.dataset.short
      const countEl = btn.querySelector('.like-count')
      const labelEl = btn.querySelector('#likeLabel')
      const wasLiked = btn.classList.contains('liked')
      const prevCount = parseInt(countEl.textContent, 10) || 0

      const nextLiked = !wasLiked
      btn.classList.toggle('liked', nextLiked)
      btn.dataset.liked = nextLiked ? 'true' : 'false'
      countEl.textContent = prevCount + (nextLiked ? 1 : -1)
      if (labelEl) labelEl.textContent = nextLiked ? 'Disuka' : 'Suka'
      if (nextLiked) burstLikeParticles(btn)

      try {
        const { liked, likes } = await api(`/codes/${shortId}/like`, { method: 'POST' })
        btn.classList.toggle('liked', liked)
        btn.dataset.liked = liked ? 'true' : 'false'
        countEl.textContent = likes
        if (labelEl) labelEl.textContent = liked ? 'Disuka' : 'Suka'
      } catch (err) {
        btn.classList.toggle('liked', wasLiked)
        btn.dataset.liked = wasLiked ? 'true' : 'false'
        countEl.textContent = prevCount
        if (labelEl) labelEl.textContent = wasLiked ? 'Disuka' : 'Suka'
        toast(err.message)
      } finally {
        delete btn.dataset.busy
      }
    }
  })
}

function expandIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`
}

function collapseIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`
}

function ensureModalOverlay() {
  let overlay = document.getElementById('modalOverlay')
  if (overlay) return overlay
  overlay = document.createElement('div')
  overlay.id = 'modalOverlay'
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `<div class="modal-box" id="modalBox" onclick="event.stopPropagation()"></div>`
  overlay.onclick = closeModal
  document.body.appendChild(overlay)
  return overlay
}

function openModal(innerHtml) {
  const overlay = ensureModalOverlay()
  document.getElementById('modalBox').innerHTML = innerHtml
  overlay.style.display = 'flex'
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')))
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay')
  if (!overlay) return
  overlay.classList.remove('open')
  setTimeout(() => { overlay.style.display = 'none' }, 180)
}

function flagIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="3"/></svg>`
}

function checkIconSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
}

function trashIconSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
}

function closeIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
}

function stickerIconSvg() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h9l6-6V6a3 3 0 0 0-3-3Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/></svg>`
}

// Picker stiker/GIF via Tenor -- dipakai di komposer komentar (dan bisa
// dipakai ulang di komposer lain nanti). Resolve dengan URL stiker yang
// dipilih, atau null kalau ditutup tanpa milih. Pencarian & "trending" awal
// sama-sama lewat proxy backend /tenor/* (API key Tenor gak pernah nyampe
// ke browser).
// Gak ada tab pintasan (Sedang tren/Meme/emoji) lagi -- cuma kotak
// pencarian. Pas kebuka pertama kali tetap nampilin rekomendasi awal lewat
// /tenor/featured (biar gak kosong melompong), tapi satu-satunya cara buat
// ganti hasil adalah ngetik di kotak cari.
function openStickerPicker() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'sticker-picker-overlay'
    overlay.innerHTML = `
      <div class="sticker-picker-panel">
        <div class="sticker-picker-topbar">
          <input type="text" class="sticker-picker-search" placeholder="Cari stiker/GIF..." autocomplete="off">
          <button type="button" class="sticker-picker-close" aria-label="Tutup">${closeIconSvg()}</button>
        </div>
        <div class="sticker-picker-label" id="stickerPickerLabel">Rekomendasi</div>
        <div class="sticker-picker-grid" id="stickerPickerGrid"><div class="empty-state-sm">Memuat...</div></div>
        <button type="button" class="sticker-picker-more" id="stickerPickerMore" style="display:none">Muat lagi</button>
      </div>
    `
    document.body.appendChild(overlay)
    const grid = overlay.querySelector('#stickerPickerGrid')
    const moreBtn = overlay.querySelector('#stickerPickerMore')
    const searchInput = overlay.querySelector('.sticker-picker-search')
    const label = overlay.querySelector('#stickerPickerLabel')

    let query = ''
    let nextPos = ''
    let loading = false

    function cleanup() { overlay.remove() }

    function itemsHtml(items) {
      // Simpen previewUrl (versi kecil/"tinygif") sebagai URL yang dipilih,
      // BUKAN url resolusi penuh -- ini yang bakal disimpan & dirender
      // ulang di tiap komentar. Kalau pake versi full-res, banyak komentar
      // berstiker sekaligus di layar = banyak GIF gede didekode barengan,
      // jadi berat pas discroll. Versi kecil ini juga udah pas buat kotak
      // pratinjau stiker yang cuma ~150px.
      return items.map(it => `<button type="button" class="sticker-picker-item" data-url="${escapeHtml(it.previewUrl)}"><img src="${escapeHtml(it.previewUrl)}" loading="lazy" decoding="async" alt="stiker"></button>`).join('')
    }
    function wireItems() {
      grid.querySelectorAll('.sticker-picker-item').forEach(btn => {
        btn.onclick = () => { const url = btn.dataset.url; cleanup(); resolve(url) }
        // Cadangan buat sumber yang gak ngasih info dimensi dari server
        // (hasil scrape polos regex, gak lewat JSON __NEXT_DATA__): begitu
        // gambar aslinya kebaca ukurannya, buang dari grid kalau bentuknya
        // kelewat lonjong (16:9/9:16) -- biar konsisten sama yang udah
        // difilter di server, tanpa nunggu render duluan baru ilang.
        const img = btn.querySelector('img')
        if (img && !img.dataset.aspectChecked) {
          img.dataset.aspectChecked = '1'
          const check = () => {
            const w = img.naturalWidth, h = img.naturalHeight
            if (w && h) {
              const ratio = w / h
              if (ratio < 0.72 || ratio > 1.4) btn.remove()
            }
          }
          if (img.complete) check()
          else img.addEventListener('load', check, { once: true })
        }
      })
    }

    async function load(reset) {
      if (loading) return
      loading = true
      if (reset) { grid.innerHTML = `<div class="empty-state-sm">Memuat...</div>`; nextPos = ''; label.textContent = query ? `Hasil untuk "${query}"` : 'Rekomendasi' }
      try {
        const path = query
          ? `/tenor/search?q=${encodeURIComponent(query)}${nextPos ? `&pos=${encodeURIComponent(nextPos)}` : ''}`
          : `/tenor/featured${nextPos ? `?pos=${encodeURIComponent(nextPos)}` : ''}`
        const r = await api(path)
        nextPos = r.next || ''
        grid.innerHTML = reset ? itemsHtml(r.results) : grid.innerHTML + itemsHtml(r.results)
        if (!r.results.length && reset) grid.innerHTML = `<div class="empty-state-sm">Gak ada hasil.</div>`
        wireItems()
        moreBtn.style.display = nextPos ? 'block' : 'none'
      } catch (e) {
        if (reset) grid.innerHTML = `<div class="empty-state-sm">${escapeHtml(e.message)}</div>`
        moreBtn.style.display = 'none'
      } finally { loading = false }
    }

    let searchTimer = null
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        query = searchInput.value.trim()
        load(true)
      }, 400)
    })
    moreBtn.onclick = () => load(false)
    overlay.querySelector('.sticker-picker-close').onclick = () => { cleanup(); resolve(null) }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { cleanup(); resolve(null) } })

    load(true)
  })
}

function highlightAllIn(selector) {
  if (!window.hljs) return
  document.querySelectorAll(selector).forEach(el => hljs.highlightElement(el))
}

document.addEventListener('DOMContentLoaded', initHamburger)
document.addEventListener('DOMContentLoaded', initBottomNav)
document.addEventListener('DOMContentLoaded', initBackButton)
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal() })
