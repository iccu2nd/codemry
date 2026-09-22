import { Router } from 'express'
import { Users, Snippets, Views, Likes, Follows, ensureNickname, avatarUrl, stripSnippetSecrets, isSnippetExpired, readBadges } from '../db.js'
import { createRateLimiter } from '../rate-limit.js'
import { createSnippetForUser } from './codes.js'

// Public API for account holders — documented at /api-docs.
// Key via header X-API-Key or query ?key=. Rate-limited per key.
const router = Router()
const tooManyAttempts = createRateLimiter(60)
const tooManyUploads = createRateLimiter(15)
const tooManyPublicReads = createRateLimiter(120)

async function findByApiKey(key) {
    if (!key) return null
    const users = await Users.all()
    return users.find(u => u.apiKey === key) || null
}

// ---- No API Key required ------------------------------------------------

router.get('/snippet/:shortId', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon'
    if (tooManyPublicReads(String(ip))) return res.status(429).json({ error: 'Too many requests, try again later' })
    try {
        const snippet = await Snippets.findByShort(req.params.shortId)
        if (!snippet || !snippet.isPublic || isSnippetExpired(snippet)) {
            return res.status(404).json({ error: 'Snippet not found, private, or expired' })
        }
        const [views, likes] = await Promise.all([
            Views.count(snippet.shortId),
            Likes.count(snippet.shortId)
        ])
        res.json({ ...stripSnippetSecrets(snippet), views, likes, expired: false })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/user/:username', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon'
    if (tooManyPublicReads(String(ip))) return res.status(429).json({ error: 'Too many requests, try again later' })
    try {
        const user = await Users.find(req.params.username)
        if (!user) return res.status(404).json({ error: 'User not found' })
        const [snippets, followers, following] = await Promise.all([
            Snippets.byUserLive(user.username),
            Follows.followers(user.username),
            Follows.following(user.username)
        ])
        const publicSnippets = snippets.filter(s => s.isPublic && !isSnippetExpired(s))
        res.json({
            username: user.username,
            nickname: await ensureNickname(user),
            bio: user.bio || '',
            avatar: avatarUrl(user),
            badges: readBadges(user),
            createdAt: user.createdAt,
            counts: {
                snippets: publicSnippets.length,
                followers: followers.length,
                following: following.length
            }
        })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/user/:username/snippets', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon'
    if (tooManyPublicReads(String(ip))) return res.status(429).json({ error: 'Too many requests, try again later' })
    try {
        const user = await Users.find(req.params.username)
        if (!user) return res.status(404).json({ error: 'User not found' })
        const all = await Snippets.byUserLive(user.username)
        const publicSnippets = all.filter(s => s.isPublic && !isSnippetExpired(s))
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
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/leaderboard', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'anon'
    if (tooManyPublicReads(String(ip))) return res.status(429).json({ error: 'Too many requests, try again later' })
    try {
        // Re-use internal logic via proxy to avoid duplicating ranking math
        const base = `${req.protocol}://${req.get('host')}`
        // Direct call into users route would be cleaner, but keep self-contained:
        const users = await Users.all()
        const snippets = await Snippets.all()
        const live = snippets.filter(s => !isSnippetExpired(s) && s.isPublic)

        const uploadCount = {}
        const likeTotals = {}
        for (const s of live) {
            uploadCount[s.ownerUsername] = (uploadCount[s.ownerUsername] || 0) + 1
        }
        const shortIds = live.map(s => s.shortId)
        const likesMap = await Likes.countMany(shortIds)
        for (const s of live) {
            likeTotals[s.ownerUsername] = (likeTotals[s.ownerUsername] || 0) + (likesMap[s.shortId] || 0)
        }

        const followData = await Follows.all()
        const followerCount = {}
        for (const f of followData) {
            followerCount[f.following] = (followerCount[f.following] || 0) + 1
        }

        const userMap = new Map(users.map(u => [u.username, u]))
        function topN(countMap, n = 20) {
            return Object.entries(countMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, n)
                .map(([username, value]) => {
                    const u = userMap.get(username)
                    return {
                        username,
                        nickname: u?.nickname || username,
                        avatar: u ? avatarUrl(u) : null,
                        badges: u ? readBadges(u) : [],
                        value
                    }
                })
        }

        res.json({
            topUploaders: topN(uploadCount),
            topLiked: topN(likeTotals),
            topFollowed: topN(followerCount)
        })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

// ---- API Key required ---------------------------------------------------

router.use(async (req, res, next) => {
    const key = req.headers['x-api-key'] || req.query.key
    if (!key) return res.status(401).json({ error: 'API key required. Send via X-API-Key header or ?key=' })
    if (tooManyAttempts(String(key))) return res.status(429).json({ error: 'Too many requests, try again later' })
    const user = await findByApiKey(String(key))
    if (!user) return res.status(401).json({ error: 'Invalid API key' })
    req.apiUser = user
    next()
})

router.get('/me', async (req, res) => {
    const user = req.apiUser
    const nickname = await ensureNickname(user)
    const [snippets, followers, following] = await Promise.all([
        Snippets.byUserLive(user.username),
        Follows.followers(user.username),
        Follows.following(user.username)
    ])
    res.json({
        username: user.username,
        nickname,
        bio: user.bio || '',
        avatar: avatarUrl(user),
        badges: readBadges(user),
        createdAt: user.createdAt,
        counts: {
            snippets: snippets.length,
            public: snippets.filter(s => s.isPublic && !isSnippetExpired(s)).length,
            followers: followers.length,
            following: following.length
        }
    })
})

router.get('/snippets', async (req, res) => {
    const user = req.apiUser
    const all = await Snippets.byUserLive(user.username)
    const includePrivate = String(req.query.private || '') === '1'
    const filtered = includePrivate ? all : all.filter(s => s.isPublic)
    const [viewCounts, likeCounts] = await Promise.all([
        Views.countMany(filtered.map(s => s.shortId)),
        Likes.countMany(filtered.map(s => s.shortId))
    ])
    res.json({
        username: user.username,
        count: filtered.length,
        snippets: filtered.map(s => ({
            ...stripSnippetSecrets(s),
            views: viewCounts[s.shortId] || 0,
            likes: likeCounts[s.shortId] || 0,
            expired: isSnippetExpired(s)
        }))
    })
})

router.post('/snippets', async (req, res) => {
    if (tooManyUploads(req.apiUser.apiKey)) return res.status(429).json({ error: 'Too many uploads, try again later' })
    try {
        const snippet = await createSnippetForUser(req.apiUser.username, req.body)
        res.status(201).json({ ...stripSnippetSecrets(snippet), expired: false })
    } catch (e) {
        res.status(e.status || 500).json({ error: e.response?.data?.message || e.message })
    }
})

router.delete('/snippets/:shortId', async (req, res) => {
    try {
        const snippet = await Snippets.findByShort(req.params.shortId)
        if (!snippet) return res.status(404).json({ error: 'Snippet not found' })
        if (snippet.ownerUsername !== req.apiUser.username) {
            return res.status(403).json({ error: 'You can only delete your own snippets' })
        }
        await Snippets.remove(snippet.id)
        res.json({ ok: true, shortId: snippet.shortId })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.patch('/snippets/:shortId', async (req, res) => {
    try {
        const snippet = await Snippets.findByShort(req.params.shortId)
        if (!snippet) return res.status(404).json({ error: 'Snippet not found' })
        if (snippet.ownerUsername !== req.apiUser.username) {
            return res.status(403).json({ error: 'You can only edit your own snippets' })
        }
        // Delegate body sanitization to the same path as the web UI when possible
        const { title, description, filename, language, content, isPublic, tags, expiresAt } = req.body || {}
        const updates = {}
        if (title != null) updates.title = String(title).slice(0, 120)
        if (description != null) updates.description = String(description).slice(0, 500)
        if (filename != null) updates.filename = String(filename).slice(0, 80)
        if (language != null) updates.language = String(language)
        if (content != null) updates.content = String(content)
        if (isPublic != null) updates.isPublic = !!isPublic
        if (tags != null) {
            const list = Array.isArray(tags) ? tags : String(tags).split(',')
            updates.tags = list.map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 5)
        }
        if (expiresAt !== undefined) {
            if (expiresAt === null || expiresAt === '' || expiresAt === 0) updates.expiresAt = null
            else {
                const n = Number(expiresAt)
                updates.expiresAt = Number.isFinite(n) && n > Date.now() ? n : null
            }
        }
        const updated = await Snippets.update(snippet.id, updates)
        res.json({ ...stripSnippetSecrets(updated), expired: isSnippetExpired(updated) })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

export default router
