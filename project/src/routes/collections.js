import { Router } from 'express'
import {
    Collections, Snippets, Users, avatarUrl,
    MAX_COLLECTIONS_PER_USER, MAX_CODES_PER_COLLECTION,
    MAX_COLLECTION_TITLE, MAX_COLLECTION_DESC
} from '../db.js'
import { createRateLimiter } from '../rate-limit.js'

const router = Router()
const tooManyWrites = createRateLimiter(20)

function requireAuth(req, res, next) {
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    next()
}

function sanitizeTitle(title) {
    const t = String(title || '').trim().replace(/\s+/g, ' ')
    if (!t) return null
    return t.slice(0, MAX_COLLECTION_TITLE)
}

function sanitizeDesc(desc) {
    return String(desc || '').trim().slice(0, MAX_COLLECTION_DESC)
}

function publicView(col) {
    return {
        shortId: col.shortId,
        title: col.title,
        description: col.description || '',
        isPublic: col.isPublic !== false,
        ownerUsername: col.ownerUsername,
        shortIds: Array.isArray(col.shortIds) ? col.shortIds : [],
        count: Array.isArray(col.shortIds) ? col.shortIds.length : 0,
        createdAt: col.createdAt,
        updatedAt: col.updatedAt || col.createdAt
    }
}

