import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'
import path from 'path'
import crypto from 'crypto'
import compression from 'compression'
import { fileURLToPath } from 'url'
import authRoutes from './src/routes/auth.js'
import codeRoutes from './src/routes/codes.js'
import userRoutes from './src/routes/users.js'
import devRoutes from './src/routes/dev.js'
import scrapeRoutes from './src/routes/scrape-requests.js'
import notificationRoutes from './src/routes/notifications.js'
import tenorRoutes from './src/routes/tenor.js'
import { initGithub, getAssetContent } from './src/github.js'
import { Snippets, Users, Views, Likes, Follows, ScrapeRequests, ensureSessionSecret, isDeveloperUsername, isModeratorUser, ensureNickname, readBadges, badgeDisplay } from './src/db.js'
import { verifyToken, parseCookies, COOKIE_NAME, MAX_AGE, createToken, setSecret } from './src/token.js'
import { renderCodeOgImage, renderProfileOgImage, renderFeedOgImage } from './src/og.js'
import fs from 'fs'

dotenv.config()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

// CSS di public/style.css itu hasil build (minified) dari style.source.css.
// Di server tradisional (VPS/PM2) ini dulu langsung nulis ulang public/style.css
// tiap boot. Itu GAK BISA jalan di lingkungan serverless kayak Vercel, karena
// filesystem deployment-nya read-only (cuma /tmp yang bisa ditulis). Jadi CSS
// hasil build sekarang cuma disimpan di memori dan dilayani lewat route
// eksplisit di bawah -- gak pernah nulis ke disk sama sekali, aman jalan di
// server biasa MAUPUN di serverless.
function buildCss() {
    try {
        const srcPath = path.join(__dirname, 'style.source.css')
        const css = fs.readFileSync(srcPath, 'utf-8')
        return css
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .replace(/\s*([{}:;,])\s*/g, '$1')
            .replace(/;}/g, '}')
            .trim()
    } catch (e) {
        console.error('[css] gagal build dari style.source.css, pakai public/style.css yang udah ada:', e.message)
        try { return fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf-8') }
        catch { return '' }
    }
}
const builtCss = buildCss()

