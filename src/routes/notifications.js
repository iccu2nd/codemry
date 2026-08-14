import { Router } from 'express'
import { Notifications, Users, Snippets, avatarUrl } from '../db.js'

const router = Router()

function requireAuth(req, res, next) {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    next()
}

const TEXT_BY_TYPE = {
    like: 'menyukai kode kamu',
    comment: 'mengomentari kode kamu',
    reply: 'membalas komentar kamu',
    follow: 'mulai mengikuti kamu',
    fork: 'nge-fork kode kamu',
    report: 'melaporkan sebuah kode',
    upload: 'mengupload kode baru'
}

router.get('/', requireAuth, async (req, res) => {
    try {
        const [list, users, snippets] = await Promise.all([
            Notifications.forUser(req.username, 60),
            Users.all(),
            Snippets.all()
        ])
        const userByUsername = new Map(users.map(u => [u.username, u]))
        const snippetByShort = new Map(snippets.map(s => [s.shortId, s]))
        res.json(list.map(n => {
            const fromUser = userByUsername.get(n.fromUsername)
            const snippet = n.shortId ? snippetByShort.get(n.shortId) : null
            return {
                id: n.id,
                type: n.type,
                read: !!n.read,
                createdAt: n.createdAt,
                text: TEXT_BY_TYPE[n.type] || 'berinteraksi dengan kamu',
                fromUsername: n.fromUsername,
                fromNickname: fromUser?.nickname || n.fromUsername,
                fromAvatar: fromUser ? avatarUrl(fromUser) : null,
                shortId: n.shortId || null,
                snippetTitle: snippet ? (snippet.title || snippet.filename) : null
            }
        }))
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/unread-count', requireAuth, async (req, res) => {
    try {
        res.json({ count: await Notifications.unreadCount(req.username) })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.post('/:id/read', requireAuth, async (req, res) => {
    try {
        await Notifications.markRead(req.username, req.params.id)
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.post('/read-all', requireAuth, async (req, res) => {
    try {
        await Notifications.markAllRead(req.username)
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

export default router
