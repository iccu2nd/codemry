
let me = null

// ============================================================
// Simple text helper — English only (easy to understand)
// ============================================================
const I18N = {
  menu: 'Menu',
  closeMenu: 'Close menu',
  feed: 'Feed',
  leaderboard: 'Leaderboard',
  notif: 'Notif',
  profile: 'Profile',
  upload: 'Upload',
  search: 'Search',
  guide: 'Guide',
  likedCodes: 'Liked codes',
  savedCodes: 'Saved codes',
  apiDocs: 'API Documentation',
  open: 'Open',
  copyLink: 'Copy link',
  linkCopied: 'Link copied',
  copyFailed: 'Could not copy link',
  passwordLocked: 'Password locked',
  lines: 'lines',
  viewsTitle: 'views',
  noBio: 'No bio yet',
  editProfile: 'Edit profile',
  signOut: 'Sign out',
  nickname: 'Nickname',
  username: 'Username',
  bio: 'Bio',
  musicUrl: 'Profile music URL',
  optional: 'optional',
  musicHint: 'Direct link to an audio file (mp3, ogg, wav). Plays softly when someone opens your profile.',
  hideBadges: 'Hide badges (including Developer tag)',
  save: 'Save',
  follow: 'Follow',
  following: 'Following',
  sharedCode: 'Shared code',
  noCodeYet: 'No code yet',
  noCodeYetSub: 'Share your first snippet with the community.',
  uploadCode: 'Upload code',
  noCodeShared: 'No code shared yet.',
  codes: 'Codes',
  views: 'Views',
  likes: 'Likes',
  followers: 'Followers',
  followingStat: 'Following',
  comments: 'Comments',
  signInToComment: 'Sign in to comment.',
  signIn: 'Sign in',
  signUp: 'Sign up',
  noAccount: 'No account yet?',
  hasAccount: 'Already have an account?',
  loginSuccess: 'Signed in!',
  registerSuccess: 'Account created!',
  noComments: 'No comments yet. Be the first!',
  relatedCode: 'Related code',
  uploadValueTitle: 'Share code in minutes',
  uploadValueSub: 'Get a public link, help other developers, and keep snippets in one place. Drafts save automatically.',
  yourCode: 'Your code',
  yourCodeSub: 'Pick a file or paste — language is detected for you',
  chooseFile: 'Choose file',
  published: 'Published!',
  music: 'Music',
  playPause: 'Play or pause music',
  backToTop: 'Back to top',
  like: 'Like',
  saveBookmark: 'Save',
  justNow: 'just now',
  minAgo: 'm ago',
  hourAgo: 'h ago',
  dayAgo: 'd ago',
  secAgo: 's ago',
  expired: 'Expired',
  expiredTitle: 'This code has expired',
  expiredSub: 'The owner set this code to expire and it is no longer available.',
  backToFeed: 'Back to feed',
  expirationLabel: 'Expiration',
  expirationHint: 'Choose when this code stops being accessible. Default is permanent.',
  expiresPermanent: 'Permanent (never expires)',
  expiresIn1h: 'Expires in 1 hour',
  expiresIn1d: 'Expires in 1 day',
  expiresIn3d: 'Expires in 3 days',
  expiresIn7d: 'Expires in 7 days',
  expiresIn30d: 'Expires in 30 days',
  expiresIn90d: 'Expires in 90 days',
  expiresIn1y: 'Expires in 1 year',
  expiresOn: 'Expires',
  expiresBadgeTitle: 'This code will expire',
  keepCurrentExpiry: 'Keep current expiration',
  removeExpiry: 'Remove expiration',
  expiredOwnerNotice: 'This code has expired — only visible to you now.',
  expiryRemoved: 'Expiration removed',
}
function t(key) {
  return I18N[key] || key
}

// ============================================================
// Efek loading global (spinner "blades") -- dipakai buat tombol yang
// lagi proses (btn-loading) dan tombol upload avatar/banner bulat.
// Markupnya emang butuh 12 elemen anak, makanya disuntik lewat JS,
// gak bisa cuma modal CSS ::after doang.
// ============================================================
function loadSpinnerHtml(cls) {
  return `<span class="load-spinner${cls ? ' ' + cls : ''}">${'<i class="load-blade"></i>'.repeat(12)}</span>`
}
function setBtnLoading(btn, loading) {
  if (!btn) return
  if (loading) {
    if (btn.dataset.loadingSaved !== '1') {
      btn.dataset.origHtml = btn.innerHTML
      btn.dataset.loadingSaved = '1'
    }
    btn.disabled = true
    btn.classList.add('btn-loading')
    btn.innerHTML = loadSpinnerHtml()
  } else {
    btn.disabled = false
    btn.classList.remove('btn-loading')
    if (btn.dataset.loadingSaved === '1') {
      btn.innerHTML = btn.dataset.origHtml
      delete btn.dataset.origHtml
      delete btn.dataset.loadingSaved
    }
  }
}
function addUploadingSpinner(btn) {
  if (!btn || btn.querySelector('.load-spinner-abs')) return
  btn.insertAdjacentHTML('beforeend', loadSpinnerHtml('load-spinner-abs'))
}
function removeUploadingSpinner(btn) {
  if (!btn) return
  const el = btn.querySelector('.load-spinner-abs')
  if (el) el.remove()
}

// ============================================================
// Tema warna aksen -- SEPENUHNYA client-side, disimpen di localStorage
// tiap HP/browser sendiri-sendiri (gak pernah dikirim ke server), jadi
// pilihan warna satu user gak kepengaruh/mempengaruhi user lain sama
// sekali. Dipanggil paling awal (sebelum apapun dirender) biar gak
// ada "kedip" warna default sebelum ganti ke warna pilihan user.
// ============================================================
const ACCENT_THEME_KEY = 'codery-accent-theme'
const ACCENT_THEMES = {
  black: { label: 'Mono', accent: '#e8e8e8', accentRgb: '232,232,232', dark: '#ffffff', darkRgb: '255,255,255', light: '#a0a0a0', bg: '#1f1f1f', bg2: '#181818', border: '#333333', bgHover: '#2a2a2a', glow: '#555555' },
  gray:  { label: 'Soft', accent: '#c8c8c8', accentRgb: '200,200,200', dark: '#f0f0f0', darkRgb: '240,240,240', light: '#888888', bg: '#1a1a1a', bg2: '#141414', border: '#2e2e2e', bgHover: '#242424', glow: '#4a4a4a' }
}
function getAccentThemeId() {
  try {
    const id = localStorage.getItem(ACCENT_THEME_KEY) || 'black'
    return ACCENT_THEMES[id] ? id : 'black'
  } catch { return 'black' }
}
function applyAccentTheme(id) {
  const t = ACCENT_THEMES[id] || ACCENT_THEMES.black
  const root = document.documentElement.style
  root.setProperty('--accent', t.accent)
  root.setProperty('--accent-rgb', t.accentRgb)
  root.setProperty('--accent-dark', t.dark)
  root.setProperty('--accent-dark-rgb', t.darkRgb)
  root.setProperty('--accent-light', t.light)
  root.setProperty('--accent-bg', t.bg)
  root.setProperty('--accent-bg-2', t.bg2)
  root.setProperty('--accent-border', t.border)
  root.setProperty('--accent-bg-hover', t.bgHover)
  root.setProperty('--accent-glow', t.glow)
}
function setAccentTheme(id) {
  if (!ACCENT_THEMES[id]) return
  try { localStorage.setItem(ACCENT_THEME_KEY, id) } catch {}
  applyAccentTheme(id)
}
// Accent swatches optional; base theme vars come from CSS :root / html.light
try {
  const saved = localStorage.getItem(ACCENT_THEME_KEY)
  if (saved && ACCENT_THEMES[saved]) applyAccentTheme(saved)
} catch {}

function paletteIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-4.8 0-8.5 3.5-8.5 8.2 0 4.2 3.2 7.8 7.5 8.1.7 0 1.3-.5 1.3-1.2 0-.3-.1-.6-.3-.9-.2-.3-.3-.6-.3-1 0-.7.6-1.3 1.3-1.3h2.8c2.6 0 4.7-2 4.7-4.6C20.5 6.2 16.8 3 12 3z"/><circle cx="8" cy="9.2" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="7.2" r="1.15" fill="currentColor" stroke="none"/><circle cx="16" cy="9.2" r="1.15" fill="currentColor" stroke="none"/><circle cx="9.5" cy="13.2" r="1.15" fill="currentColor" stroke="none"/></svg>`
}

function openThemePicker() {
  const current = getAccentThemeId()
  const swatches = Object.entries(ACCENT_THEMES).map(([id, t]) => `
    <button type="button" class="theme-swatch-btn${id === current ? ' active' : ''}" data-theme-id="${id}" style="--swatch-accent:${t.accent};--swatch-light:${t.light}">
      <span class="theme-swatch-check">${checkIconSvg()}</span>
      <span class="theme-swatch-dot"></span>
      <span class="theme-swatch-label">${t.label}</span>
    </button>`).join('')
  openModal(`
    <div class="modal-head">
      <div class="modal-head-title">Warna Tampilan</div>
      <button class="modal-close-btn" onclick="closeModal()">${closeIconSvg()}</button>
    </div>
    <div class="modal-body">
      <div class="theme-swatch-grid" id="themeSwatchGrid">${swatches}</div>
    </div>
  `)
  document.getElementById('themeSwatchGrid').querySelectorAll('.theme-swatch-btn').forEach(btn => {
    btn.onclick = () => {
      setAccentTheme(btn.dataset.themeId)
      document.querySelectorAll('#themeSwatchGrid .theme-swatch-btn').forEach(b => b.classList.toggle('active', b === btn))
    }
  })
}

async function api(path, opts = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch('/api' + path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      ...opts
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')
    return data
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Koneksi lambat, coba lagi')
    throw e
  } finally {
    clearTimeout(timeout)
  }
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
  if (s < 60) return `${s}${t('secAgo')}`
  if (s < 3600) return `${Math.floor(s / 60)}${t('minAgo')}`
  if (s < 86400) return `${Math.floor(s / 3600)}${t('hourAgo')}`
  return `${Math.floor(s / 86400)}${t('dayAgo')}`
}


function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

/** Lightweight avatar: real image if available, else colored initials (no network). Saves data. */
function avatarHtml(url, name, sizeClass = 'avatar-circle-sm', extraClass = '') {
  const safeName = escapeHtml(name || '?')
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?'
  const colors = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#6366f1']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + (name || '').charCodeAt(i)) >>> 0
  const bg = colors[hash % colors.length]
  const cls = `avatar-circle ${sizeClass} ${extraClass}`.trim()
  if (url && String(url).trim() && !String(url).includes('undefined')) {
    return `<img class="${cls}" src="${escapeHtml(url)}" alt="${safeName}" loading="lazy" decoding="async" width="34" height="34" onerror="this.outerHTML=this.dataset.fb" data-fb="<span class='${cls} avatar-initials' style='background:${bg}' aria-label='${safeName}'>${initial}</span>">`
  }
  return `<span class="${cls} avatar-initials" style="background:${bg}" aria-label="${safeName}">${initial}</span>`
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
  if (n < 1000) return String(n)
  if (n < 1000000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}rb`
  return `${(n / 1000000).toFixed(1)}jt`
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
    .map(b => `<span class="verified-icon" title="${b.label}" aria-label="${b.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${b.icon}</svg></span>`)
    .join('')
}

function devBadgeHtml(isDeveloper) {
  if (!isDeveloper) return ''
  return `<span class="dev-badge" title="Developer Codery">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
    Developer
  </span>`
}

function eyeIconSvg() {
  return `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`
}

function linkIconSvg() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93"/><path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.43a5 5 0 0 0 7.07 7.07L14 18.07"/></svg>`
}

/** Tombol kembali ke atas — muncul setelah user scroll. */
function initScrollTop() {
  if (document.getElementById('scrollTopBtn')) return
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.id = 'scrollTopBtn'
  btn.className = 'scroll-top-btn'
  btn.setAttribute('aria-label', t('backToTop'))
  btn.title = t('backToTop')
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>`
  btn.hidden = true
  document.body.appendChild(btn)
  const toggle = () => {
    btn.hidden = window.scrollY < 320
  }
  window.addEventListener('scroll', toggle, { passive: true })
  toggle()
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' })
}

function wireCopyLinkButtons(root) {
  ;(root || document).querySelectorAll('[data-role="copy-link"]').forEach(btn => {
    if (btn.dataset.wired === '1') return
    btn.dataset.wired = '1'
    btn.onclick = async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const id = btn.dataset.short
      if (!id) return
      const url = location.origin + codeUrl(id)
      try {
        await navigator.clipboard.writeText(url)
        toast(t('linkCopied'))
      } catch {
        toast(t('copyFailed'))
      }
    }
  })
}