// Versi build: dipakai sebagai ?v=... di semua link CSS/JS di HTML, jadi
// browser otomatis ambil file baru begitu ada deploy baru -- gak perlu lagi
// suruh user hard-refresh/clear cache manual. Di Vercel dipakai ID deployment
// (stabil buat SEMUA instance/cold-start dalam satu deploy yang sama), di
// server biasa (VPS/lokal) fallback ke timestamp proses start.
const BUILD_VERSION = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())
function versionAssets(html) {
    return html.replace(/((?:href|src)="(?:style\.css|js\/[^"]+\.js))"/g, `$1?v=${BUILD_VERSION}"`)
}

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const codeHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'code.html'), 'utf-8'))
const profileHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'profile.html'), 'utf-8'))
const indexHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8'))
const ogImageCache = new Map()
const OG_CACHE_MS = 5 * 60 * 1000

app.set('trust proxy', 1)
app.use(compression())
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
app.use(cors({
    origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)),
    credentials: true
}))
app.use(express.json({ limit: '6mb' }))

app.use((req, res, next) => {
    const cookies = parseCookies(req.headers.cookie)
    req.username = verifyToken(cookies[COOKIE_NAME]) || null

    res.setAuthCookie = (username) => {
        res.cookie(COOKIE_NAME, createToken(username), {
            httpOnly: true,
            maxAge: MAX_AGE,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        })
    }
    res.clearAuthCookie = () => res.clearCookie(COOKIE_NAME)
    next()
})

app.use('/api/auth', authRoutes)
app.use('/api/codes', codeRoutes)
app.use('/api/users', userRoutes)
app.use('/api/dev', devRoutes)
app.use('/api/scrape-requests', scrapeRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/tenor', tenorRoutes)

// Endpoint cron buat bersihin scrape request yang udah expired (>7 hari).
// Di server tradisional ini jalan lewat setInterval (lihat schedulePruneExpiredScrapeRequests
// di bawah). Di Vercel gak ada proses long-running buat setInterval, jadi endpoint
// ini yang dipanggil terjadwal lewat Vercel Cron Jobs (lihat vercel.json). Dilindungi
// pakai CRON_SECRET -- Vercel otomatis nyisipin header "Authorization: Bearer <CRON_SECRET>"
// tiap manggil cron kalau env var itu di-set, jadi endpoint ini gak bisa dipicu sembarang orang.
app.get('/api/cron/prune-scrape-requests', async (req, res) => {
    if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' })
    }
    try {
        const { removed } = await ScrapeRequests.pruneExpired()
        res.json({ ok: true, removed })
    } catch (e) {
        console.error('Gagal prune scrape requests (cron):', e.response?.data?.message || e.message)
        res.status(500).json({ error: 'Gagal prune scrape requests' })
    }
})

app.get('/avatar/:username', async (req, res) => {
    try {
        const user = await Users.find(req.params.username)
        const fallback = `https://api.dicebear.com/7.x/identicon/svg?seed=${req.params.username}`
        if (!user || !user.avatarPath) return res.redirect(user?.avatar || fallback)
        const buf = await getAssetContent(user.avatarPath)
        const ext = user.avatarPath.split('.').pop().toLowerCase()
        const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
        const etag = `"${crypto.createHash('sha1').update(buf).digest('hex')}"`
        res.set('Cache-Control', 'no-cache')
        res.set('ETag', etag)
        if (req.headers['if-none-match'] === etag) return res.status(304).end()
        res.set('Content-Type', contentType)
        res.send(buf)
    } catch (e) {
        res.status(404).send('Foto tidak ditemukan')
    }
})

app.get('/banner/:username', async (req, res) => {
    try {
        const user = await Users.find(req.params.username)
        if (!user || !user.bannerPath) return res.status(404).send('Banner tidak ditemukan')
        const buf = await getAssetContent(user.bannerPath)
        const ext = user.bannerPath.split('.').pop().toLowerCase()
        const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
        const etag = `"${crypto.createHash('sha1').update(buf).digest('hex')}"`
        res.set('Cache-Control', 'no-cache')
        res.set('ETag', etag)
        if (req.headers['if-none-match'] === etag) return res.status(304).end()
        res.set('Content-Type', contentType)
        res.send(buf)
    } catch (e) {
        res.status(404).send('Banner tidak ditemukan')
    }
})

app.get('/raw/:shortId', async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).send('Kode tidak ditemukan')
    if (!snippet.isPublic) return res.status(403).send('Kode ini privat')
    const isOwner = req.username && req.username === snippet.ownerUsername
    if (snippet.isLocked && !isOwner) return res.status(403).send('Kode ini dikunci PIN')
    try {
        const raw = await axios.get(snippet.rawUrl, {
            responseType: 'text',
            transformResponse: [d => d]
        })
        res.set('Content-Type', 'text/plain; charset=utf-8')
        res.set('Cache-Control', 'no-store')
        res.send(raw.data)
    } catch (e) {
        res.status(404).send('Kode tidak ditemukan (gist mungkin sudah dihapus)')
    }
})

async function withOgCache(key, ttlMs, generate) {
    const cached = ogImageCache.get(key)
    if (cached && Date.now() - cached.at < ttlMs) return cached.buf
    const buf = await generate()
    ogImageCache.set(key, { buf, at: Date.now() })
    return buf
}

function sendPng(res, buf) {
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'public, max-age=300')
    res.send(buf)
}

