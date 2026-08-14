import path from 'path'
import { fileURLToPath } from 'url'
import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas'
import axios from 'axios'
import { getAssetContent } from './github.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Font buat canvas OG image HARUS diambil dari file yang beneran ada di
// disk (public/fonts/*.woff, yang juga dipakai browser lewat @font-face).
// Sebelumnya nunjuk ke assets/fonts/*.ttf yang gak pernah ada di project
// ini -- akibatnya registerFromPath gagal diam-diam (gak throw), Skia
// jatuh ke font bawaan yang gak bisa render nama family ini, dan hasilnya
// gambar OG jadi cuma banner/avatar doang tanpa teks sama sekali.
const FONT_DIR = path.join(__dirname, '..', 'public', 'fonts')

let fontsReady = false
function ensureFonts() {
    if (fontsReady) return
    const fonts = [
        ['Poppins-Regular.woff', 'Poppins'],
        ['Poppins-Medium.woff', 'Poppins Medium'],
        ['Poppins-Bold.woff', 'Poppins Bold'],
        ['JetBrainsMono-Regular.woff', 'JetBrains Mono'],
        ['JetBrainsMono-Bold.woff', 'JetBrains Mono Bold']
    ]
    for (const [file, family] of fonts) {
        const ok = GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family)
        if (!ok) console.error(`OG font gagal di-register: ${file} (${family})`)
    }
    fontsReady = true
}

const W = 1200
const H = 630
const INK = '#1e1b4b'
const INDIGO = '#6366f1'
const MUTED = '#6b7280'
const PAGE_BG = '#eef0fb'
const SHADOW = '#d1d5db'

// ---------- generic drawing helpers ----------

function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
}

function truncate(ctx, text, maxWidth) {
    text = String(text || '')
    if (ctx.measureText(text).width <= maxWidth) return text
    let t = text
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
    return t + '…'
}

function wrapText(ctx, text, maxWidth, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean)
    const lines = []
    let cur = ''
    for (const w of words) {
        const test = cur ? cur + ' ' + w : w
        if (cur && ctx.measureText(test).width > maxWidth) {
            lines.push(cur)
            cur = w
            if (lines.length === maxLines) { cur = ''; break }
        } else cur = test
    }
    if (cur && lines.length < maxLines) lines.push(cur)
    if (lines.length === maxLines && cur === '') {
        lines[maxLines - 1] = truncate(ctx, lines[maxLines - 1] + ' …', maxWidth)
    }
    return lines
}

async function loadRemoteImage(url) {
    try {
        const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 3000 })
        return await loadImage(Buffer.from(resp.data))
    } catch { return null }
}

async function loadUserAvatar(user) {
    if (!user) return null
    try {
        if (user.avatarPath) return await loadImage(await getAssetContent(user.avatarPath))
        if (user.avatar) return await loadRemoteImage(user.avatar)
    } catch { /* ignore */ }
    return null
}

async function loadUserBanner(user) {
    if (!user || !user.bannerPath) return null
    try { return await loadImage(await getAssetContent(user.bannerPath)) } catch { return null }
}

function drawCircleImage(ctx, img, cx, cy, r) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    const size = r * 2
    // cover-fit
    const scale = Math.max(size / img.width, size / img.height)
    const dw = img.width * scale, dh = img.height * scale
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
    ctx.restore()
}

function drawAvatarPlaceholder(ctx, cx, cy, r, label) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#e0e7ff'
    ctx.fill()
    ctx.fillStyle = '#4338ca'
    ctx.font = `700 ${Math.round(r)}px "Poppins Bold"`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText((label || '?').charAt(0).toUpperCase(), cx, cy + 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
}

// ---------- hand-drawn icons (avoid relying on emoji fonts) ----------

function iconLock(ctx, x, y, s, color) {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = s * 0.12
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(x + s / 2, y + s * 0.38, s * 0.26, Math.PI, 0)
    ctx.stroke()
    roundRect(ctx, x + s * 0.08, y + s * 0.34, s * 0.84, s * 0.6, s * 0.12)
    ctx.fill()
}