function renderAuthArea() {
  const authArea = document.getElementById('authArea')
  if (!authArea) return
  const onProfilePage = location.pathname.startsWith('/profile')
  authArea.innerHTML = me
    ? `${onProfilePage ? '' : `<a class="link-btn link-btn-avatar" href="${profileUrl(me.username)}">
         ${avatarHtml(me.avatar, me.nickname || me.username, 'avatar-circle-xs')} ${escapeHtml(me.nickname || me.username)}${badgesHtml(me.badges)}${devBadgeHtml(me.isDeveloper)}${roleBadgeHtml(me.role)}
       </a>`}
       <button class="link-btn" id="logoutBtn">${t('signOut')}</button>`
    : `<a class="link-btn" href="/auth">${t('signIn')}</a>`
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
  // Unified Admin panel (developer + moderator in one place)
  let adminLink = document.getElementById('adminMenuLink')
  // Clean up old separate links if still in DOM
  document.getElementById('devMenuLink')?.remove()
  document.getElementById('modMenuLink')?.remove()
  const authArea = document.getElementById('authArea')

  const canAdmin = me && (me.isDeveloper || me.isModerator)
  if (!canAdmin) {
    if (adminLink) adminLink.remove()
    return
  }
  if (!adminLink) {
    adminLink = document.createElement('a')
    adminLink.id = 'adminMenuLink'
    adminLink.className = 'link-btn link-btn-dev'
    adminLink.href = '/admin'
    adminLink.innerHTML = `${devIconSvg()} Admin`
    topnav.insertBefore(adminLink, authArea)
  }
}

function devIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 6.5 21 12l-5.5 5.5"/><path d="M8.5 6.5 3 12l5.5 5.5"/><path d="M13.5 4.5 10.5 19.5"/></svg>`
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
  header.innerHTML = `<span>${t('menu')}</span>
    <button type="button" class="nav-close-btn" id="navCloseBtn" aria-label="${t('closeMenu')}">
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
  let apiDocsLink = document.getElementById('apiDocsMenuLink')

  // Liked / Saved / API docs: only on profile page
  if (!me || !onProfilePage) {
    if (likedLink) likedLink.remove()
    if (savedLink) savedLink.remove()
    if (apiDocsLink) apiDocsLink.remove()
    return
  }
  if (!likedLink) {
    likedLink = document.createElement('a')
    likedLink.id = 'likedMenuLink'
    likedLink.className = 'link-btn'
    likedLink.href = '/liked'
    likedLink.textContent = t('likedCodes')
    topnav.insertBefore(likedLink, authArea)
  }
  if (!savedLink) {
    savedLink = document.createElement('a')
    savedLink.id = 'savedMenuLink'
    savedLink.className = 'link-btn'
    savedLink.href = '/bookmarks'
    savedLink.textContent = t('savedCodes')
    topnav.insertBefore(savedLink, authArea)
  }
  if (!apiDocsLink) {
    apiDocsLink = document.createElement('a')
    apiDocsLink.id = 'apiDocsMenuLink'
    apiDocsLink.className = 'link-btn'
    apiDocsLink.href = '/api-docs'
    apiDocsLink.textContent = t('apiDocs')
    topnav.insertBefore(apiDocsLink, authArea)
  }
}

function injectStaticMenuLinks(topnav) {

  if (location.pathname !== '/') {
    document.getElementById('searchMenuLink')?.remove()
    document.getElementById('panduanMenuLink')?.remove()
    return
  }
  if (document.getElementById('searchMenuLink')) return
  const authArea = document.getElementById('authArea')

  const searchLink = document.createElement('a')
  searchLink.id = 'searchMenuLink'
  searchLink.className = 'link-btn'
  searchLink.href = '/search'
  searchLink.textContent = t('search')
  topnav.insertBefore(searchLink, authArea)

  const panduanLink = document.createElement('a')
  panduanLink.id = 'panduanMenuLink'
  panduanLink.className = 'link-btn'
  panduanLink.href = '/panduan'
  panduanLink.textContent = t('guide')
  topnav.insertBefore(panduanLink, authArea)
}

function injectDarkModeToggle() {
  // Toggle switch di sebelah kiri hamburger (bukan di dalam menu).
  // on = dark, off = light.
  if (document.getElementById('darkModeSwitch')) return

  const hamburgerBtn = document.getElementById('hamburgerBtn')
  if (!hamburgerBtn) return

  let iconsWrap = document.querySelector('.topbar-right-icons')
  if (!iconsWrap) {
    iconsWrap = document.createElement('div')
    iconsWrap.className = 'topbar-right-icons'
    hamburgerBtn.parentNode.insertBefore(iconsWrap, hamburgerBtn)
    iconsWrap.appendChild(hamburgerBtn)
  }

  // Pastikan hamburger ada di dalam wrap, dan switch di sebelah kirinya
  if (hamburgerBtn.parentNode !== iconsWrap) {
    iconsWrap.appendChild(hamburgerBtn)
  }

  const label = document.createElement('label')
  label.className = 'theme-switch'
  label.id = 'darkModeSwitch'
  label.title = 'Dark / Light mode'
  label.setAttribute('aria-label', 'Toggle dark mode')
  // Teks Light/Dark di samping track (tanpa icon matahari/bulan)
  label.innerHTML = `
    <span class="theme-switch-text theme-switch-text-light">Light</span>
    <input type="checkbox" id="darkModeCheckbox" ${isDarkMode() ? 'checked' : ''}>
    <span class="theme-switch-track"><span class="theme-switch-thumb"></span></span>
    <span class="theme-switch-text theme-switch-text-dark">Dark</span>
  `
  // Sisipkan sebelum hamburger (kiri hamburger)
  iconsWrap.insertBefore(label, hamburgerBtn)

  const checkbox = label.querySelector('#darkModeCheckbox')
  checkbox.addEventListener('change', () => {
    applyTheme(checkbox.checked)
  })
}

// Info bar di paling atas halaman -- teks & on/off-nya sekarang diatur
// developer lewat Admin > Overview > Info bar (disimpan di server, bukan lagi
// hardcode di config.js), jadi bisa diubah kapan aja tanpa perlu deploy ulang.
// Sekali di-close (tombol X), disimpan ke localStorage biar gak muncul lagi
// di kunjungan berikutnya, di halaman manapun -- sampai developer ganti
// kalimatnya (itu otomatis naikin "version" di server, jadi dismiss lama
// dianggap basi & banner nongol lagi buat semua orang).
async function initInfoBanner() {
  let settings
  try {
    settings = await api('/site-settings')
  } catch (e) { return } // gagal fetch (offline dll) -- diemin, gak usah tampilin apa-apa

  const ib = settings && settings.infoBanner
  if (!ib || !ib.enabled || !ib.text) return

  const storageKey = `infoBannerDismissed_v${ib.version}`
  try {
    if (localStorage.getItem(storageKey) === '1') return
  } catch (e) { /* localStorage gak tersedia (mode privat dll) -- tetep tampilin banner */ }

  if (document.getElementById('siteInfoBanner')) return

  const bar = document.createElement('div')
  bar.className = 'info-banner'
  bar.id = 'siteInfoBanner'
  bar.innerHTML = `
    <span class="info-banner-text">${escapeHtml(ib.text)}</span>
    <button type="button" class="info-banner-close" aria-label="Tutup pengumuman">${closeIconSvg()}</button>
  `
  document.body.insertBefore(bar, document.body.firstChild)

  bar.querySelector('.info-banner-close').addEventListener('click', () => {
    bar.classList.add('info-banner-hide')
    try { localStorage.setItem(storageKey, '1') } catch (e) { /* diemin aja kalau gagal disimpan */ }
    setTimeout(() => bar.remove(), 200)
  })
}

function initHamburger() {
  injectDarkModeToggle()

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
    if (el.id === 'logoutBtn') return
    closeMenu()
  }))
}

// Bottom Navigation Bar: dipasang otomatis di semua halaman kecuali yang punya
// atribut data-no-bottom-nav di <body> (mis. halaman login).
function initBottomNav() {
  if (document.body.hasAttribute('data-no-bottom-nav')) return
  if (document.getElementById('bottomNav')) return

  const path = location.pathname
  const isActive = (p) => (p === '/' ? path === '/' : path.startsWith(p))

  // Urutan tetap 5 item kiri->kanan: Feed, Leaderboard, Upload (FAB tengah),
  // Notifikasi, Profile. Upload sengaja jadi elemen ke-3 (persis di tengah)
  // supaya justify-content:space-around di .bottom-nav otomatis menaruhnya
  // di pusat baris, gak perlu positioning absolute manual.
  const nav = document.createElement('nav')
  nav.className = 'bottom-nav'
  nav.id = 'bottomNav'
  nav.innerHTML = `
    <a class="bnav-item ${isActive('/') ? 'active' : ''}" href="/">${houseIconSvg()}<span>${t('feed')}</span></a>
    <a class="bnav-item ${isActive('/leaderboard') ? 'active' : ''}" href="/leaderboard">${trophyIconSvg()}<span>${t('leaderboard')}</span></a>
    <a class="bnav-fab" href="/upload" aria-label="${t('upload')}"><span class="bnav-fab-circle">${plusIconSvg()}</span></a>
    <a class="bnav-item ${isActive('/notifications') ? 'active' : ''}" id="bnavNotif" href="/notifications">
      <span class="bnav-icon-wrap">${bellIconSvg()}<span class="bnav-badge" id="notifDot" style="display:none"></span></span>
      <span>${t('notif')}</span>
    </a>
    <a class="bnav-item" id="bnavProfile" href="/auth">${userIconSvg()}<span>${t('profile')}</span></a>
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
function fileIconSvg() {
  return `<svg class="sc-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3.5H7.5A2 2 0 0 0 5.5 5.5v13A2 2 0 0 0 7.5 20.5h9a2 2 0 0 0 2-2V9.5z"/><path d="M14 3.5V8a1.5 1.5 0 0 0 1.5 1.5H20"/><path d="M9 13h6M9 16.5h4"/></svg>`
}
function houseIconSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 3.5l8 7"/><path d="M6.5 9.5V19a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9.5"/><path d="M10 20v-5.5a1.5 1.5 0 0 1 1.5-1.5h1A1.5 1.5 0 0 1 14 14.5V20"/><path d="M16 4.5v2.2"/></svg>` }
function plusIconSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/></svg>` }
function userIconSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7.5" r="3.8"/><path d="M5 19.5c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5"/><path d="M12 11.2v1.2"/></svg>` }
function searchIconSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/><circle cx="10.5" cy="10.5" r="2.2" opacity=".25" fill="currentColor" stroke="none"/></svg>` }
function trophyIconSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v5a4 4 0 0 1-4 4 4 4 0 0 1-4-4V4Z"/><path d="M8 5H5.5a2 2 0 0 0 0 4H7"/><path d="M16 5h2.5a2 2 0 0 1 0 4H17"/><path d="M12 13v3.5"/><path d="M9 20h6"/><path d="M10 20c-.2-1.3.3-2.2 1-2.8.6-.5 1.4-.5 2 0 .7.6 1.2 1.5 1 2.8"/></svg>` }
function chevronLeftSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>` }
function chevronRightSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>` }
function listCheckSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7l2 2 4-4"/><path d="M12 7h8.5"/><path d="M3.5 15l2 2 4-4"/><path d="M12 15h8.5"/></svg>` }

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
  // Prefer real lineCount from API; fall back only if missing
  const lineCount = (typeof s.lineCount === 'number' && s.lineCount > 0)
    ? s.lineCount
    : Math.max(1, (s.preview || '').split('\n').length)
  const viewsLabel = formatViews(s.views)
  const lang = (s.language || 'text').toLowerCase()
  return `
  <article class="snippet-card">
    <header class="sc-head">
      <a class="sc-avatar" href="${profileUrl(s.ownerUsername)}" aria-label="@${escapeHtml(s.ownerUsername)}">
        ${avatarHtml(s.ownerAvatar, s.ownerNickname || s.ownerUsername, 'avatar-circle-sm', 'clickable')}
      </a>
      <div class="sc-who">
        <div class="sc-name">${escapeHtml(s.ownerNickname || s.ownerUsername)}${badgesHtml(s.ownerBadges)}${devBadgeHtml(s.ownerIsDeveloper)}${roleBadgeHtml(s.ownerRole)}</div>
        <div class="sc-meta">
          <span>@${escapeHtml(s.ownerUsername)}</span>
          <span class="sc-meta-dot">·</span>
          <span>${timeAgo(s.createdAt)}</span>
          <span class="sc-meta-dot">·</span>
          <span class="sc-views-inline" title="${s.views || 0} ${t('viewsTitle')}">${eyeIconSvg()}<span>${viewsLabel}</span></span>
        </div>
      </div>
      <div class="sc-badges">
        ${s.expired ? expiredBadgeHtml() : (s.expiresAt ? expiryBadgeHtml(s.expiresAt) : '')}
        ${s.isLocked ? `<span class="lock-badge" title="${t('passwordLocked')}">${lockIconSvg()}</span>` : ''}
      </div>
    </header>

    <a class="sc-body" href="${codeUrl(s.shortId)}">
      <h3 class="sc-title">${escapeHtml(s.title)}</h3>
      ${s.description ? `<p class="sc-desc">${formatWaText(truncateText(s.description, 120))}</p>` : ''}
    </a>

    ${s.tags && s.tags.length ? `<div class="sc-tags">${s.tags.map(tag => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}

    ${s.expired
      ? `<a class="sc-preview sc-preview-expired" href="${codeUrl(s.shortId)}">
           <span class="sc-lock-msg">${hourglassIconSvg()} ${t('expiredTitle')}</span>
         </a>`
      : s.isLocked
      ? `<a class="sc-preview sc-preview-locked" href="${codeUrl(s.shortId)}">
           <span class="sc-lock-msg">${lockIconSvg()} ${t('passwordLocked')}</span>
         </a>`
      : previewText ? `
    <a class="sc-preview" href="${codeUrl(s.shortId)}">
      <div class="sc-preview-bar">
        <span class="sc-filename">${fileIconSvg()}<span class="sc-filename-text">${escapeHtml(s.filename || 'code')}</span></span>
        <span class="sc-preview-meta">
          <span class="sc-lang-tag">${escapeHtml(lang)}</span>
          <span class="sc-lines">${lineCount} ${t('lines')}</span>
        </span>
      </div>
      <pre class="sc-preview-code"><code class="language-${hljsLang(s.language)}">${previewText}</code></pre>
    </a>` : ''}

    <footer class="sc-foot">
      <div class="sc-stats">
        <button type="button" class="sc-stat like-btn t-like ${s.likedByMe ? 'liked' : ''}" data-role="like" data-short="${s.shortId}" data-liked="${s.likedByMe ? 'true' : 'false'}" title="${t('like')}">
          <span class="t-like-icon">${heartIconSvg()}</span>
          <span class="t-like-particles">${likeParticlesHtml()}</span>
          <span class="like-count">${s.likes || 0}</span>
        </button>
        <button type="button" class="sc-stat bookmark-btn ${s.savedByMe ? 'saved' : ''}" data-role="bookmark" data-short="${s.shortId}" data-saved="${s.savedByMe ? 'true' : 'false'}" title="${t('saveBookmark')}">
          ${bookmarkIconSvg()}
        </button>
        <button type="button" class="sc-stat" data-role="copy-link" data-short="${s.shortId}" title="${t('copyLink')}">
          ${linkIconSvg()}
        </button>
      </div>
      <a class="sc-open btn btn-primary btn-sm" href="${codeUrl(s.shortId)}">${t('open')}</a>
    </footer>
  </article>`
}

function lockIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="11" rx="3"/><path d="M8 10.5V7.2a4 4 0 0 1 8 0v3.3"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none"/><path d="M12 16.5v1.8"/></svg>`
}