app.get('/og/code/:shortId.png', async (req, res) => {
    try {
        const snippet = await Snippets.findByShort(req.params.shortId)
        if (!snippet || !snippet.isPublic) return res.status(404).end()
        const buf = await withOgCache(`code:${snippet.shortId}`, OG_CACHE_MS, async () => {
            const owner = await Users.find(snippet.ownerUsername)
            const [views, likes] = await Promise.all([Views.count(snippet.shortId), Likes.count(snippet.shortId)])
            return renderCodeOgImage({ ...snippet, views, likes }, owner)
        })
        sendPng(res, buf)
    } catch (e) {
        console.error('OG code image error:', e.message)
        res.status(500).end()
    }
})

app.get('/og/profile/:username.png', async (req, res) => {
    try {
        const user = await Users.find(req.params.username)
        if (!user) return res.status(404).end()
        const buf = await withOgCache(`profile:${user.username}`, OG_CACHE_MS, async () => {
            const [followers, snippets] = await Promise.all([
                Follows.followers(user.username),
                Snippets.byUserLive(user.username)
            ])
            const badges = readBadges(user)
            const publicSnippets = snippets.filter(s => s.isPublic)
            const likeCounts = await Likes.countMany(publicSnippets.map(s => s.shortId))
            const totalLikes = Object.values(likeCounts).reduce((a, b) => a + b, 0)
            const display = badgeDisplay(user, badges)
            return renderProfileOgImage(user, {
                followers: followers.length,
                snippets: publicSnippets.length,
                likes: totalLikes,
                badges: display.badges,
                isDeveloper: display.isDeveloper
            })
        })
        sendPng(res, buf)
    } catch (e) {
        console.error('OG profile image error:', e.message)
        res.status(500).end()
    }
})

app.get('/og/feed.png', async (req, res) => {
    try {
        const buf = await withOgCache('feed', 30 * 60 * 1000, async () => {
            const [snippets, users] = await Promise.all([Snippets.allLive(), Users.all()])
            return renderFeedOgImage({ snippets: snippets.filter(s => s.isPublic).length, users: users.length })
        })
        sendPng(res, buf)
    } catch (e) {
        console.error('OG feed image error:', e.message)
        res.status(500).end()
    }
})

function injectMeta(template, titleTag, { title, desc, imgUrl, pageUrl }) {
    const meta = `<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${imgUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${pageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${imgUrl}">
</head>`
    return template
        .replace(titleTag, `<title>${escapeHtml(title)}</title>`)
        .replace('</head>', meta)
}

app.get('/code', async (req, res) => {
    const shortId = req.query.id
    let html = codeHtmlTemplate
    if (shortId) {
        try {
            const snippet = await Snippets.findByShort(String(shortId))
            if (snippet && snippet.isPublic) {
                const host = `${req.protocol}://${req.get('host')}`
                const desc = snippet.isLocked
                    ? 'Kode ini dikunci PIN.'
                    : (snippet.description || (snippet.preview || '').replace(/\n/g, '  ').slice(0, 150) || 'Lihat kode di Codery')
                html = injectMeta(html, '<title>Codery — Lihat Kode</title>', {
                    title: `${snippet.title || snippet.filename} — Codery`,
                    desc,
                    imgUrl: `${host}/og/code/${encodeURIComponent(shortId)}.png`,
                    pageUrl: `${host}/code?id=${encodeURIComponent(shortId)}`
                })
            }
        } catch (e) { console.error('code page meta error:', e.message) }
    }
    sendHtml(res, html)
})

app.get('/profile', async (req, res) => {
    const username = req.query.u
    let html = profileHtmlTemplate
    if (username) {
        try {
            const user = await Users.find(String(username))
            if (user) {
                const host = `${req.protocol}://${req.get('host')}`
                const nickname = await ensureNickname(user)
                html = injectMeta(html, '<title>Codery — Profil</title>', {
                    title: `${nickname} (@${user.username}) — Codery`,
                    desc: user.bio || `Lihat profil dan kode yang dibagikan ${nickname} di Codery.`,
                    imgUrl: `${host}/og/profile/${encodeURIComponent(user.username)}.png`,
                    pageUrl: `${host}/profile?u=${encodeURIComponent(user.username)}`
                })
            }
        } catch (e) { console.error('profile page meta error:', e.message) }
    }
    sendHtml(res, html)
})

