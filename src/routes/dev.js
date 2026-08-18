import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Users, Follows, Snippets, Views, Reports, REPORT_REASON_LABELS, avatarUrl, ensureNickname, ensureBadges, setBadge, BADGE_TYPES, isDeveloperUsername, isModeratorUser } from '../db.js'
import { deleteGist } from '../github.js'

const router = Router()

// Endpoint dev-panel penuh (stats, kelola user, badge, assign role) tetap khusus
// developer asli. Endpoint moderasi (laporan + hapus kode pelanggar) dibuka juga
// buat siapa pun yang role-nya 'moderator'/'admin', lewat requireModerator di bawah.
async function requireDeveloper(req, res, next) {
    if (!req.username || !isDeveloperUsername(req.username)) {
        return res.status(403).json({ error: 'cuma developer yang bisa akses ini' })
    }
    next()
}
async function requireModerator(req, res, next) {
    if (!req.username) return res.status(403).json({ error: 'cuma moderator yang bisa akses ini' })
    const user = await Users.find(req.username)
    if (!isModeratorUser(user)) return res.status(403).json({ error: 'cuma moderator yang bisa akses ini' })
    next()
}

router.get('/stats', requireDeveloper, async (req, res) => {
    const [users, snippets, views, follows, pendingReports] = await Promise.all([
        Users.all(), Snippets.all(), Views.all(), Follows.all(), Reports.pendingCount()
    ])
    res.json({
        totalUsers: users.length,
        totalSnippets: snippets.length,
        totalViews: views.length,
        totalFollows: follows.length,
        verifiedCount: users.filter(u => (Array.isArray(u.badges) ? u.badges.includes('verified') : u.badge === 'verified') || isDeveloperUsername(u.username)).length,
        pendingReports
    })
})

router.get('/reports', requireModerator, async (req, res) => {
    const [reports, snippets, users] = await Promise.all([Reports.all(), Snippets.all(), Users.all()])
    const snippetByShort = new Map(snippets.map(s => [s.shortId, s]))
    const userByUsername = new Map(users.map(u => [u.username, u]))
    const rows = reports.map(r => {
        const snippet = snippetByShort.get(r.shortId)
        const reporter = userByUsername.get(r.fromUsername)
        return {
            id: r.id,
            status: r.status,
            reason: r.reason,
            reasonLabel: REPORT_REASON_LABELS[r.reason] || r.reason,
            detail: r.detail || '',
            createdAt: r.createdAt,
            shortId: r.shortId,
            snippetExists: !!snippet,
            snippetTitle: snippet ? (snippet.title || snippet.filename) : '(kode sudah dihapus)',
            ownerUsername: r.ownerUsername,
            fromUsername: r.fromUsername,
            fromNickname: reporter ? (reporter.nickname || reporter.username) : r.fromUsername
        }
    })
    rows.sort((a, b) => b.createdAt - a.createdAt)
    res.json(rows)
})

router.post('/reports/:id/status', requireModerator, async (req, res) => {
    const status = String(req.body.status || '')
    if (!['pending', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'status tidak valid' })
    await Reports.setStatus(req.params.id, status)
    res.json({ ok: true })
})

const BADGE_CATALOG = [
    { id: 'verified', label: 'Verified' },
    { id: 'staff', label: 'Staff' },
    { id: 'contributor', label: 'Contributor' },
    { id: 'supporter', label: 'Supporter' }
]
router.get('/badge-types', requireDeveloper, (req, res) => res.json(BADGE_CATALOG))

router.get('/users', requireDeveloper, async (req, res) => {
    const [users, snippets, viewsAll] = await Promise.all([Users.all(), Snippets.all(), Views.all()])
    const viewsBySnippet = new Map()
    for (const v of viewsAll) viewsBySnippet.set(v.shortId, (viewsBySnippet.get(v.shortId) || 0) + 1)

    const rows = await Promise.all(users.map(async (u) => {
        const nickname = await ensureNickname(u)
        const badges = await ensureBadges(u)
        const userSnippets = snippets.filter(s => s.ownerUsername === u.username)
        const totalViews = userSnippets.reduce((sum, s) => sum + (viewsBySnippet.get(s.shortId) || 0), 0)
        return {
            username: u.username,
            nickname,
            badges,
            role: u.role || null,
            isDeveloper: isDeveloperUsername(u.username),
            avatar: avatarUrl(u),
            createdAt: u.createdAt || null,
            snippetCount: userSnippets.length,
            totalViews
        }
    }))
    rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    res.json(rows)
})

router.post('/users/:username/badges/:badgeId', requireDeveloper, async (req, res) => {
    if (!BADGE_TYPES.includes(req.params.badgeId)) return res.status(400).json({ error: 'jenis lencana tidak dikenal' })
    if (!(await Users.find(req.params.username))) return res.status(404).json({ error: 'user tidak ditemukan' })
    try {
        const badges = await setBadge(req.params.username, req.params.badgeId, !!req.body.enabled)
        res.json({ username: req.params.username, badges })
    } catch (e) {
        res.status(400).json({ error: e.message })
    }
})

router.post('/users/:username/badge', requireDeveloper, async (req, res) => {
    if (!(await Users.find(req.params.username))) return res.status(404).json({ error: 'user tidak ditemukan' })
    const badges = await setBadge(req.params.username, 'verified', req.body.badge === 'verified')
    res.json({ username: req.params.username, badges })
})

router.post('/users/:username/role', requireDeveloper, async (req, res) => {
    const target = await Users.find(req.params.username)
    if (!target) return res.status(404).json({ error: 'user tidak ditemukan' })
    const role = typeof req.body.role === 'string' ? req.body.role.trim().slice(0, 24) : ''
    await Users.update(target.username, { role: role || null })
    res.json({ username: target.username, role: role || null })
})

router.post('/users/:username/password', requireDeveloper, async (req, res) => {
    const target = await Users.find(req.params.username)
    if (!target) return res.status(404).json({ error: 'user tidak ditemukan' })
    const password = typeof req.body.password === 'string' ? req.body.password : ''
    if (password.length < 6) return res.status(400).json({ error: 'password minimal 6 karakter' })
    if (isDeveloperUsername(target.username) && target.username !== req.username) {
        return res.status(403).json({ error: 'gak bisa ganti password sesama developer' })
    }
    const passwordHash = await bcrypt.hash(password, 10)
    await Users.update(target.username, { passwordHash })
    res.json({ ok: true, username: target.username })
})

router.delete('/snippets/:shortId', requireModerator, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'tidak ditemukan' })
    try {
        await deleteGist(snippet.id)
        await Snippets.remove(snippet.id)
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

export default router