// ============================================================
// Expired code feature: preset durations shared between the upload
// wizard and the edit form, plus small helpers for rendering
// expiry badges/screens consistently everywhere a snippet shows up.
// ============================================================
const EXPIRY_PRESETS = [
  { value: '3600000', labelKey: 'expiresIn1h' },
  { value: '86400000', labelKey: 'expiresIn1d' },
  { value: '259200000', labelKey: 'expiresIn3d' },
  { value: '604800000', labelKey: 'expiresIn7d' },
  { value: '2592000000', labelKey: 'expiresIn30d' },
  { value: '7776000000', labelKey: 'expiresIn90d' },
  { value: '31536000000', labelKey: 'expiresIn1y' },
]

function hourglassIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h12"/><path d="M6 20.5h12"/><path d="M7 3.5v3.2c0 1.8 1.9 3.3 3.3 4.3.5.35.5 1.05 0 1.4C8.9 13.4 7 14.9 7 16.7v3.8"/><path d="M17 3.5v3.2c0 1.8-1.9 3.3-3.3 4.3-.5.35-.5 1.05 0 1.4 1.4 1 3.3 2.5 3.3 4.3v3.8"/></svg>`
}

// Format a future expiresAt timestamp as a short relative label, e.g.
// "Expires in 3d" / "Expires in 2h" / "Expires in 40m". Falls back to a
// plain date once it's far enough out.
function formatExpiryShort(expiresAt) {
  const ms = expiresAt - Date.now()
  if (ms <= 0) return t('expired')
  const min = Math.round(ms / 60000)
  if (min < 60) return `${t('expiresOn')} ${min}m`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${t('expiresOn')} ${hr}h`
  const day = Math.round(hr / 24)
  if (day <= 30) return `${t('expiresOn')} ${day}d`
  return `${t('expiresOn')} ${new Date(expiresAt).toLocaleDateString()}`
}

function formatExpiryFull(expiresAt) {
  try { return new Date(expiresAt).toLocaleString() } catch { return '' }
}

// Small pill shown on snippet cards / detail header when a snippet has an
// expiration set but hasn't expired yet (a quiet heads-up, not an alarm).
function expiryBadgeHtml(expiresAt) {
  if (!expiresAt) return ''
  return `<span class="expiry-badge" title="${t('expiresBadgeTitle')}: ${escapeHtml(formatExpiryFull(expiresAt))}">${hourglassIconSvg()}<span>${formatExpiryShort(expiresAt)}</span></span>`
}

function expiredBadgeHtml() {
  return `<span class="expired-badge" title="${t('expired')}">${hourglassIconSvg()}</span>`
}

// <select> markup reused by both the upload wizard (step 3) and the edit
// form on the code detail page. `mode` controls the first option:
// - 'create': first option is "Permanent" and is the default
// - 'edit': first option is "Keep current expiration" (a no-op sentinel so
//   editing a code never resets its expiry unless the user explicitly
//   picks something else)
function expirySelectHtml(id, mode, currentExpiresAt) {
  const first = mode === 'edit'
    ? `<option value="keep" selected>${currentExpiresAt ? t('keepCurrentExpiry') : t('expiresPermanent')}</option>`
    : `<option value="" selected>${t('expiresPermanent')}</option>`
  const permanentOption = mode === 'edit' ? `<option value="none">${t('removeExpiry')}</option>` : ''
  const presets = EXPIRY_PRESETS.map(p => `<option value="${p.value}">${t(p.labelKey)}</option>`).join('')
  return `<select id="${id}">${first}${permanentOption}${presets}</select>`
}


function heartIconSvg() {
  return `<svg class="t-like-heart" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M12 5.2c2.1-2.4 5.8-2.6 8.1-.4 2.3 2.2 2.4 5.9.2 8.3L12.6 20.8a.9.9 0 0 1-1.2 0L3.7 13.1c-2.2-2.4-2.1-6.1.2-8.3 2.3-2.2 6-2 8.1.4z"/></svg>`
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
        toast(saved ? 'Saved' : 'Removed from saves')
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
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="bookmark-icon"><path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v15.2l-6.2-4.1a1.4 1.4 0 0 0-1.6 0L5 20.2V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>`
}

function bellIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5a1.2 1.2 0 0 1 1.2 1.2v.4a5.8 5.8 0 0 1 4.8 5.7c0 3.8 1.2 5 1.8 5.5H4.2c.6-.5 1.8-1.7 1.8-5.5a5.8 5.8 0 0 1 4.8-5.7v-.4A1.2 1.2 0 0 1 12 3.5z"/><path d="M9.5 18.8a2.6 2.6 0 0 0 5 0"/><circle cx="12" cy="2.2" r=".8" fill="currentColor" stroke="none"/></svg>`
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
      if (labelEl) labelEl.textContent = nextLiked ? 'Liked' : 'Like'
      if (nextLiked) burstLikeParticles(btn)

      try {
        const { liked, likes } = await api(`/codes/${shortId}/like`, { method: 'POST' })
        btn.classList.toggle('liked', liked)
        btn.dataset.liked = liked ? 'true' : 'false'
        countEl.textContent = likes
        if (labelEl) labelEl.textContent = liked ? 'Liked' : 'Like'
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
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M10 20H4v-6"/><path d="M20 4l-7 7"/><path d="M4 20l7-7"/></svg>`
}

function collapseIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14H4v6"/><path d="M14 10h6V4"/><path d="M4 20l7-7"/><path d="M20 4l-7 7"/></svg>`
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
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5v17"/><path d="M5 4.5c2 0 3.2-.8 5.2-.8s3.5.8 5.5.8 2.8-.5 4.3-.5v9c-1.5 0-2.5.5-4.3.5s-3.5-.8-5.5-.8-3.2.8-5.2.8z" fill="currentColor" fill-opacity=".15"/></svg>`
}

function checkIconSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>`
}

function trashIconSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6.5 7l.8 12.2A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.3L17.5 7"/><path d="M10 11v6M14 11v6"/></svg>`
}

function closeIconSvg() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>`
}

function downloadIconSvg() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 18.5h15" stroke-width="2.4"/></svg>`
}

function stickerIconSvg() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5H6.2A2.7 2.7 0 0 0 3.5 6.2v11.6A2.7 2.7 0 0 0 6.2 20.5h8.3l6-6V6.2a2.7 2.7 0 0 0-2.7-2.7z"/><path d="M14.5 3.5v4.2a1.8 1.8 0 0 0 1.8 1.8h4.2"/><circle cx="9" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="13.5" cy="11" r="1" fill="currentColor" stroke="none"/><path d="M9.2 14.2c.9 1.1 2.7 1.1 3.6 0"/></svg>`
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
          <div class="sticker-picker-search-wrap">
            <span class="sticker-picker-search-icon">${searchIconSvg()}</span>
            <input type="text" class="sticker-picker-search" placeholder="Cari stiker/GIF..." autocomplete="off">
          </div>
          <button type="button" class="sticker-picker-close" aria-label="Tutup">${closeIconSvg()}</button>
        </div>
        <div class="sticker-picker-label" id="stickerPickerLabel">Rekomendasi</div>
        <div class="sticker-picker-grid" id="stickerPickerGrid">${skelGrid(6)}</div>
        <div class="sticker-picker-more" id="stickerPickerMore" style="display:none">${skelLine('40%', 10)}</div>
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
    // Nyimpen url yang UDAH pernah ditampilin (across semua halaman yang
    // udah dimuat buat query yang sama) -- backend (scrape Tenor/GIPHY
    // tanpa API key resmi) kadang gak punya pagination beneran & balikin
    // hasil yang tumpang-tindih/sama persis lagi pas "muat lagi" ditarik.
    // Dedupe di sisi client ini jaring pengaman terakhir biar stiker yang
    // sama gak muncul dobel di grid, apa pun yang dikirim server. Direset
    // tiap kali query ganti/reset load.
    let seenUrls = new Set()

    function cleanup() { overlay.remove() }

    function itemsHtml(items) {
      // Simpen previewUrl (versi kecil/"tinygif") sebagai URL yang dipilih,
      // BUKAN url resolusi penuh -- ini yang bakal disimpan & dirender
      // ulang di tiap komentar. Kalau pake versi full-res, banyak komentar
      // berstiker sekaligus di layar = banyak GIF gede didekode barengan,
      // jadi berat pas discroll. Versi kecil ini juga udah pas buat kotak
      // pratinjau stiker yang cuma ~150px.
      //
      // `loading="lazy"` SENGAJA DIBUANG di sini -- picker ini ada di
      // dalam overlay yang scroll-nya sendiri (bukan scroll dokumen utama),
      // dan di banyak WebView/browser Android lama deteksi "deket viewport"
      // buat native lazy-load itu gak diitung dari scroll container custom
      // kayak gini, jadinya gambar gak pernah keanggep "deket" & gak pernah
      // ke-load -> muncul kotak putih kosong padahal datanya udah nyampe.
      // Kita udah punya penjatahan sendiri lewat infinite scroll (baru
      // narik data pas beneran deket bawah), jadi tetep ringan tanpa perlu
      // native lazy-load di atasnya lagi.
      const fresh = items.filter(it => it.previewUrl && !seenUrls.has(it.previewUrl))
      fresh.forEach(it => seenUrls.add(it.previewUrl))
      return fresh.map(it => `<button type="button" class="sticker-picker-item" data-url="${escapeHtml(it.previewUrl)}"><img src="${escapeHtml(it.previewUrl)}" decoding="async" alt="stiker"></button>`).join('')
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
        if (img && !img.dataset.wired) {
          img.dataset.wired = '1'
          const check = () => {
            const w = img.naturalWidth, h = img.naturalHeight
            if (w && h) {
              const ratio = w / h
              if (ratio < 0.72 || ratio > 1.4) btn.remove()
            }
          }
          if (img.complete) check()
          else img.addEventListener('load', check, { once: true })
          // Kalau url-nya mati (hasil scrape kadang basi/keblokir), buang
          // aja kartunya daripada nyisain kotak putih kosong nganggur di
          // grid.
          img.addEventListener('error', () => btn.remove(), { once: true })
        }
      })
    }

    async function load(reset) {
      if (loading || (!reset && !nextPos)) return
      loading = true
      if (reset) {
        grid.innerHTML = skelGrid(6)
        nextPos = ''
        seenUrls = new Set()
        label.textContent = query ? `Hasil untuk "${query}"` : 'Rekomendasi'
      } else {
        moreBtn.style.display = 'block'
      }
      try {
        let html = ''
        do {
          const path = query
            ? `/tenor/search?q=${encodeURIComponent(query)}${nextPos ? `&pos=${encodeURIComponent(nextPos)}` : ''}`
            : `/tenor/featured${nextPos ? `?pos=${encodeURIComponent(nextPos)}` : ''}`
          const r = await api(path)
          html = itemsHtml(r.results)
          nextPos = r.next || ''
          // Kalau server masih ngaku ada halaman berikutnya tapi ISI
          // halaman ini ternyata abis kedeteksi dobel semua (html kosong
          // setelah difilter di seenUrls), langsung tarik halaman
          // berikutnya di loop yang sama -- biar infinite scroll gak
          // kerasa "macet" nunggu user scroll ulang buat nyoba lagi.
        } while (!html && nextPos && !reset)
        grid.innerHTML = reset ? (html || `<div class="empty-state-sm">No results.</div>`) : grid.innerHTML + html
        wireItems()
      } catch (e) {
        if (reset) grid.innerHTML = `<div class="empty-state-sm">${escapeHtml(e.message)}</div>`
        nextPos = ''
      } finally { loading = false; moreBtn.style.display = 'none' }
    }

    // Infinite scroll: begitu user nyaris nyampe bawah grid, otomatis
    // narik halaman berikutnya sendiri -- gak ada lagi tombol "Muat lagi"
    // yang perlu dipencet manual. `stickerPickerMore` sekarang cuma
    // indikator pasif "Memuat lagi..." yang nongol pas lagi ngambil data
    // di background.
    grid.addEventListener('scroll', () => {
      if (loading || !nextPos) return
      if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 400) load(false)
    })

    let searchTimer = null
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        query = searchInput.value.trim()
        load(true)
      }, 400)
    })
    overlay.querySelector('.sticker-picker-close').onclick = () => { cleanup(); resolve(null) }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { cleanup(); resolve(null) } })

    load(true)
  })
}

