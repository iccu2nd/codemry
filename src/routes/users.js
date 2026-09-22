import crypto from 'crypto'
import { Router } from 'express'
import { Users, Follows, Snippets, Views, Likes, Bookmarks, avatarUrl, bannerUrl, ensureNickname, renameUsername, ensureBadges, readBadges, badgeDisplay, stripSnippetSecrets, lockedSnippetStub, isSnippetExpired, expiredSnippetStub, Notifications, MAX_PINS, normalizePins } from '../db.js'
import { upsertAsset } from '../github.js'

const router = Router()

const USERNAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const ALLOWED_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

function genApiKey() {
    return `cdy_${crypto.randomBytes(24).toString('hex')}`
}

router.patch('/me', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    const user = await Users.find(req.username)
    if (!user) return res.status(401).json({ error: 'Please sign in' })
    const { bio, nickname, username, hideBadges, profileMusic } = req.body

    try {
        if (typeof bio === 'string') await Users.update(req.username, { bio })
        if (typeof nickname === 'string' && nickname.trim()) {
            await Users.update(req.username, { nickname: nickname.trim().slice(0, 32) })
        }
        if (typeof hideBadges === 'boolean') await Users.update(req.username, { hideBadges })
        if (typeof profileMusic === 'string') {
            const url = profileMusic.trim()
            if (url && !/^https?:\/\//i.test(url)) {
                return res.status(400).json({ error: 'Music URL must start with http:// or https://' })
            }
            if (url.length > 500) {
                return res.status(400).json({ error: 'Music URL is too long' })
            }
            await Users.update(req.username, { profileMusic: url || null })
        }

        let finalUsername = req.username
        if (typeof username === 'string' && username.trim() && username.trim().toLowerCase() !== req.username.toLowerCase()) {
            const newUsername = username.trim()
            if (!/^[a-zA-Z0-9_.]{3,20}$/.test(newUsername)) {
                return res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, _ or .)' })
            }
            if (user.usernameChangedAt && Date.now() - user.usernameChangedAt < USERNAME_COOLDOWN_MS) {
                const daysLeft = Math.ceil((USERNAME_COOLDOWN_MS - (Date.now() - user.usernameChangedAt)) / (24 * 60 * 60 * 1000))
                return res.status(429).json({ error: `You can change username again in ${daysLeft} day(s)` })
            }
            if (await Users.find(newUsername)) {
                return res.status(409).json({ error: 'Username is taken' })
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
            profileMusic: updated.profileMusic || null,
            avatar: avatarUrl(updated),
            hideBadges: !!updated.hideBadges,
            usernameChangedAt: updated.usernameChangedAt || null
        })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message || 'Could not update profile, try again' })
    }
})