app.get('/', (req, res) => {
    const host = `${req.protocol}://${req.get('host')}`
    const html = injectMeta(indexHtmlTemplate, '<title>Codery — Feed</title>', {
        title: 'Codery — Code Sharing Platform',
        desc: 'Upload, bagikan, dan temukan potongan kode dari developer lain di Codery.',
        imgUrl: `${host}/og/feed.png`,
        pageUrl: `${host}/`
    })
    sendHtml(res, html)
})

const PAGES = {
    '/follow': 'follow.html',
    '/auth': 'auth.html',
    '/leaderboard': 'leaderboard.html',
    '/search': 'search.html',
    '/panduan': 'panduan.html'
}
const devpanelHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'devpanel.html'), 'utf-8'))
const moderasiHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'moderasi.html'), 'utf-8'))
const uploadHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'upload.html'), 'utf-8'))
const requestScrapeHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'request-scrape.html'), 'utf-8'))
const likedHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'liked.html'), 'utf-8'))
const bookmarksHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'bookmarks.html'), 'utf-8'))
const notificationsHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'notifications.html'), 'utf-8'))
const scrapeRequestsHtmlTemplate = versionAssets(fs.readFileSync(path.join(__dirname, 'public', 'scrape-requests.html'), 'utf-8'))
const pagesHtmlTemplates = {}
for (const file of Object.values(PAGES)) {
    pagesHtmlTemplates[file] = versionAssets(fs.readFileSync(path.join(__dirname, 'public', file), 'utf-8'))
}
function sendHtml(res, html) {
    res.set('Content-Type', 'text/html; charset=utf-8')
    res.set('Cache-Control', 'no-cache')
    res.send(html)
}
app.get('/devpanel', (req, res) => {
    if (!req.username || !isDeveloperUsername(req.username)) return res.redirect('/')
    sendHtml(res, devpanelHtmlTemplate)
})
app.get('/moderasi', async (req, res) => {
    const user = req.username ? await Users.find(req.username) : null
    if (!isModeratorUser(user)) return res.redirect('/')
    sendHtml(res, moderasiHtmlTemplate)
})
for (const [route, file] of Object.entries(PAGES)) {
    app.get(route, (req, res) => sendHtml(res, pagesHtmlTemplates[file]))
}
app.get('/upload', (req, res) => {
    if (!req.username) return res.redirect('/auth')
    sendHtml(res, uploadHtmlTemplate)
})
app.get('/request-scrape', (req, res) => {
    sendHtml(res, requestScrapeHtmlTemplate)
})
app.get('/liked', (req, res) => {
    if (!req.username) return res.redirect('/auth')
    sendHtml(res, likedHtmlTemplate)
})
app.get('/bookmarks', (req, res) => {
    if (!req.username) return res.redirect('/auth')
    sendHtml(res, bookmarksHtmlTemplate)
})
app.get('/notifications', (req, res) => {
    if (!req.username) return res.redirect('/auth')
    sendHtml(res, notificationsHtmlTemplate)
})
app.get('/scrape-requests', (req, res) => {
    if (!req.username) return res.redirect('/auth')
    sendHtml(res, scrapeRequestsHtmlTemplate)
})
app.get(/^\/(index|upload|code|profile|follow|auth|devpanel|moderasi|leaderboard|search|panduan)\.html$/, (req, res) => {
    if (req.path === '/upload.html' && !req.username) return res.redirect('/auth')
    const clean = req.path.replace(/\.html$/, '').replace(/^\/index$/, '/')
    const qsStr = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''
    res.redirect(301, clean + qsStr)
})
app.get('/u/:username', (req, res) => res.redirect(`/profile?u=${encodeURIComponent(req.params.username)}`))
app.get('/code/:shortId', (req, res) => res.redirect(`/code?id=${encodeURIComponent(req.params.shortId)}`))
app.get('/followers/:username', (req, res) => res.redirect(`/follow?u=${encodeURIComponent(req.params.username)}&type=followers`))
app.get('/following/:username', (req, res) => res.redirect(`/follow?u=${encodeURIComponent(req.params.username)}&type=following`))