function highlightAllIn(selector) {
  if (!window.hljs) return
  const nodes = Array.from(document.querySelectorAll(selector))
  // Highlight in small batches so long feeds stay responsive on mobile
  let i = 0
  function step() {
    const end = Math.min(i + 4, nodes.length)
    for (; i < end; i++) {
      try { hljs.highlightElement(nodes[i]) } catch {}
    }
    if (i < nodes.length) {
      if (window.requestIdleCallback) requestIdleCallback(step, { timeout: 200 })
      else setTimeout(step, 0)
    }
  }
  step()
}

// Apply html lang attribute ASAP
try { document.documentElement.lang = 'en' } catch {}

document.addEventListener('DOMContentLoaded', initInfoBanner)
document.addEventListener('DOMContentLoaded', initHamburger)
document.addEventListener('DOMContentLoaded', initBottomNav)
document.addEventListener('DOMContentLoaded', initBackButton)
document.addEventListener('DOMContentLoaded', initScrollTop)
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal() })

// --- Micro-interactions: click sound + ripple, dipasang global di semua elemen interaktif ---
;(function initClickFx() {
  let ctx = null
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  }
  function playClickSound() {
    try {
      const c = getCtx()
      const now = c.currentTime

      // lapisan "tock" bernada rendah -> badan klik yang berisi/padat
      const body = c.createOscillator()
      const bodyGain = c.createGain()
      body.type = 'square'
      body.frequency.setValueAtTime(220, now)
      body.frequency.exponentialRampToValueAtTime(90, now + 0.035)
      bodyGain.gain.setValueAtTime(0.0001, now)
      bodyGain.gain.exponentialRampToValueAtTime(0.09, now + 0.002)
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
      body.connect(bodyGain).connect(c.destination)

      // lapisan noise pendek -> "tik" mekanikal di transient awal
      const bufferSize = Math.floor(c.sampleRate * 0.02)
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
      const noise = c.createBufferSource()
      noise.buffer = buffer
      const noiseFilter = c.createBiquadFilter()
      noiseFilter.type = 'highpass'
      noiseFilter.frequency.value = 2200
      const noiseGain = c.createGain()
      noiseGain.gain.setValueAtTime(0.08, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02)
      noise.connect(noiseFilter).connect(noiseGain).connect(c.destination)

      body.start(now); body.stop(now + 0.05)
      noise.start(now); noise.stop(now + 0.025)
    } catch {}
  }

  const FX_SELECTOR = 'button:not([data-no-fx]), .btn, a.btn, .icon-btn, .action-item, .bnav-item, .link-btn, .tag-pill, .page-btn, .badge-chip, .lb-tab-btn, .report-filter-tab, .send-icon-btn, .sticker-pick-btn, .comment-action-btn, .bnav-fab-circle'
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function spawnRipple(el, e) {
    if (reduceMotion()) return
    const rect = el.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 1.6
    const ripple = document.createElement('span')
    ripple.className = 'ui-ripple'
    const cx = (e.clientX ?? (rect.left + rect.width / 2)) - rect.left - size / 2
    const cy = (e.clientY ?? (rect.top + rect.height / 2)) - rect.top - size / 2
    ripple.style.width = ripple.style.height = size + 'px'
    ripple.style.left = cx + 'px'
    ripple.style.top = cy + 'px'
    // BUG LAMA: `.ui-ripple-host` maksa `position:relative` ke elemen yang
    // dipencet. Buat tombol yang emang udah `position:absolute` (mis. ikon
    // kamera ganti foto profil/sampul, yang ditempel presisi di pojok
    // avatar/banner pake left/right/top/bottom) itu KETIMPA jadi
    // `position:relative` gara-gara urutan CSS -- akibatnya tombolnya
    // "lompat" ke tempat lain persis pas dipencet. Elemen yang posisinya
    // udah absolute/relative/fixed/sticky itu udah otomatis jadi containing
    // block buat ripple di dalamnya, jadi gak perlu (dan gak boleh) dipaksa
    // ganti ke relative -- cukup dikasih overflow:hidden biar riaknya
    // kepotong rapi di dalam tombol.
    const computedPosition = getComputedStyle(el).position
    const hostClass = computedPosition === 'static' ? 'ui-ripple-host' : 'ui-ripple-clip'
    el.classList.add(hostClass)
    el.appendChild(ripple)
    ripple.addEventListener('animationend', () => { ripple.remove(); el.classList.remove(hostClass) })
  }

  document.addEventListener('click', (e) => {
    const target = e.target.closest(FX_SELECTOR)
    if (!target || target.disabled) return
    playClickSound()
    spawnRipple(target, e)
  }, true)

  window.playClickSound = playClickSound
})()

// --- Skeleton loading: dipakai buat gantiin teks "Memuat..." di semua halaman ---

/** Unified empty / status block */
function emptyStateHtml({ title = '', sub = '', actionHtml = '', compact = false } = {}) {
  return `<div class="empty-state${compact ? ' empty-state-compact' : ''}${actionHtml ? ' empty-cta' : ''}">
    ${title ? `<div class="empty-cta-title">${title}</div>` : ''}
    ${sub ? `<div class="empty-cta-sub">${sub}</div>` : ''}
    ${actionHtml || ''}
  </div>`
}

function skelLine(w = '100%', h = 12, extraClass = '') {
  return `<div class="skeleton skel-line ${extraClass}" style="width:${w};height:${h}px"></div>`
}
function skelAvatar(size = 36) {
  return `<div class="skeleton skel-avatar" style="width:${size}px;height:${size}px;border-radius:50%"></div>`
}
function skelBlock(h = 120, radius = 10) {
  return `<div class="skeleton skel-block" style="height:${h}px;border-radius:${radius}px"></div>`
}
function skelPill(w = '64px', h = 28) {
  return `<div class="skeleton skel-pill" style="width:${w};height:${h}px"></div>`
}

// Realistic feed card skeleton — mirrors snippet-card structure & spacing
const SKEL_FEED_VARIANTS = [
  { name: '38%', meta: '52%', title: '68%', desc: [true, '92%', '58%'], tags: 2, preview: 118, actions: true },
  { name: '44%', meta: '40%', title: '82%', desc: [false], tags: 3, preview: 132, actions: true },
  { name: '32%', meta: '48%', title: '55%', desc: [true, '78%'], tags: 1, preview: 110, actions: true },
  { name: '50%', meta: '36%', title: '74%', desc: [true, '88%', '42%'], tags: 2, preview: 124, actions: true }
]