function iconEye(ctx, x, y, s, color) {
    const cx = x + s / 2, cy = y + s / 2
    ctx.strokeStyle = color
    ctx.lineWidth = s * 0.1
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, cy)
    ctx.quadraticCurveTo(cx, y - s * 0.05, x + s, cy)
    ctx.quadraticCurveTo(cx, y + s * 1.05, x, cy)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, s * 0.16, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
}

function iconHeart(ctx, x, y, s, color) {
    ctx.fillStyle = color
    ctx.beginPath()
    const cx = x + s / 2
    ctx.moveTo(cx, y + s * 0.92)
    ctx.bezierCurveTo(x - s * 0.15, y + s * 0.55, x + s * 0.05, y - s * 0.05, cx, y + s * 0.28)
    ctx.bezierCurveTo(x + s * 0.95, y - s * 0.05, x + s * 1.15, y + s * 0.55, cx, y + s * 0.92)
    ctx.closePath()
    ctx.fill()
}

function iconUsers(ctx, x, y, s, color) {
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(x + s * 0.35, y + s * 0.32, s * 0.22, 0, Math.PI * 2); ctx.fill()
    roundRect(ctx, x + s * 0.08, y + s * 0.56, s * 0.54, s * 0.4, s * 0.16)
    ctx.fill()
    ctx.globalAlpha = 0.55
    ctx.beginPath(); ctx.arc(x + s * 0.72, y + s * 0.36, s * 0.18, 0, Math.PI * 2); ctx.fill()
    roundRect(ctx, x + s * 0.5, y + s * 0.58, s * 0.46, s * 0.34, s * 0.14)
    ctx.fill()
    ctx.globalAlpha = 1
}

function iconCode(ctx, x, y, s, color) {
    ctx.strokeStyle = color
    ctx.lineWidth = s * 0.11
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x + s * 0.32, y + s * 0.18); ctx.lineTo(x, y + s * 0.5); ctx.lineTo(x + s * 0.32, y + s * 0.82)
    ctx.moveTo(x + s * 0.68, y + s * 0.18); ctx.lineTo(x + s, y + s * 0.5); ctx.lineTo(x + s * 0.68, y + s * 0.82)
    ctx.stroke()
}

function iconCheckBadge(ctx, cx, cy, r, bg = '#6366f1') {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = bg
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = r * 0.22
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.45, cy)
    ctx.lineTo(cx - r * 0.1, cy + r * 0.4)
    ctx.lineTo(cx + r * 0.5, cy - r * 0.4)
    ctx.stroke()
}

// ---------- shared page chrome ----------

function drawBackground(ctx) {
    ctx.fillStyle = PAGE_BG
    ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(99,102,241,0.10)'
    for (let gx = 24; gx < W; gx += 30) {
        for (let gy = 24; gy < H; gy += 30) {
            ctx.beginPath()
            ctx.arc(gx, gy, 1.3, 0, Math.PI * 2)
            ctx.fill()
        }
    }
}

function drawBrandHeader(ctx) {
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK
    ctx.font = '700 32px "Poppins Bold"'
    ctx.fillText('Codery', 56, 60)
    ctx.fillStyle = INDIGO
    ctx.font = '500 19px "Poppins Medium"'
    const label = 'codery.sasane.eu.cc'
    ctx.fillText(label, W - 56 - ctx.measureText(label).width, 56)
}

function drawCardBase(ctx, x, y, w, h, r = 22) {
    ctx.fillStyle = SHADOW
    roundRect(ctx, x + 6, y + 8, w, h, r)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x, y, w, h, r)
    ctx.fill()
}

function pillBadge(ctx, text, x, yCenter, { bg = '#e0e7ff', fg = '#4338ca', font = '600 18px "Poppins Medium"', icon = null } = {}) {
    ctx.font = font
    const padX = 14
    const iconW = icon ? 22 : 0
    const textW = ctx.measureText(text).width
    const w = padX + iconW + textW + padX
    const h = 32
    roundRect(ctx, x, yCenter - h / 2, w, h, 10)
    ctx.fillStyle = bg
    ctx.fill()
    if (icon) icon(ctx, x + padX, yCenter - 9, 18, fg)
    ctx.fillStyle = fg
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + padX + iconW, yCenter + 1)
    ctx.textBaseline = 'alphabetic'
    return w
}

