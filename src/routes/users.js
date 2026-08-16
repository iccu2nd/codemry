import crypto from 'crypto'
import { Router } from 'express'
import { Users, Follows, Snippets, Views, Likes, Bookmarks, avatarUrl, bannerUrl, ensureNickname, renameUsername, ensureBadges, readBadges, badgeDisplay, stripSnippetSecrets, lockedSnippetStub, Notifications } from '../db.js'
import { upsertAsset } from '../github.js'

const router = Router()

const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const ALLOWED_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

function genApiKey() {
    return `cdy_${crypto.randomBytes(24).toString('hex')}`
}

router.patch('/me', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    const user = await Users.find(req.username)
    if (!user) return res.status(401).json({ error: 'login dulu' })
    const { bio, nickname, username, hideBadges } = req.body

    try {
        if (typeof bio === 'string') await Users.update(req.username, { bio })
        if (typeof nickname === 'string' && nickname.trim()) {
            await Users.update(req.username, { nickname: nickname.trim().slice(0, 32) })
        }
        if (typeof hideBadges === 'boolean') await Users.update(req.username, { hideBadges })

        let finalUsername = req.username
        if (typeof username === 'string' && username.trim() && username.trim().toLowerCase() !== req.username.toLowerCase()) {
            const newUsername = username.trim()
            if (!/^[a-zA-Z0-9_.]{3,20}$/.test(newUsername)) {
                return res.status(400).json({ error: 'Username 3-20 karakter, cuma huruf/angka/_/. ya' })
            }
            if (user.usernameChangedAt && Date.now() - user.usernameChangedAt < USERNAME_COOLDOWN_MS) {
                const daysLeft = Math.ceil((USERNAME_COOLDOWN_MS - (Date.now() - user.usernameChangedAt)) / (24 * 60 * 60 * 1000))
                return res.status(429).json({ error: `Baru bisa ganti username lagi dalam ${daysLeft} hari` })
            }
            if (await Users.find(newUsername)) {
                return res.status(409).json({ error: 'username sudah dipakai' })
            }
            await renameUsername(req.username, newUsername)
            finalUsername = newUsername
            res.setAuthCookie(newUsername)
        }

        const updated = await Users.find(finalUsername)
        const finalNickname = await ensureNickname(updated)
        res.json({
            username: updated.username,
            bio: updated.bio,
            nickname: finalNickname,
            avatar: avatarUrl(updated),
            hideBadges: !!updated.hideBadges,
            usernameChangedAt: updated.usernameChangedAt || null
        })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message || 'Gagal update profil, coba lagi' })
    }
})