/** List my collections (owner only). */
router.get('/mine', requireAuth, async (req, res) => {
    try {
        const list = await Collections.byUser(req.username)
        res.json(list.map(publicView))
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

/** List public collections of a user. */
router.get('/user/:username', async (req, res) => {
    try {
        const list = await Collections.publicByUser(req.params.username)
        // If requester is the owner, also include private ones
        if (req.username && req.username.toLowerCase() === req.params.username.toLowerCase()) {
            const all = await Collections.byUser(req.params.username)
            return res.json(all.map(publicView))
        }
        res.json(list.map(publicView))
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

/** Get one collection + its snippets (public or owner). */
router.get('/:shortId', async (req, res) => {
    try {
        const col = await Collections.findByShort(req.params.shortId)
        if (!col) return res.status(404).json({ error: 'Collection not found' })
        const isOwner = req.username && req.username.toLowerCase() === col.ownerUsername.toLowerCase()
        if (col.isPublic === false && !isOwner) {
            return res.status(403).json({ error: 'This collection is private' })
        }
        const owner = await Users.find(col.ownerUsername)
        const shortIds = Array.isArray(col.shortIds) ? col.shortIds : []
        const allSnippets = await Snippets.all()
        const byId = new Map(allSnippets.map(s => [s.shortId, s]))
        const snippets = []
        for (const id of shortIds) {
            const s = byId.get(id)
            if (!s) continue
            // Only show public codes (or own private ones) to non-owners
            if (s.isPublic === false && !isOwner && s.ownerUsername !== req.username) continue
            snippets.push({
                shortId: s.shortId,
                title: s.title,
                description: s.description || '',
                filename: s.filename,
                language: s.language,
                tags: s.tags || [],
                ownerUsername: s.ownerUsername,
                preview: s.preview,
                lineCount: s.lineCount,
                isPublic: s.isPublic !== false,
                isLocked: !!s.isLocked,
                createdAt: s.createdAt
            })
        }
        res.json({
            ...publicView(col),
            isOwner,
            ownerNickname: owner ? (owner.nickname || owner.username) : col.ownerUsername,
            ownerAvatar: avatarUrl(owner),
            snippets
        })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

/** Create collection. */
router.post('/', requireAuth, async (req, res) => {
    try {
        if (tooManyWrites(req.username)) return res.status(429).json({ error: 'Too many requests, slow down' })
        const title = sanitizeTitle(req.body?.title)
        if (!title) return res.status(400).json({ error: 'Title is required' })
        const mine = await Collections.byUser(req.username)
        if (mine.length >= MAX_COLLECTIONS_PER_USER) {
            return res.status(400).json({ error: `You can have at most ${MAX_COLLECTIONS_PER_USER} collections` })
        }
        const col = {
            shortId: await Collections.uniqueShortId(),
            ownerUsername: req.username,
            title,
            description: sanitizeDesc(req.body?.description),
            isPublic: req.body?.isPublic !== false,
            shortIds: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
        // Optional: seed with one code
        const seedId = typeof req.body?.shortId === 'string' ? req.body.shortId.trim() : ''
        if (seedId) {
            const snip = await Snippets.findByShort(seedId)
            if (snip && (snip.isPublic !== false || snip.ownerUsername === req.username)) {
                col.shortIds = [seedId]
            }
        }
        const created = await Collections.create(col)
        res.json(publicView(created))
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

/** Update title / description / visibility. */
router.patch('/:shortId', requireAuth, async (req, res) => {
    try {
        if (tooManyWrites(req.username)) return res.status(429).json({ error: 'Too many requests, slow down' })
        const col = await Collections.findByShort(req.params.shortId)
        if (!col) return res.status(404).json({ error: 'Collection not found' })
        if (col.ownerUsername.toLowerCase() !== req.username.toLowerCase()) {
            return res.status(403).json({ error: 'Not your collection' })
        }
        const patch = {}
        if (req.body?.title !== undefined) {
            const title = sanitizeTitle(req.body.title)
            if (!title) return res.status(400).json({ error: 'Title is required' })
            patch.title = title
        }
        if (req.body?.description !== undefined) patch.description = sanitizeDesc(req.body.description)
        if (req.body?.isPublic !== undefined) patch.isPublic = !!req.body.isPublic
        const updated = await Collections.update(col.shortId, patch)
        res.json(publicView(updated))
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

/** Delete collection. */
router.delete('/:shortId', requireAuth, async (req, res) => {
    try {
        const col = await Collections.findByShort(req.params.shortId)
        if (!col) return res.status(404).json({ error: 'Collection not found' })
        if (col.ownerUsername.toLowerCase() !== req.username.toLowerCase()) {
            return res.status(403).json({ error: 'Not your collection' })
        }
        await Collections.remove(col.shortId)
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

/** Add a code to a collection. */
router.post('/:shortId/codes', requireAuth, async (req, res) => {
    try {
        if (tooManyWrites(req.username)) return res.status(429).json({ error: 'Too many requests, slow down' })
        const col = await Collections.findByShort(req.params.shortId)
        if (!col) return res.status(404).json({ error: 'Collection not found' })
        if (col.ownerUsername.toLowerCase() !== req.username.toLowerCase()) {
            return res.status(403).json({ error: 'Not your collection' })
        }
        const codeId = String(req.body?.shortId || '').trim()
        if (!codeId) return res.status(400).json({ error: 'shortId is required' })
        const snip = await Snippets.findByShort(codeId)
        if (!snip) return res.status(404).json({ error: 'Code not found' })
        if (snip.isPublic === false && snip.ownerUsername !== req.username) {
            return res.status(403).json({ error: 'Cannot add private code you do not own' })
        }
        const ids = Array.isArray(col.shortIds) ? [...col.shortIds] : []
        if (ids.includes(codeId)) return res.json(publicView(col)) // already in
        if (ids.length >= MAX_CODES_PER_COLLECTION) {
            return res.status(400).json({ error: `A collection can have at most ${MAX_CODES_PER_COLLECTION} codes` })
        }
        ids.push(codeId)
        const updated = await Collections.update(col.shortId, { shortIds: ids })
        res.json(publicView(updated))
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

/** Remove a code from a collection. */
router.delete('/:shortId/codes/:codeId', requireAuth, async (req, res) => {
    try {
        const col = await Collections.findByShort(req.params.shortId)
        if (!col) return res.status(404).json({ error: 'Collection not found' })
        if (col.ownerUsername.toLowerCase() !== req.username.toLowerCase()) {
            return res.status(403).json({ error: 'Not your collection' })
        }
        const ids = (Array.isArray(col.shortIds) ? col.shortIds : []).filter(id => id !== req.params.codeId)
        const updated = await Collections.update(col.shortId, { shortIds: ids })
        res.json(publicView(updated))
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

export default router