app.get('/style.css', (req, res) => {
    res.set('Content-Type', 'text/css; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(builtCss)
})

app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    setHeaders: (res, filePath) => {
        // Font files never change once shipped -> cache aggressively.
        if (/\.(woff2?|ttf)$/.test(filePath)) {
            res.set('Cache-Control', 'public, max-age=31536000, immutable')
        } else if (/\.(js|css)$/.test(filePath)) {
            // URL-nya sekarang selalu ada ?v=<versi-build> (lihat versionAssets di
            // atas), jadi aman di-cache lama & agresif buat performa -- begitu ada
            // deploy baru, versi berubah -> URL beda -> otomatis diambil ulang.
            // Gak ada lagi skenario browser nyangkut ke file lama.
            res.set('Cache-Control', 'public, max-age=31536000, immutable')
        } else {
            res.set('Cache-Control', 'public, max-age=600')
        }
    }
}))

app.use((req, res) => { res.status(404); sendHtml(res, indexHtmlTemplate) })

const PORT = process.env.PORT || 3000
const SCRAPE_PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000

// Cuma dipakai di server tradisional (non-Vercel): setInterval yang jalan terus
// selama proses hidup. Serverless (Vercel) gak punya proses long-running kayak
// gini -- di sana pruning dijadwalkan lewat endpoint /api/cron/prune-scrape-requests
// (lihat di atas) + Vercel Cron Jobs di vercel.json.
function schedulePruneExpiredScrapeRequests() {
    const run = () => {
        ScrapeRequests.pruneExpired()
            .then(({ removed }) => { if (removed) console.log(`Auto-prune: hapus ${removed} scrape request > 7 hari`) })
            .catch(err => console.error('Gagal auto-prune scrape requests:', err.response?.data?.message || err.message))
    }
    run()
    setInterval(run, SCRAPE_PRUNE_INTERVAL_MS)
}

// `ready` nyimpen proses setup async (init GitHub repo, ambil/isi session secret)
// yang HARUS beres sebelum request pertama dilayani. Di server tradisional ini
// ditunggu sebelum app.listen() dipanggil. Di serverless (lihat api/index.js),
// gak ada "sebelum listen" -- setiap invocation langsung await promise ini duluan
// (instance yang masih dingin bakal nunggu sekali, instance yang udah "hangat"
// langsung lanjut karena promise-nya udah resolved).
export const ready = initGithub()
    .then(async () => {
        if (!process.env.SESSION_SECRET) {
            const persisted = await ensureSessionSecret()
            setSecret(persisted)
        }
    })
    .catch(err => {
        console.error('Gagal setup GitHub:', err.response?.data?.message || err.message)
        throw err
    })

// process.env.VERCEL diset otomatis oleh platform Vercel di runtime-nya -- dipakai
// buat bedain "lagi jalan sebagai server biasa (VPS/lokal)" vs "lagi jalan sebagai
// serverless function". Di Vercel, app.listen() dan setInterval() gak relevan sama
// sekali (request masuk lewat handler di api/index.js, bukan lewat port yang di-listen).
if (!process.env.VERCEL) {
    ready
        .then(() => {
            schedulePruneExpiredScrapeRequests()
            app.listen(PORT, () => console.log(`Codery jalan di port ${PORT}`))
        })
        .catch(() => process.exit(1))
}

export default app
