import { Router } from 'express'
import { Users, Snippets, Views, Likes, ensureNickname, avatarUrl, stripSnippetSecrets } from '../db.js'
import { createRateLimiter } from '../rate-limit.js'
import { createSnippetForUser } from './codes.js'

// API publik buat akun sendiri -- didokumentasikan di halaman /api-docs.
// Key dikirim lewat header X-API-Key atau query ?key=, divalidasi ke
// Users.apiKey. Dibatasi rate-limit sederhana per key biar gak disalahgunain.
//
// Endpoint di bawah router.use() (middleware pengecek key) WAJIB pakai API
// key. Endpoint yang didaftarkan SEBELUM router.use() itu publik/terbuka --
// gak butuh key sama sekali, karena cuma nampilin data yang emang udah
// publik (kode yang isPublic:true).
const router = Router()
const tooManyAttempts = createRateLimiter(60)
const tooManyUploads = createRateLimiter(15)
const tooManyPublicReads = createRateLimiter(120)

async function findByApiKey(key) {
    if (!key) return null
    const users = await Users.all()
    return users.find(u => u.apiKey === key) || null
}

// ---- Tanpa API Key ----------------------------------------------------

router.get('/snippet/:shortId', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon'
    if (tooManyPublicReads(String(ip))) return res.status(429).json({ error: 'Terlalu banyak request, coba lagi nanti' })
    try {
        const snippet = await Snippets.findByShort(req.params.shortId)
        if (!snippet || !snippet.isPublic) return res.status(404).json({ error: 'Snippet tidak ditemukan atau bukan publik' })
        const [views, likes] = await Promise.all([
            Views.count(snippet.shortId),
            Likes.count(snippet.shortId)
        ])
        res.json({ ...stripSnippetSecrets(snippet), views, likes })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

// ---- Butuh API Key -----------------------------------------------------

router.use(async (req, res, next) => {
    const key = req.headers['x-api-key'] || req.query.key
    if (!key) return res.status(401).json({ error: 'API key wajib. Kirim lewat header X-API-Key atau ?key=' })
    if (tooManyAttempts(String(key))) return res.status(429).json({ error: 'Terlalu banyak request, coba lagi nanti' })
    const user = await findByApiKey(String(key))
    if (!user) return res.status(401).json({ error: 'API key tidak valid' })
    req.apiUser = user
    next()
})

router.get('/me', async (req, res) => {
    const user = req.apiUser
    const nickname = await ensureNickname(user)
    res.json({
        username: user.username,
        nickname,
        bio: user.bio || '',
        avatar: avatarUrl(user),
        createdAt: user.createdAt
    })
})

router.get('/snippets', async (req, res) => {
    const user = req.apiUser
    const all = await Snippets.byUserLive(user.username)
    const publicSnippets = all.filter(s => s.isPublic)
    const [viewCounts, likeCounts] = await Promise.all([
        Views.countMany(publicSnippets.map(s => s.shortId)),
        Likes.countMany(publicSnippets.map(s => s.shortId))
    ])
    res.json({
        username: user.username,
        count: publicSnippets.length,
        snippets: publicSnippets.map(s => ({
            ...stripSnippetSecrets(s),
            views: viewCounts[s.shortId] || 0,
            likes: likeCounts[s.shortId] || 0
        }))
    })
})

router.post('/snippets', async (req, res) => {
    if (tooManyUploads(req.apiUser.apiKey)) return res.status(429).json({ error: 'Terlalu banyak upload, coba lagi nanti' })
    try {
        const snippet = await createSnippetForUser(req.apiUser.username, req.body)
        res.status(201).json(stripSnippetSecrets(snippet))
    } catch (e) {
        res.status(e.status || 500).json({ error: e.response?.data?.message || e.message })
    }
})

export default router