router.post('/me/avatar', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    const { imageBase64, ext } = req.body
    if (!imageBase64) return res.status(400).json({ error: 'gambar wajib' })
    const safeExt = ALLOWED_IMAGE_EXT.has(String(ext || '').toLowerCase()) ? String(ext).toLowerCase() : 'jpg'
    try {
        const path = `avatars/${req.username}.${safeExt}`
        await upsertAsset(path, imageBase64, `update avatar ${req.username}`)
        const stamp = Date.now()
        await Users.update(req.username, { avatarPath: path, avatarUpdatedAt: stamp })
        res.json({ avatar: `/avatar/${req.username}?v=${stamp}` })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.post('/me/banner', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    const { imageBase64, ext } = req.body
    if (!imageBase64) return res.status(400).json({ error: 'gambar wajib' })
    const safeExt = ALLOWED_IMAGE_EXT.has(String(ext || '').toLowerCase()) ? String(ext).toLowerCase() : 'jpg'
    try {
        const path = `banners/${req.username}.${safeExt}`
        await upsertAsset(path, imageBase64, `update banner ${req.username}`)
        const stamp = Date.now()
        await Users.update(req.username, { bannerPath: path, bannerUpdatedAt: stamp })
        res.json({ banner: `/banner/${req.username}?v=${stamp}` })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

// Cuma NGECEK status key -- TIDAK PERNAH bikin key baru di sini. Key baru
// hanya boleh dibuat kalau user secara eksplisit pencet tombol "Generate
// API Key" (lihat POST /me/apikey/generate di bawah). Ini penting biar key
// gak otomatis kebuat cuma gara-gara user buka halaman API Docs.
router.get('/me/apikey', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    try {
        const user = await Users.find(req.username)
        if (!user) return res.status(401).json({ error: 'login dulu' })
        res.json({ apiKey: user.apiKey || null, createdAt: user.apiKeyCreatedAt || null })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

// Bikin key baru -- cuma dipanggil pas user pencet tombol "Generate API
// Key" secara manual. Kalau user udah punya key, tolak dan arahkan buat
// pakai endpoint regenerate (biar gak ke-generate ulang tanpa sadar/konfirmasi).
router.post('/me/apikey/generate', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    try {
        const user = await Users.find(req.username)
        if (!user) return res.status(401).json({ error: 'login dulu' })
        if (user.apiKey) return res.status(409).json({ error: 'Kamu udah punya API key. Pakai tombol Regenerate kalau mau ganti.' })
        const apiKey = genApiKey()
        const stamp = Date.now()
        await Users.update(req.username, { apiKey, apiKeyCreatedAt: stamp })
        res.json({ apiKey, createdAt: stamp })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

// Ganti key lama dengan yang baru -- dipakai kalau user udah punya key dan
// mau regenerate. Key lama langsung invalid begitu ini dipanggil.
router.post('/me/apikey/regenerate', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    try {
        const apiKey = genApiKey()
        const stamp = Date.now()
        await Users.update(req.username, { apiKey, apiKeyCreatedAt: stamp })
        res.json({ apiKey, createdAt: stamp })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/leaderboard', async (req, res) => {
    try {
        const [users, snippets, follows, likes] = await Promise.all([
            Users.all(), Snippets.allLive(), Follows.all(), Likes.all()
        ])
        const publicSnippets = snippets.filter(s => s.isPublic)
        const likesByShortId = new Map()
        for (const l of likes) likesByShortId.set(l.shortId, (likesByShortId.get(l.shortId) || 0) + 1)
        const followerCountByUsername = new Map()
        for (const f of follows) followerCountByUsername.set(f.following, (followerCountByUsername.get(f.following) || 0) + 1)

        const uploadCount = new Map()
        const likeTotal = new Map()
        for (const s of publicSnippets) {
            uploadCount.set(s.ownerUsername, (uploadCount.get(s.ownerUsername) || 0) + 1)
            const likeN = likesByShortId.get(s.shortId) || 0
            likeTotal.set(s.ownerUsername, (likeTotal.get(s.ownerUsername) || 0) + likeN)
        }

        function toRow(username, value) {
            const u = users.find(x => x.username === username)
            if (!u) return null
            return {
                username: u.username,
                nickname: u.nickname || u.username,
                avatar: avatarUrl(u),
                ...badgeDisplay(u, readBadges(u)),
                value
            }
        }
        function topN(map, n = 10) {
            return [...map.entries()]
                .map(([username, value]) => toRow(username, value))
                .filter(Boolean)
                .sort((a, b) => b.value - a.value)
                .slice(0, n)
        }

        res.json({
            topUploaders: topN(uploadCount),
            topLiked: topN(likeTotal),
            topFollowed: topN(followerCountByUsername)
        })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/:username', async (req, res) => {
    const user = await Users.find(req.params.username)
    if (!user) return res.status(404).json({ error: 'user tidak ditemukan' })
    const [followers, following, snippets] = await Promise.all([
        Follows.followers(user.username),
        Follows.following(user.username),
        Snippets.byUserLive(user.username)
    ])
    const isFollowing = req.username ? await Follows.isFollowing(req.username, user.username) : false
    const nickname = await ensureNickname(user)
    const badges = await ensureBadges(user)
    const isMe = req.username === user.username
    const visibleSnippets = snippets.filter(s => s.isPublic || s.ownerUsername === req.username)
    const [viewCounts, likeCounts, likedByMe, savedByMeSet] = await Promise.all([
        Views.countMany(visibleSnippets.map(s => s.shortId)),
        Likes.countMany(visibleSnippets.map(s => s.shortId)),
        Likes.likedShortIds(req.username),
        Bookmarks.savedShortIds(req.username)
    ])
    const publicSnippetsOnly = visibleSnippets.filter(s => s.isPublic)
    const totalViews = publicSnippetsOnly.reduce((sum, s) => sum + (viewCounts[s.shortId] || 0), 0)
    const totalLikes = publicSnippetsOnly.reduce((sum, s) => sum + (likeCounts[s.shortId] || 0), 0)
    res.json({
        username: user.username,
        nickname,
        ...badgeDisplay(user, badges),
        hideBadges: isMe ? !!user.hideBadges : undefined,
        bio: user.bio || '',
        avatar: avatarUrl(user),
        banner: bannerUrl(user),
        createdAt: user.createdAt,
        followersCount: followers.length,
        followingCount: following.length,
        codeCount: publicSnippetsOnly.length,
        totalViews,
        totalLikes,
        snippets: visibleSnippets.map(s => {
            const isOwnerViewing = req.username && req.username === s.ownerUsername
            const base = s.isLocked && !isOwnerViewing ? lockedSnippetStub(s) : stripSnippetSecrets(s)
            return {
                ...base,
                tags: s.tags || [],
                ownerAvatar: avatarUrl(user),
                views: viewCounts[s.shortId] || 0,
                likes: likeCounts[s.shortId] || 0,
                likedByMe: likedByMe.has(s.shortId),
                savedByMe: savedByMeSet.has(s.shortId)
            }
        }),
        isFollowing,
        isMe,
        usernameChangedAt: isMe ? (user.usernameChangedAt || null) : undefined
    })
})

async function withAvatars(usernames) {
    const users = await Users.all()
    const byUsername = new Map(users.map(u => [u.username, u]))
    return usernames.map(u => ({ username: u, avatar: avatarUrl(byUsername.get(u)) }))
}

router.get('/:username/followers', async (req, res) => res.json(await withAvatars(await Follows.followers(req.params.username))))
router.get('/:username/following', async (req, res) => res.json(await withAvatars(await Follows.following(req.params.username))))

router.post('/:username/follow', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    if (req.username === req.params.username) return res.status(400).json({ error: 'tidak bisa follow diri sendiri' })
    const target = await Users.find(req.params.username)
    if (!target) return res.status(404).json({ error: 'user tidak ditemukan' })
    await Follows.toggle(req.username, target.username)
    const following = await Follows.isFollowing(req.username, target.username)
    if (following) {
        Notifications.create({ username: target.username, fromUsername: req.username, type: 'follow' }).catch(() => {})
    }
    res.json({ following })
})

export default router