function skelSnippetCard(variantIndex = 0) {
  const v = SKEL_FEED_VARIANTS[variantIndex % SKEL_FEED_VARIANTS.length]
  const descHtml = v.desc[0]
    ? `<div class="skel-sc-desc">${v.desc.slice(1).map((w, i) => skelLine(w, 12)).join('')}</div>`
    : ''
  const tagsHtml = v.tags
    ? `<div class="skel-sc-tags">${Array.from({ length: v.tags }, (_, i) => skelPill(i === 0 ? '52px' : i === 1 ? '64px' : '44px', 22)).join('')}</div>`
    : ''
  return `
  <article class="skel-card skel-snippet-card" aria-hidden="true">
    <header class="skel-sc-head">
      ${skelAvatar(36)}
      <div class="skel-sc-who">
        ${skelLine(v.name, 13)}
        ${skelLine(v.meta, 11)}
      </div>
    </header>
    <div class="skel-sc-body">
      ${skelLine(v.title, 17, 'skel-title')}
      ${descHtml}
    </div>
    ${tagsHtml}
    <div class="skel-sc-preview">
      <div class="skel-sc-preview-bar">
        ${skelLine('28%', 10)}
        ${skelLine('18%', 10)}
      </div>
      ${skelBlock(v.preview, 0)}
    </div>
    <footer class="skel-sc-foot">
      <div class="skel-sc-actions">
        ${skelPill('36px', 28)}
        ${skelPill('28px', 28)}
        ${skelPill('28px', 28)}
      </div>
      ${skelPill('64px', 32)}
    </footer>
  </article>`
}

function skelFeedList(n = 3) {
  return Array.from({ length: n }, (_, i) => skelSnippetCard(i)).join('')
}

function skelRow(avatarSize = 34) {
  return `<div class="skel-card skel-row-card">
    ${skelAvatar(avatarSize)}
    <div class="skel-sc-who">${skelLine('48%', 13)}${skelLine('30%', 11)}</div>
  </div>`
}
function skelRowList(n = 4, avatarSize = 34) {
  return Array.from({ length: n }, () => skelRow(avatarSize)).join('')
}

function skelProfileHeader() {
  return `<div class="skel-card skel-card-plain skel-profile">
    <div class="skel-profile-banner skeleton"></div>
    <div class="skel-sc-head skel-profile-head">
      ${skelAvatar(72)}
      <div class="skel-sc-who">${skelLine('48%', 18)}${skelLine('28%', 12)}</div>
    </div>
    <div class="skel-sc-desc" style="padding:0 16px 12px">
      ${skelLine('100%', 12)}${skelLine('72%', 12)}
    </div>
    <div class="skel-sc-tags" style="padding:0 16px 16px">
      ${skelPill('20%', 36)}${skelPill('20%', 36)}${skelPill('20%', 36)}${skelPill('20%', 36)}
    </div>
  </div>`
}

function skelCodeDetail() {
  return `<div class="skel-card skel-card-plain skel-code-detail" aria-hidden="true">
    <header class="skel-sc-head">
      ${skelAvatar(34)}
      <div class="skel-sc-who">${skelLine('36%', 13)}${skelLine('24%', 11)}</div>
    </header>
    <div class="skel-sc-body">
      ${skelLine('58%', 20, 'skel-title')}
      ${skelLine('84%', 12)}
    </div>
    <div class="skel-sc-tags">
      ${skelPill('88px', 36)}${skelPill('72px', 36)}${skelPill('72px', 36)}
    </div>
    <div class="skel-sc-preview skel-code-preview">
      <div class="skel-sc-preview-bar">${skelLine('30%', 10)}${skelLine('14%', 10)}</div>
      ${skelBlock(200, 0)}
    </div>
    <footer class="skel-sc-foot">
      <div class="skel-sc-actions">${skelPill('72px', 34)}${skelPill('34px', 34)}</div>
    </footer>
  </div>`
}

function skelCommentItem() {
  return `<div class="skel-sc-head skel-comment" style="align-items:flex-start;margin-bottom:14px">
    ${skelAvatar(30)}
    <div class="skel-sc-who" style="gap:6px">
      ${skelLine('32%', 11)}
      ${skelLine('88%', 12)}
      ${skelLine('55%', 12)}
    </div>
  </div>`
}
function skelCommentList(n = 2) {
  return Array.from({ length: n }, skelCommentItem).join('')
}

// PENTING: dulu fungsi ini bungkus kotak-kotak skeletonnya di dalam SATU div
// `display:grid` sendiri, terus div itu ditaro sebagai satu-satunya isi dari
// `#stickerPickerGrid` -- yang sendirinya JUGA udah `display:grid` 3 kolom.
// Akibatnya div pembungkus tadi cuma keitung SATU sel grid (1/3 lebar panel),
// dan mini-grid 3 kolom di DALAMNYA jadi keremas jadi kira-kira 1/9 lebar
// yang seharusnya -- itu sumber bug "stiker pas loading jadi kecil banget &
// numpuk di pojok kiri atas". Fixnya: jangan bungkus grid lagi di sini, balikin
// kotak-kotak skeletonnya polos biar masing-masing langsung jadi sel grid punya
// `#stickerPickerGrid`, sama persis kayak kartu stiker asli (lihat `itemsHtml`
// di openStickerPicker) yang juga naro elemennya langsung jadi children grid
// itu tanpa pembungkus tambahan.
function skelGrid(n = 6, ratio = '100%') {
  return Array.from({ length: n }, () =>
    `<div class="skeleton" style="width:100%;padding-top:${ratio};border-radius:14px"></div>`).join('')
}


function trackRecentView(snippet) {
  if (!snippet || !snippet.shortId) return
  try {
    let list = JSON.parse(localStorage.getItem('codery-recent-views') || '[]')
    list = list.filter(x => x.shortId !== snippet.shortId)
    list.unshift({
      shortId: snippet.shortId,
      title: snippet.title || '',
      language: snippet.language || '',
      filename: snippet.filename || '',
      at: Date.now()
    })
    localStorage.setItem('codery-recent-views', JSON.stringify(list.slice(0, 20)))
  } catch {}
}

const THEME_KEY = 'codery-theme' // 'dark' | 'light' — default dark
function isDarkMode() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light') return false
    if (v === 'dark') return true
    // migrate old key
    const old = localStorage.getItem('codery-dark-mode')
    if (old === '0') return false
    return true // default dark
  } catch { return true }
}
function applyTheme(dark) {
  document.documentElement.classList.toggle('light', !dark)
  document.documentElement.classList.remove('dark')
  try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light') } catch {}
  const cb = document.getElementById('darkModeCheckbox')
  if (cb) cb.checked = !!dark
}
function applyDarkMode(on) { applyTheme(!!on) }
function toggleDarkMode() {
  applyTheme(!isDarkMode())
}
applyTheme(isDarkMode())