// ---------- code syntax tokenizer (lightweight, language-agnostic) ----------

const KEYWORDS = /\b(function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|import|export|default|from|class|extends|new|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|self|def|public|private|protected|static|void|int|float|double|bool|boolean|string|String|True|False|None|null|undefined|nil|struct|interface|implements|package|namespace|using|include|require|echo|print|fn|impl|match|pub|mut|lambda|yield)\b/

function tokenizeLine(line) {
    const tokens = []
    const push = (text, color, style) => { if (text) tokens.push({ text, color, style }) }
    const commentMatch = line.match(/(\/\/.*|#(?!!).*)$/)
    let workLine = line
    let commentText = ''
    if (commentMatch && !/["'`].*\/\/|["'`].*#/.test(line.slice(0, commentMatch.index))) {
        commentText = commentMatch[0]
        workLine = line.slice(0, commentMatch.index)
    }
    const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\.?\d*\b)|([A-Za-z_$][\w$]*(?=\())|(\b[A-Za-z_]\w*\b)|(\s+)|([^\sA-Za-z0-9_]+)/g
    let m
    while ((m = re.exec(workLine)) !== null) {
        if (m[1]) push(m[1], '#98c379')
        else if (m[2]) push(m[2], '#d19a66')
        else if (m[3]) push(m[3], '#61afef')
        else if (m[4]) push(m[4], KEYWORDS.test(m[4]) ? '#c678dd' : '#abb2bf')
        else if (m[5]) push(m[5], '#abb2bf')
        else if (m[6]) push(m[6], '#56b6c2')
    }
    if (commentText) push(commentText, '#5c6370', 'italic')
    return tokens.length ? tokens : [{ text: line, color: '#abb2bf' }]
}

function drawTerminal(ctx, x, y, w, h, filename) {
    const headerH = 42
    roundRect(ctx, x, y, w, h, 14)
    ctx.fillStyle = '#282c34'
    ctx.fill()
    ctx.save()
    roundRect(ctx, x, y, w, headerH, 14)
    ctx.clip()
    ctx.fillStyle = '#21252b'
    ctx.fillRect(x, y, w, headerH)
    ctx.restore();
    ['#f87171', '#fbbf24', '#4ade80'].forEach((c, i) => {
        ctx.beginPath()
        ctx.fillStyle = c
        ctx.arc(x + 22 + i * 22, y + headerH / 2, 6, 0, Math.PI * 2)
        ctx.fill()
    })
    ctx.fillStyle = '#9ca3af'
    ctx.font = '400 15px "JetBrains Mono"'
    ctx.textBaseline = 'middle'
    ctx.fillText(truncate(ctx, filename || '', w - 260), x + 100, y + headerH / 2 + 1)
    ctx.textBaseline = 'alphabetic'
    return headerH
}

const LANG_LABEL = {
    javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', html: 'HTML', css: 'CSS',
    json: 'JSON', java: 'Java', php: 'PHP', bash: 'Bash', markdown: 'Markdown', text: 'Text'
}

// ---------- generators ----------

export async function renderCodeOgImage(snippet, owner) {
    ensureFonts()
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')
    drawBackground(ctx)
    drawBrandHeader(ctx)

    const cardX = 56, cardY = 96, cardW = W - 112, maxCardH = H - 96 - 40
    const pad = 32
    const contentX = cardX + pad
    const contentW = cardW - pad * 2
    const footerH = 40
    const termHeaderH = 42 // matches drawTerminal's own header strip height

    const isLocked = !!snippet.isLocked
    const rawLines = isLocked ? [] : (snippet.preview || '').split('\n')
    // denser font for longer snippets so the card actually fills up with real code
    // instead of leaving a lot of empty terminal space for short previews
    const density = rawLines.length <= 6
        ? { font: 18, lineHeight: 29, gutterFont: 15 }
        : rawLines.length <= 11
            ? { font: 16, lineHeight: 24, gutterFont: 13 }
            : { font: 14, lineHeight: 20, gutterFont: 12 }
    const bodyPadY = Math.round(density.lineHeight * 0.75)

    // height needed above the terminal: top padding + title row + optional description + gap
    // the +46 (not +40) leaves clearance under the language badge pill, which extends
    // ~28px below the title baseline — too tight a gap made long descriptions visually
    // collide with the badge on the right edge of the card
    const headerBlockH = pad + 46 + (snippet.description ? 22 : 0) + 10

    // how tall the terminal box needs to be to show the whole snippet (or, for locked
    // snippets, just enough room for the lock message) — then clamp to what actually
    // fits in the card so very long snippets still crop instead of blowing up the card
    const idealTermH = isLocked
        ? termHeaderH + 100
        : termHeaderH + bodyPadY + Math.max(1, rawLines.length) * density.lineHeight + 10
    const minTermH = termHeaderH + bodyPadY + density.lineHeight
    const maxTermH = maxCardH - headerBlockH - 12 - footerH - pad
    const termH = Math.min(maxTermH, Math.max(minTermH, idealTermH))
    const cardH = headerBlockH + termH + 12 + footerH + pad

    drawCardBase(ctx, cardX, cardY, cardW, cardH)
    let cy = cardY + pad

    const langLabel = isLocked ? 'Terkunci' : (LANG_LABEL[snippet.language] || snippet.language || 'Text')
    ctx.font = '600 18px "Poppins Medium"'
    const badgeW = ctx.measureText(langLabel).width + (isLocked ? 22 : 0) + 28
    const badgeX = cardX + cardW - pad - badgeW
    pillBadge(ctx, langLabel, badgeX, cy + 12, isLocked
        ? { bg: '#fee2e2', fg: '#b91c1c', icon: iconLock }
        : {})

    ctx.fillStyle = INK
    ctx.font = '700 28px "Poppins Bold"'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(truncate(ctx, snippet.title || snippet.filename || 'Untitled', badgeX - contentX - 20), contentX, cy + 24)
    cy += 46

    if (snippet.description) {
        ctx.fillStyle = MUTED
        ctx.font = '400 16px "Poppins"'
        ctx.fillText(truncate(ctx, snippet.description, contentW), contentX, cy)
        cy += 22
    }
    cy += 10

    const termY = cy
    const headerH = drawTerminal(ctx, contentX, termY, contentW, termH, snippet.filename)

    if (isLocked) {
        ctx.fillStyle = '#5c6370'
        ctx.font = 'italic 400 18px "JetBrains Mono"'
        ctx.fillText('// kode ini dikunci dengan PIN', contentX + 24, termY + headerH + 40)
    } else {
        const bodyPadX = 22
        const availH = termH - headerH - bodyPadY
        const maxLines = Math.max(1, Math.floor(availH / density.lineHeight))
        const shown = rawLines.slice(0, maxLines)
        const hiddenCount = rawLines.length - shown.length
        const gutterW = 30

        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(contentX + bodyPadX + gutterW - 8, termY + headerH + 6)
        ctx.lineTo(contentX + bodyPadX + gutterW - 8, termY + termH - 6)
        ctx.stroke()

        shown.forEach((line, idx) => {
            let lx = contentX + bodyPadX
            const ly = termY + headerH + bodyPadY + idx * density.lineHeight
            ctx.fillStyle = '#495162'
            ctx.font = `400 ${density.gutterFont}px "JetBrains Mono"`
            ctx.fillText(String(idx + 1).padStart(2, ' '), lx, ly)
            lx += gutterW
            for (const tok of tokenizeLine(line)) {
                ctx.font = (tok.style === 'italic' ? 'italic ' : '') + `400 ${density.font}px "JetBrains Mono"`
                ctx.fillStyle = tok.color
                const w = ctx.measureText(tok.text).width
                if (lx + w > contentX + contentW - bodyPadX) return
                ctx.fillText(tok.text, lx, ly)
                lx += w
            }
        })

        if (hiddenCount > 0) {
            const ly = termY + headerH + bodyPadY + shown.length * density.lineHeight
            if (ly < termY + termH - 6) {
                ctx.fillStyle = '#5c6370'
                ctx.font = `italic 400 ${Math.max(12, density.font - 1)}px "JetBrains Mono"`
                ctx.fillText(`... ${hiddenCount} baris lainnya`, contentX + bodyPadX + gutterW, ly)
            }
        }
    }

    const footerY = cardY + cardH - pad - footerH / 2 + 6
    let fx = contentX
    const avatar = await loadUserAvatar(owner)
    if (avatar) drawCircleImage(ctx, avatar, fx + 15, footerY - 5, 15)
    else drawAvatarPlaceholder(ctx, fx + 15, footerY - 5, 15, owner?.nickname || owner?.username || snippet.ownerUsername)
    fx += 38
    ctx.fillStyle = '#374151'
    ctx.font = '600 17px "Poppins Medium"'
    ctx.fillText('@' + (owner ? (owner.nickname || owner.username) : (snippet.ownerUsername || '')), fx, footerY)

    // stat chips, laid out right-to-left from the card's right edge
    let sx = cardX + cardW - pad
    const statChipRTL = (icon, value, color) => {
        ctx.font = '500 17px "JetBrains Mono"'
        const textW = ctx.measureText(String(value)).width
        sx -= textW
        ctx.fillStyle = '#374151'
        ctx.fillText(String(value), sx, footerY)
        sx -= 8
        icon(ctx, sx - 20, footerY - 18, 20, color)
        sx -= 20 + 26
    }
    statChipRTL(iconHeart, snippet.likes ?? 0, '#f43f5e')
    statChipRTL(iconEye, snippet.views ?? 0, MUTED)

    return canvas.toBuffer('image/png')
}

export async function renderProfileOgImage(user, stats) {
    ensureFonts()
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')
    drawBackground(ctx)
    drawBrandHeader(ctx)

    const cardX = 56, cardY = 96, cardW = W - 112, cardH = H - 96 - 40, radius = 22
    drawCardBase(ctx, cardX, cardY, cardW, cardH, radius)

    const bannerH = 190
    const banner = await loadUserBanner(user)
    ctx.save()
    roundRect(ctx, cardX, cardY, cardW, cardH, radius)
    ctx.clip()
    ctx.beginPath()
    ctx.rect(cardX, cardY, cardW, bannerH)
    ctx.clip()
    if (banner) {
        const scale = Math.max(cardW / banner.width, bannerH / banner.height)
        const dw = banner.width * scale, dh = banner.height * scale
        ctx.drawImage(banner, cardX + (cardW - dw) / 2, cardY + (bannerH - dh) / 2, dw, dh)
    } else {
        const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + bannerH)
        grad.addColorStop(0, '#818cf8'); grad.addColorStop(1, '#6366f1')
        ctx.fillStyle = grad
        ctx.fillRect(cardX, cardY, cardW, bannerH)
    }
    ctx.restore()

    const pad = 36
    const avatarR = 62
    const avatarCx = cardX + pad + avatarR
    const avatarCy = cardY + bannerH + 10
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(avatarCx, avatarCy, avatarR + 6, 0, Math.PI * 2); ctx.fill()
    const avatar = await loadUserAvatar(user)
    if (avatar) drawCircleImage(ctx, avatar, avatarCx, avatarCy, avatarR)
    else drawAvatarPlaceholder(ctx, avatarCx, avatarCy, avatarR, user.nickname || user.username)

    let ty = avatarCy + avatarR + 46
    const isDev = !!stats.isDeveloper
    const isVerified = (stats.badges || []).includes('verified')
    ctx.fillStyle = INK
    ctx.font = '700 32px "Poppins Bold"'
    const nameText = truncate(ctx, user.nickname || user.username, cardW - pad * 2 - 60)
    ctx.fillText(nameText, cardX + pad, ty)
    if (isVerified) iconCheckBadge(ctx, cardX + pad + ctx.measureText(nameText).width + 22, ty - 10, 14, isDev ? '#f59e0b' : INDIGO)
    ty += 30
    ctx.fillStyle = MUTED
    ctx.font = '400 19px "JetBrains Mono"'
    const handleText = '@' + user.username
    ctx.fillText(handleText, cardX + pad, ty)
    if (isDev) {
        pillBadge(ctx, 'Developer', cardX + pad + ctx.measureText(handleText).width + 18, ty - 7,
            { bg: '#fef3c7', fg: '#92400e', font: '600 14px "Poppins Medium"' })
    }
    ty += 34

    if (user.bio) {
        ctx.fillStyle = '#374151'
        ctx.font = '400 18px "Poppins"'
        const lines = wrapText(ctx, user.bio, cardW - pad * 2, 2)
        for (const line of lines) { ctx.fillText(line, cardX + pad, ty); ty += 26 }
    }

    const statsY = cardY + cardH - 50
    let sx = cardX + pad
    const stat = (icon, value, label) => {
        icon(ctx, sx, statsY - 18, 22, INDIGO)
        sx += 30
        ctx.fillStyle = INK
        ctx.font = '700 20px "Poppins Bold"'
        ctx.fillText(String(value), sx, statsY)
        sx += ctx.measureText(String(value)).width + 8
        ctx.fillStyle = MUTED
        ctx.font = '400 16px "Poppins"'
        ctx.fillText(label, sx, statsY)
        sx += ctx.measureText(label).width + 36
    }
    stat(iconUsers, stats.followers ?? 0, 'Pengikut')
    stat(iconCode, stats.snippets ?? 0, 'Kode')
    stat(iconHeart, stats.likes ?? 0, 'Suka')

    return canvas.toBuffer('image/png')
}

export async function renderFeedOgImage(stats) {
    ensureFonts()
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext('2d')
    drawBackground(ctx)

    const cardX = 140, cardY = 110, cardW = W - 280, cardH = H - 110 - 60, radius = 26
    drawCardBase(ctx, cardX, cardY, cardW, cardH, radius)

    const headerH = 46
    ctx.save()
    roundRect(ctx, cardX, cardY, cardW, headerH, radius)
    ctx.clip()
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(cardX, cardY, cardW, headerH)
    ctx.restore();
    ['#f87171', '#fbbf24', '#4ade80'].forEach((c, i) => {
        ctx.beginPath(); ctx.fillStyle = c; ctx.arc(cardX + 26 + i * 24, cardY + headerH / 2, 7, 0, Math.PI * 2); ctx.fill()
    })

    const cx = cardX + cardW / 2
    ctx.textAlign = 'center'
    ctx.fillStyle = INK
    ctx.font = '800 76px "Poppins Bold"'
    ctx.fillText('Codery', cx, cardY + headerH + 130)

    ctx.fillStyle = INDIGO
    ctx.fillRect(cx - 24, cardY + headerH + 158, 48, 5)

    ctx.fillStyle = MUTED
    ctx.font = '500 24px "JetBrains Mono"'
    ctx.fillText('Code Sharing Platform', cx, cardY + headerH + 205)
    ctx.textAlign = 'left'

    const statsY = cardY + cardH - 70
    const items = [
        { icon: iconCode, value: stats.snippets ?? 0, label: 'Kode dibagikan' },
        { icon: iconUsers, value: stats.users ?? 0, label: 'Developer' }
    ]
    const gap = 90
    const widths = items.map(it => {
        ctx.font = '700 26px "Poppins Bold"'
        const valueW = ctx.measureText(String(it.value)).width
        ctx.font = '400 18px "Poppins"'
        const labelW = ctx.measureText(it.label).width
        return 34 + valueW + 10 + labelW
    })
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1)
    let sx = cardX + (cardW - totalW) / 2
    items.forEach((it, i) => {
        it.icon(ctx, sx, statsY - 18, 22, INDIGO)
        sx += 34
        ctx.fillStyle = INK
        ctx.font = '700 26px "Poppins Bold"'
        ctx.fillText(String(it.value), sx, statsY)
        sx += ctx.measureText(String(it.value)).width + 10
        ctx.fillStyle = MUTED
        ctx.font = '400 18px "Poppins"'
        ctx.fillText(it.label, sx, statsY)
        sx += widths[i] - (34 + ctx.measureText(String(it.value)).width + 10) + gap
    })

    ctx.fillStyle = INDIGO
    ctx.font = '500 20px "Poppins Medium"'
    const label = 'codery.sasane.eu.cc'
    ctx.textAlign = 'center'
    ctx.fillText(label, cx, cardY + cardH + 44)
    ctx.textAlign = 'left'

    return canvas.toBuffer('image/png')
}