router.post('/me/avatar', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    const { imageBase64, ext } = req.body
    if (!imageBase64) return res.status(400).json({ error: 'Image is required' })
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
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    const { imageBase64, ext } = req.body
    if (!imageBase64) return res.status(400).json({ error: 'Image is required' })
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
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    try {
        const user = await Users.find(req.username)
        if (!user) return res.status(401).json({ error: 'Please sign in' })
        res.json({ apiKey: user.apiKey || null, createdAt: user.apiKeyCreatedAt || null })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

// Bikin key baru -- cuma dipanggil pas user pencet tombol "Generate API
// Key" secara manual. Kalau user udah punya key, tolak dan arahkan buat
// pakai endpoint regenerate (biar gak ke-generate ulang tanpa sadar/konfirmasi).
router.post('/me/apikey/generate', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    try {
        const user = await Users.find(req.username)
        if (!user) return res.status(401).json({ error: 'Please sign in' })
        if (user.apiKey) return res.status(409).json({ error: 'You already have an API key. Use Regenerate to change it.' })
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
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
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
            Users.all(), Snippets.allPublic(), Follows.all(), Likes.all()
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

router.get('/contributors', async (req, res) => {
    try {
        const users = await Users.all()
        const list = users
            .filter(u => readBadges(u).includes('contributor'))
            .map(u => ({
                username: u.username,
                nickname: u.nickname || u.username,
                avatar: avatarUrl(u),
                badges: readBadges(u),
                ...badgeDisplay(u, readBadges(u))
            }))
            .sort((a, b) => a.nickname.localeCompare(b.nickname))
        res.json(list)
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})


// Pin / unpin own code on profile (max MAX_PINS)
router.post('/me/pins', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    const shortId = String(req.body?.shortId || '').trim()
    if (!shortId) return res.status(400).json({ error: 'shortId is required' })
    try {
        const snippet = await Snippets.findByShort(shortId)
        if (!snippet) return res.status(404).json({ error: 'Code not found' })
        if (snippet.ownerUsername.toLowerCase() !== req.username.toLowerCase()) {
            return res.status(403).json({ error: 'You can only pin your own code' })
        }
        const user = await Users.find(req.username)
        const pins = normalizePins(user?.pinnedShortIds)
        if (pins.includes(shortId)) {
            return res.json({ pinnedShortIds: pins, pinned: true })
        }
        if (pins.length >= MAX_PINS) {
            return res.status(400).json({ error: `You can pin up to ${MAX_PINS} codes` })
        }
        const next = normalizePins([shortId, ...pins])
        await Users.update(req.username, { pinnedShortIds: next })
        res.json({ pinnedShortIds: next, pinned: true })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

router.delete('/me/pins/:shortId', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    try {
        const user = await Users.find(req.username)
        const shortId = String(req.params.shortId || '')
        const next = normalizePins(user?.pinnedShortIds).filter(id => id !== shortId)
        await Users.update(req.username, { pinnedShortIds: next })
        res.json({ pinnedShortIds: next, pinned: false })
    } catch (e) {
        res.status(500).json({ error: e.message })
    }
})

router.get('/:username', async (req, res) => {
    const user = await Users.find(req.params.username)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const [followers, following, snippets] = await Promise.all([
        Follows.followers(user.username),
        Follows.following(user.username),
        Snippets.byUserLive(user.username)
    ])
    const isFollowing = req.username ? await Follows.isFollowing(req.username, user.username) : false
    const nickname = await ensureNickname(user)
    const badges = await ensureBadges(user)
    const isMe = req.username === user.username
    // Kode yang udah kadaluarsa disembunyiin dari profil buat siapa pun
    // KECUALI pemiliknya sendiri (biar masih bisa dikelola/diperpanjang).
    const visibleSnippets = snippets.filter(s =>
        (s.isPublic || s.ownerUsername === req.username) && (isMe || !isSnippetExpired(s))
    )
    const [viewCounts, likeCounts, likedByMe, savedByMeSet] = await Promise.all([
        Views.countMany(visibleSnippets.map(s => s.shortId)),
        Likes.countMany(visibleSnippets.map(s => s.shortId)),
        Likes.likedShortIds(req.username),
        Bookmarks.savedShortIds(req.username)
    ])
    // Stats (jumlah kode/views/likes publik) selalu ngitung yang masih hidup
    // aja, konsisten buat semua orang yang liat profil ini -- gak ikut
    // berubah cuma gara-gara yang liat kebetulan pemiliknya.
    const publicSnippetsOnly = visibleSnippets.filter(s => s.isPublic && !isSnippetExpired(s))
    const totalViews = publicSnippetsOnly.reduce((sum, s) => sum + (viewCounts[s.shortId] || 0), 0)
    const totalLikes = publicSnippetsOnly.reduce((sum, s) => sum + (likeCounts[s.shortId] || 0), 0)
    res.json({
        username: user.username,
        nickname,
        ...badgeDisplay(user, badges),
        hideBadges: isMe ? !!user.hideBadges : undefined,
        bio: user.bio || '',
        profileMusic: user.profileMusic || null,
        avatar: avatarUrl(user),
        banner: bannerUrl(user),
        createdAt: user.createdAt,
        followersCount: followers.length,
        followingCount: following.length,
        codeCount: publicSnippetsOnly.length,
        totalViews,
        totalLikes,
        snippets: (() => {
            const pinOrder = normalizePins(user.pinnedShortIds)
            const pinSet = new Set(pinOrder)
            const mapped = visibleSnippets.map(s => {
                const isOwnerViewing = req.username && req.username === s.ownerUsername
                const base = s.isLocked && !isOwnerViewing ? lockedSnippetStub(s) : stripSnippetSecrets(s)
                return {
                    ...base,
                    tags: s.tags || [],
                    ownerAvatar: avatarUrl(user),
                    views: viewCounts[s.shortId] || 0,
                    likes: likeCounts[s.shortId] || 0,
                    likedByMe: likedByMe.has(s.shortId),
                    savedByMe: savedByMeSet.has(s.shortId),
                    pinned: pinSet.has(s.shortId)
                }
            })
            // Pinned codes first, in pin order
            mapped.sort((a, b) => {
                const ai = pinOrder.indexOf(a.shortId)
                const bi = pinOrder.indexOf(b.shortId)
                if (ai === -1 && bi === -1) return (b.createdAt || 0) - (a.createdAt || 0)
                if (ai === -1) return 1
                if (bi === -1) return -1
                return ai - bi
            })
            return mapped
        })(),
        pinnedShortIds: normalizePins(user.pinnedShortIds),
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
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    if (req.username === req.params.username) return res.status(400).json({ error: 'tidak bisa follow diri sendiri' })
    const target = await Users.find(req.params.username)
    if (!target) return res.status(404).json({ error: 'User not found' })
    await Follows.toggle(req.username, target.username)
    const following = await Follows.isFollowing(req.username, target.username)
    if (following) {
        Notifications.create({ username: target.username, fromUsername: req.username, type: 'follow' }).catch(() => {})
    }
    res.json({ following })
})

export default router
