import { Router } from 'express'
import crypto from 'crypto'
import { Snippets, Users, Views, Likes, Comments, Bookmarks, Notifications, Reports, Follows, REPORT_REASONS, DEV_USERNAME, avatarUrl, readBadges, badgeDisplay, hashPin, verifyPin, stripSnippetSecrets, lockedSnippetStub, isDeveloperUsername, isSnippetExpired, expiredSnippetStub } from '../db.js'
import { createGist, getGist, editGist, deleteGist, listGists, getGistCommits, getGistAtRevision } from '../github.js'
import { createRateLimiter } from '../rate-limit.js'

const router = Router()
const PIN_RE = /^[a-zA-Z0-9]{4,8}$/
const tooManyAttempts = createRateLimiter(8)
const tooManyReports = createRateLimiter(5)

function requireAuth(req, res, next) {
    if (!req.username) return res.status(401).json({ error: 'Please sign in' })
    next()
}

// Cuma URL dari domain CDN Tenor ATAU Giphy yang boleh disimpan sebagai stiker
// komentar -- mencegah orang nyelundupin URL sembarangan (tracking pixel,
// gambar ngajak/phishing, dll) lewat field ini.
//
// BUG SEBELUMNYA: cuma tenor.com yang diloloskan, padahal picker stiker
// (lihat tenor.js + giphy.js) sekarang narik dari DUA sumber yang
// diselang-seling, dan GIPHY dijadiin sumber UTAMA-nya. Jadi tiap kali user
// milih stiker yang kebetulan dari Giphy (media*.giphy.com), request
// simpan komentarnya ditolak diam-diam sama validasi ini (400 "stiker
// tidak valid") -- makanya kerasa kayak "komentar stiker ilang": user udah
// pencet kirim, tapi komentarnya emang gak pernah kesimpen sama sekali.
function isValidStickerUrl(url) {
    if (typeof url !== 'string' || !url) return false
    try {
        const u = new URL(url)
        return u.protocol === 'https:' && /(^|\.)(tenor|giphy)\.com$/.test(u.hostname)
    } catch { return false }
}

const EXT_LANG = {
    js: 'javascript', ts: 'typescript', py: 'python', html: 'html', css: 'css',
    json: 'json', java: 'java', php: 'php', sh: 'bash', md: 'markdown', txt: 'text'
}
const ALLOWED_LANGUAGES = new Set([...Object.values(EXT_LANG), 'text'])
function sanitizeLanguage(lang) {
    return ALLOWED_LANGUAGES.has(String(lang || '')) ? lang : 'text'
}

function buildPreview(content) {
    if (!content) return ''
    const lines = content.split('\n')
    let start = 0
    while (start < lines.length && lines[start].trim() === '') start++
    // 12 baris / max 420 char → feed JSON lebih ringan (hemat kuota + load lebih cepat)
    const preview = lines.slice(start, start + 12).join('\n')
    return preview.length > 420 ? preview.slice(0, 420) : preview
}

function countLines(content) {
    if (!content) return 0
    return String(content).split('\n').length
}

function sanitizeTags(input) {
    // Terima campuran koma, spasi, dan/atau tanda # sebagai pemisah tag,
    // jadi "algoritma, tutorial" maupun "#algoritma #tutorial" sama-sama valid.
    const raw = Array.isArray(input) ? input : String(input || '').split(/[,\s]+/)
    const cleaned = raw
        .map(t => String(t || '').trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9-]/g, ''))
        .filter(Boolean)
        .map(t => t.slice(0, 20))
    return [...new Set(cleaned)].slice(0, 5)
}

function sanitizeDescription(input) {
    return String(input || '').slice(0, 500)
}

// Fitur expired code: `expiresAt` dikirim sebagai timestamp ms (epoch) dari
// klien, dihitung dari preset durasi (1 jam/1 hari/dst) yang dipilih pas
// upload/edit. Aturan sanitasi:
// - undefined  -> "gak dikirim / gak diubah" (dipakai buat PATCH: biarin apa adanya)
// - null/''/0  -> permanen (hapus expiry)
// - timestamp di masa lalu / gak valid -> dianggap permanen (fail-safe, biar
//   gak ada kode yang KEBURU expired sebelum sempat dipublish)
// - dibatasi maksimal 5 tahun ke depan biar gak ada nilai liar
const MAX_EXPIRY_MS = 5 * 365 * 24 * 60 * 60 * 1000
function sanitizeExpiresAt(input) {
    if (input === undefined) return undefined
    if (input === null || input === '' || input === 0 || input === '0') return null
    const n = Number(input)
    if (!Number.isFinite(n)) return null
    const now = Date.now()
    if (n <= now) return null
    return Math.min(n, now + MAX_EXPIRY_MS)
}

// Bentuk representasi publik sebuah snippet tergantung siapa yang lihat:
// - kode yang udah expired & yang lihat BUKAN pemiliknya -> stub tanpa isi
// - kode terkunci password & yang lihat BUKAN pemiliknya -> stub tanpa isi
// - selain itu -> data lengkap (minus pinHash)
// Flag `expired` selalu disertakan biar frontend bisa nampilin badge/notice,
// termasuk buat pemilik yang lagi liat kode miliknya sendiri yang kadaluarsa.
function snippetBase(snippet, isOwner) {
    const expired = isSnippetExpired(snippet)
    if (expired && !isOwner) return { ...expiredSnippetStub(snippet), expired }
    if (snippet.isLocked && !isOwner) return { ...lockedSnippetStub(snippet), expired }
    return { ...stripSnippetSecrets(snippet), expired }
}

router.post('/import', requireAuth, async (req, res) => {
    if (!isDeveloperUsername(req.username)) return res.status(403).json({ error: 'cuma developer yang bisa import gist lama' })
    try {
        const gists = await listGists()
        const existing = await Snippets.all()
        const existingIds = new Set(existing.map(s => s.id))
        let imported = 0
        for (const gist of gists) {
            if (existingIds.has(gist.id)) continue
            const files = Object.entries(gist.files)
            if (!files.length) continue
            const [filename, file] = files[0]
            const ext = filename.split('.').pop().toLowerCase()
            const snippet = {
                id: gist.id,
                shortId: await Snippets.uniqueShortId(),
                title: gist.description || filename,
                description: '',
                filename,
                language: EXT_LANG[ext] || 'text',
                ownerUsername: req.username,
                isPublic: !!gist.public,
                rawUrl: file.raw_url,
                htmlUrl: gist.html_url,
                preview: buildPreview(file.content),
                lineCount: countLines(file.content),
                createdAt: new Date(gist.created_at).getTime()
            }
            await Snippets.create(snippet)
            imported++
        }
        res.json({ imported, total: gists.length })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

export async function createSnippetForUser(username, body) {
    const { title, filename, content, language, isPublic, description, tags, pin, expiresAt } = body
    if (!content || !filename) { const e = new Error('filename & content wajib'); e.status = 400; throw e }
    const trimmedPin = typeof pin === 'string' ? pin.trim() : ''
    if (trimmedPin && !PIN_RE.test(trimmedPin)) { const e = new Error('Password must be 4-8 characters (letters/numbers)'); e.status = 400; throw e }
    const gist = await createGist({ [filename]: { content } }, title || filename, !!isPublic)
    const file = gist.files[filename]
    const snippet = {
        id: gist.id,
        shortId: await Snippets.uniqueShortId(),
        title: title || filename,
        description: sanitizeDescription(description),
        filename,
        language: sanitizeLanguage(language),
        tags: sanitizeTags(tags),
        ownerUsername: username,
        isPublic: !!isPublic,
        isLocked: !!trimmedPin,
        pinHash: trimmedPin ? await hashPin(trimmedPin) : null,
        // Default permanen (expiresAt: null). Cuma kepasang kalau user milih
        // durasi expired pas upload.
        expiresAt: sanitizeExpiresAt(expiresAt) || null,
        rawUrl: file.raw_url,
        htmlUrl: gist.html_url,
        preview: buildPreview(content),
        lineCount: countLines(content),
        createdAt: Date.now()
    }
    await Snippets.create(snippet)
    if (snippet.isPublic) {
        Follows.followers(username).then(followers => {
            followers.forEach(follower => {
                Notifications.create({ username: follower, fromUsername: username, type: 'upload', shortId: snippet.shortId }).catch(() => {})
            })
        }).catch(() => {})
    }
    return snippet
}

router.post('/', requireAuth, async (req, res) => {
    try {
        const snippet = await createSnippetForUser(req.username, req.body)
        res.json({ ...stripSnippetSecrets(snippet), expired: false })
    } catch (e) {
        const raw = e.response?.data?.message || e.message || ''
        const friendly = /expected|is at [a-f0-9]|conflict/i.test(raw)
            ? 'Upload failed due to a temporary conflict. Please try again.'
            : (raw || 'Upload failed')
        res.status(e.status || 500).json({ error: friendly })
    }
})

router.get('/', async (req, res) => {
    try {
        const [live, users] = await Promise.all([Snippets.allPublic(), Users.all()])
        const avatarByUsername = new Map(users.map(u => [u.username, avatarUrl(u)]))
        const nicknameByUsername = new Map(users.map(u => [u.username, u.nickname || u.username]))
        const displayByUsername = new Map(users.map(u => [u.username, badgeDisplay(u, readBadges(u))]))
        // Kode yang udah kadaluarsa gak ditampilin lagi di feed publik buat
        // siapa pun (termasuk pemiliknya sendiri) -- feed cuma nampilin kode
        // yang masih "hidup". Pemilik masih bisa lihat & kelola kode expired
        // miliknya lewat profil/halaman kode langsung.
        const publicSnippets = live.filter(s => s.isPublic && !isSnippetExpired(s))
        const [viewCounts, likeCounts, likedByMe, savedByMeSet] = await Promise.all([
            Views.countMany(publicSnippets.map(s => s.shortId)),
            Likes.countMany(publicSnippets.map(s => s.shortId)),
            Likes.likedShortIds(req.username),
            Bookmarks.savedShortIds(req.username)
        ])
        res.json(publicSnippets.map(s => {
            const display = displayByUsername.get(s.ownerUsername) || { badges: [], role: null, isDeveloper: false }
            const isOwner = req.username && req.username === s.ownerUsername
            const base = snippetBase(s, isOwner)
            return {
                ...base,
                tags: s.tags || [],
                ownerAvatar: avatarByUsername.get(s.ownerUsername) || null,
                ownerNickname: nicknameByUsername.get(s.ownerUsername) || s.ownerUsername,
                ownerRole: display.role,
                ownerBadges: display.badges,
                ownerIsDeveloper: display.isDeveloper,
                views: viewCounts[s.shortId] || 0,
                likes: likeCounts[s.shortId] || 0,
                likedByMe: likedByMe.has(s.shortId),
                savedByMe: savedByMeSet.has(s.shortId)
            }
        }))
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/liked', requireAuth, async (req, res) => {
    try {
        const likedIds = await Likes.likedShortIds(req.username)
        const [live, users] = await Promise.all([Snippets.allPublic(), Users.all()])
        const avatarByUsername = new Map(users.map(u => [u.username, avatarUrl(u)]))
        const nicknameByUsername = new Map(users.map(u => [u.username, u.nickname || u.username]))
        const displayByUsername = new Map(users.map(u => [u.username, badgeDisplay(u, readBadges(u))]))
        const liked = live.filter(s => likedIds.has(s.shortId) && s.isPublic)
        const [viewCounts, likeCounts] = await Promise.all([
            Views.countMany(liked.map(s => s.shortId)),
            Likes.countMany(liked.map(s => s.shortId))
        ])
        res.json(liked.map(s => {
            const display = displayByUsername.get(s.ownerUsername) || { badges: [], role: null, isDeveloper: false }
            const isOwner = req.username === s.ownerUsername
            const base = snippetBase(s, isOwner)
            return {
                ...base,
                tags: s.tags || [],
                ownerAvatar: avatarByUsername.get(s.ownerUsername) || null,
                ownerNickname: nicknameByUsername.get(s.ownerUsername) || s.ownerUsername,
                ownerRole: display.role,
                ownerBadges: display.badges,
                ownerIsDeveloper: display.isDeveloper,
                views: viewCounts[s.shortId] || 0,
                likes: likeCounts[s.shortId] || 0,
                likedByMe: true
            }
        }))
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/bookmarked', requireAuth, async (req, res) => {
    try {
        const savedIds = await Bookmarks.savedShortIds(req.username)
        const [live, users] = await Promise.all([Snippets.allPublic(), Users.all()])
        const avatarByUsername = new Map(users.map(u => [u.username, avatarUrl(u)]))
        const nicknameByUsername = new Map(users.map(u => [u.username, u.nickname || u.username]))
        const displayByUsername = new Map(users.map(u => [u.username, badgeDisplay(u, readBadges(u))]))
        const saved = live.filter(s => savedIds.has(s.shortId) && s.isPublic)
        const [viewCounts, likeCounts, likedByMe] = await Promise.all([
            Views.countMany(saved.map(s => s.shortId)),
            Likes.countMany(saved.map(s => s.shortId)),
            Likes.likedShortIds(req.username)
        ])
        res.json(saved.map(s => {
            const display = displayByUsername.get(s.ownerUsername) || { badges: [], role: null, isDeveloper: false }
            const isOwner = req.username === s.ownerUsername
            const base = snippetBase(s, isOwner)
            return {
                ...base,
                tags: s.tags || [],
                ownerAvatar: avatarByUsername.get(s.ownerUsername) || null,
                ownerNickname: nicknameByUsername.get(s.ownerUsername) || s.ownerUsername,
                ownerRole: display.role,
                ownerBadges: display.badges,
                ownerIsDeveloper: display.isDeveloper,
                views: viewCounts[s.shortId] || 0,
                likes: likeCounts[s.shortId] || 0,
                likedByMe: likedByMe.has(s.shortId),
                savedByMe: true
            }
        }))
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/:shortId', async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    const isOwner = req.username && req.username === snippet.ownerUsername
    const owner = await Users.find(snippet.ownerUsername)
    const ownerDisplay = badgeDisplay(owner, owner ? readBadges(owner) : [])
    const ownerAvatar = owner ? avatarUrl(owner) : null
    const ownerNickname = owner ? (owner.nickname || owner.username) : null
    let forkedFrom = null
    if (snippet.forkedFrom) {
        const origOwner = await Users.find(snippet.forkedFrom.ownerUsername)
        forkedFrom = {
            shortId: snippet.forkedFrom.shortId,
            ownerUsername: snippet.forkedFrom.ownerUsername,
            ownerNickname: origOwner ? (origOwner.nickname || origOwner.username) : snippet.forkedFrom.ownerUsername
        }
    }

    // Kode kadaluarsa dicek DULUAN sebelum status terkunci -- begitu lewat
    // waktu expired-nya, konten gak lagi bisa diakses siapa pun kecuali
    // pemiliknya sendiri (yang mana bakal ketemu jalur "unlocked" di bawah
    // dan cuma dikasih tau lewat flag `expired`, bukan diblokir).
    if (isSnippetExpired(snippet) && !isOwner) {
        const [views, likes, likedByMe, savedByMe] = await Promise.all([
            Views.count(snippet.shortId),
            Likes.count(snippet.shortId),
            Likes.hasLiked(req.username, snippet.shortId),
            Bookmarks.hasSaved(req.username, snippet.shortId)
        ])
        return res.json({
            ...expiredSnippetStub(snippet), tags: snippet.tags || [], content: null, expired: true,
            views, likes, likedByMe, savedByMe, forkedFrom,
            ownerBadges: ownerDisplay.badges, ownerAvatar, ownerNickname, ownerRole: ownerDisplay.role, ownerIsDeveloper: ownerDisplay.isDeveloper
        })
    }

    if (snippet.isLocked && !isOwner) {
        const [views, likes, likedByMe, savedByMe] = await Promise.all([
            Views.count(snippet.shortId),
            Likes.count(snippet.shortId),
            Likes.hasLiked(req.username, snippet.shortId),
            Bookmarks.hasSaved(req.username, snippet.shortId)
        ])
        return res.json({
            ...lockedSnippetStub(snippet), tags: snippet.tags || [], content: null, expired: false,
            views, likes, likedByMe, savedByMe, forkedFrom,
            ownerBadges: ownerDisplay.badges, ownerAvatar, ownerNickname, ownerRole: ownerDisplay.role, ownerIsDeveloper: ownerDisplay.isDeveloper
        })
    }

    // Record the view in the background. Never let a views.json SHA conflict
    // (common right after upload under concurrent traffic) break the code page.
    Views.register(snippet.shortId, req.ip).catch(() => {})
    try {
        const gist = await getGist(snippet.id)
        const file = gist.files[snippet.filename]
        const content = file?.content || ''
        const lineCount = countLines(content)
        // Backfill lineCount for older snippets so feed cards can show real counts later
        if (content && snippet.lineCount !== lineCount) {
            Snippets.update(snippet.id, { lineCount }).catch(() => {})
        }
        const [views, likes, likedByMe, savedByMe] = await Promise.all([
            Views.count(snippet.shortId),
            Likes.count(snippet.shortId),
            Likes.hasLiked(req.username, snippet.shortId),
            Bookmarks.hasSaved(req.username, snippet.shortId)
        ])
        res.json({
            ...stripSnippetSecrets(snippet), tags: snippet.tags || [], content, lineCount, views, likes, likedByMe, savedByMe, forkedFrom,
            locked: !!snippet.isLocked,
            expired: isSnippetExpired(snippet),
            ownerBadges: ownerDisplay.badges, ownerAvatar, ownerNickname, ownerRole: ownerDisplay.role, ownerIsDeveloper: ownerDisplay.isDeveloper
        })
    } catch (e) {
        if (e.response?.status === 404) return res.status(404).json({ error: 'This code was deleted from GitHub Gist' })
        // Don't leak raw GitHub SHA conflict messages to the UI
        const raw = e.response?.data?.message || e.message || ''
        const friendly = /expected|is at [a-f0-9]/i.test(raw)
            ? 'Could not load code right now. Please refresh.'
            : (raw || 'Failed to load code')
        res.status(500).json({ error: friendly })
    }
})

router.post('/:shortId/unlock', async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    if (isSnippetExpired(snippet) && req.username !== snippet.ownerUsername) return res.status(410).json({ error: 'This code has expired' })
    if (!snippet.isLocked) return res.status(400).json({ error: 'This code is not locked' })
    const key = `${req.ip}:${snippet.shortId}`
    if (tooManyAttempts(key)) return res.status(429).json({ error: 'Too many attempts, try again later' })
    const ok = await verifyPin(req.body.pin, snippet.pinHash)
    if (!ok) return res.status(403).json({ error: 'Wrong password' })
    try {
        Views.register(snippet.shortId, req.ip).catch(() => {})
        const [gist, owner] = await Promise.all([
            getGist(snippet.id),
            Users.find(snippet.ownerUsername)
        ])
        const file = gist.files[snippet.filename]
        const [views, likes, likedByMe] = await Promise.all([
            Views.count(snippet.shortId),
            Likes.count(snippet.shortId),
            Likes.hasLiked(req.username, snippet.shortId)
        ])
        const ownerDisplay = badgeDisplay(owner, owner ? readBadges(owner) : [])
        res.json({
            ...stripSnippetSecrets(snippet), tags: snippet.tags || [], content: file?.content || '', views, likes, likedByMe,
            locked: true, expired: false,
            ownerBadges: ownerDisplay.badges, ownerAvatar: owner ? avatarUrl(owner) : null, ownerNickname: owner ? (owner.nickname || owner.username) : null, ownerRole: ownerDisplay.role, ownerIsDeveloper: ownerDisplay.isDeveloper
        })
    } catch (e) {
        if (e.response?.status === 404) return res.status(404).json({ error: 'This code was deleted from GitHub Gist' })
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.patch('/:shortId', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    if (snippet.ownerUsername !== req.username) return res.status(403).json({ error: 'bukan milikmu' })

    const { title, description, filename, language, content, isPublic, tags, pin, removePin, expiresAt } = req.body
    const newFilename = filename && filename.trim() ? filename.trim() : snippet.filename
    const newTitle = title !== undefined ? (title.trim() || snippet.filename) : snippet.title
    const contentChanged = content !== undefined && content !== null
    const filenameChanged = newFilename !== snippet.filename

    const trimmedPin = typeof pin === 'string' ? pin.trim() : ''
    if (trimmedPin && !PIN_RE.test(trimmedPin)) return res.status(400).json({ error: 'Password must be 4-8 characters (letters/numbers)' })

    // expiresAt gak dikirim sama sekali -> biarin apa adanya (undefined).
    // Dikirim null/''/0 -> jadiin permanen lagi. Dikirim timestamp -> pasang/perpanjang expiry.
    const nextExpiresAt = sanitizeExpiresAt(expiresAt)

    try {
        let rawUrl = snippet.rawUrl
        if (contentChanged || filenameChanged || (title !== undefined && newTitle !== snippet.title)) {
            const files = filenameChanged
                ? { [snippet.filename]: { filename: newFilename, content: contentChanged ? content : undefined } }
                : { [snippet.filename]: { content: contentChanged ? content : undefined } }
            const gist = await editGist(snippet.id, files, newTitle)
            const file = gist.files[newFilename]
            rawUrl = file?.raw_url || rawUrl
        }

        const pinPatch = trimmedPin
            ? { isLocked: true, pinHash: await hashPin(trimmedPin) }
            : (removePin ? { isLocked: false, pinHash: null } : {})

        const patch = {
            title: newTitle,
            filename: newFilename,
            language: language ? sanitizeLanguage(language) : snippet.language,
            description: description !== undefined ? sanitizeDescription(description) : snippet.description,
            tags: tags !== undefined ? sanitizeTags(tags) : snippet.tags,
            isPublic: isPublic !== undefined ? !!isPublic : snippet.isPublic,
            rawUrl,
            preview: contentChanged ? buildPreview(content) : snippet.preview,
            lineCount: contentChanged ? countLines(content) : (snippet.lineCount ?? countLines(content)),
            ...(nextExpiresAt !== undefined ? { expiresAt: nextExpiresAt } : {}),
            ...pinPatch
        }
        const updated = await Snippets.update(snippet.id, patch)
        res.json({ ...stripSnippetSecrets(updated), locked: !!updated.isLocked, expired: isSnippetExpired(updated), content: contentChanged ? content : undefined })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

// Siapa aja yang boleh liat konten snippet sekarang juga boleh liat riwayat
// versinya -- aturan aksesnya sama kayak GET /:shortId (privat/terkunci
// cuma buat owner, lihat handler view di atas).
function canSeeHistory(snippet, username) {
    if (snippet.ownerUsername === username) return true
    if (snippet.isPublic === false) return false
    if (snippet.isLocked) return false
    return true
}

router.get('/:shortId/history', async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    if (!canSeeHistory(snippet, req.username)) return res.status(403).json({ error: 'Snippet ini privat/terkunci' })
    try {
        const commits = await getGistCommits(snippet.id)
        // GitHub balikin dari yang paling baru duluan -- itu juga yang paling
        // enak buat ditampilin (versi sekarang di atas).
        const history = commits.map((c, i) => ({
            version: c.version,
            committedAt: c.committed_at,
            changes: c.change_status ? { additions: c.change_status.additions, deletions: c.change_status.deletions } : null,
            isCurrent: i === 0
        }))
        res.json({ history })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.get('/:shortId/history/:sha', async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    if (!canSeeHistory(snippet, req.username)) return res.status(403).json({ error: 'Snippet ini privat/terkunci' })
    try {
        const gistAtRev = await getGistAtRevision(snippet.id, req.params.sha)
        const files = Object.values(gistAtRev.files || {})
        // Nama file bisa aja udah diganti (rename) di revisi setelahnya --
        // coba cocokin nama file sekarang dulu, baru fallback ke file pertama
        // yang ada di revisi itu.
        const file = files.find(f => f.filename === snippet.filename) || files[0]
        if (!file) return res.status(404).json({ error: 'File tidak ditemukan di revisi ini' })
        res.json({ version: req.params.sha, filename: file.filename, content: file.content ?? '' })
    } catch (e) {
        if (e.response?.status === 404) return res.status(404).json({ error: 'Revisi tidak ditemukan' })
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.post('/:shortId/history/:sha/restore', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    if (snippet.ownerUsername !== req.username) return res.status(403).json({ error: 'bukan milikmu' })
    try {
        const gistAtRev = await getGistAtRevision(snippet.id, req.params.sha)
        const files = Object.values(gistAtRev.files || {})
        const file = files.find(f => f.filename === snippet.filename) || files[0]
        if (!file) return res.status(404).json({ error: 'Revisi tidak ditemukan' })
        const content = file.content ?? ''
        const gist = await editGist(snippet.id, { [snippet.filename]: { content } }, snippet.title)
        const updatedFile = gist.files[snippet.filename]
        const updated = await Snippets.update(snippet.id, {
            rawUrl: updatedFile?.raw_url || snippet.rawUrl,
            preview: buildPreview(content),
            lineCount: countLines(content)
        })
        res.json({ ...stripSnippetSecrets(updated), content })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.delete('/:shortId', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    if (snippet.ownerUsername !== req.username) return res.status(403).json({ error: 'Not your code' })
    try {
        // Hapus di GitHub; kalau gist sudah hilang (404/410) tetap lanjut hapus lokal
        try {
            await deleteGist(snippet.id)
        } catch (ge) {
            const status = ge.response?.status
            if (status !== 404 && status !== 410) {
                console.error('[delete] gist failed', snippet.shortId, ge.message)
            }
        }
        await Snippets.remove(snippet.id)
        try {
            const owner = await Users.find(snippet.ownerUsername)
            const pins = (owner?.pinnedShortIds || []).filter(id => id !== snippet.shortId)
            if (owner && pins.length !== (owner.pinnedShortIds || []).length) {
                await Users.update(snippet.ownerUsername, { pinnedShortIds: pins })
            }
        } catch {}
        try { await Comments.removeAllForSnippet(snippet.shortId) } catch {}
        try { await Likes.removeAllForSnippet(snippet.shortId) } catch {}
        try { Bookmarks.removeAllForSnippet(snippet.shortId) } catch {}
        res.json({ ok: true })
    } catch (e) {
        console.error('[delete] failed', req.params.shortId, e.message)
        res.status(500).json({ error: e.response?.data?.message || e.message || 'Delete failed' })
    }
})


router.post('/:shortId/like', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    const liked = await Likes.toggle(req.username, req.params.shortId)
    const likes = await Likes.count(req.params.shortId)
    if (liked) {
        Notifications.create({ username: snippet.ownerUsername, fromUsername: req.username, type: 'like', shortId: snippet.shortId }).catch(() => {})
    }
    res.json({ liked, likes })
})

router.post('/:shortId/bookmark', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    const saved = await Bookmarks.toggle(req.username, req.params.shortId)
    res.json({ saved })
})

router.post('/:shortId/fork', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    if (!snippet.isPublic) return res.status(403).json({ error: 'kode privat tidak bisa di-fork' })
    if (snippet.isLocked && snippet.ownerUsername !== req.username) return res.status(403).json({ error: 'kode terkunci tidak bisa di-fork' })
    try {
        const gist = await getGist(snippet.id)
        const file = gist.files[snippet.filename]
        const content = file?.content || ''
        const newGist = await createGist({ [snippet.filename]: { content } }, snippet.title, true)
        const newFile = newGist.files[snippet.filename]
        const forked = {
            id: newGist.id,
            shortId: await Snippets.uniqueShortId(),
            title: snippet.title,
            description: snippet.description || '',
            filename: snippet.filename,
            language: snippet.language,
            tags: snippet.tags || [],
            ownerUsername: req.username,
            isPublic: true,
            isLocked: false,
            pinHash: null,
            expiresAt: null,
            forkedFrom: { shortId: snippet.shortId, ownerUsername: snippet.ownerUsername },
            rawUrl: newFile.raw_url,
            htmlUrl: newGist.html_url,
            preview: buildPreview(content),
            lineCount: countLines(content),
            createdAt: Date.now()
        }
        await Snippets.create(forked)
        Notifications.create({ username: snippet.ownerUsername, fromUsername: req.username, type: 'fork', shortId: snippet.shortId }).catch(() => {})
        res.json(stripSnippetSecrets(forked))
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.post('/:shortId/report', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    if (snippet.ownerUsername === req.username) return res.status(400).json({ error: 'You cannot report your own code' })
    const reason = String(req.body.reason || '')
    if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid report reason' })
    if (tooManyReports(req.username)) return res.status(429).json({ error: 'Too many reports, try again later' })
    if (await Reports.hasPendingFrom(req.username, snippet.shortId)) return res.status(400).json({ error: 'You already reported this code' })
    try {
        const detail = String(req.body.detail || '').trim().slice(0, 300)
        await Reports.create({ shortId: snippet.shortId, ownerUsername: snippet.ownerUsername, fromUsername: req.username, reason, detail })
        Notifications.create({ username: DEV_USERNAME, fromUsername: req.username, type: 'report', shortId: snippet.shortId }).catch(() => {})
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

// Nempelin identitas (avatar/nickname/badge) seorang user ke sebuah objek
// (komentar ATAU balasan) berdasarkan username-nya. Dipakai buat komentar
// top-level maupun tiap reply di dalam thread, karena sekarang siapa aja
// (bukan cuma owner kode) bisa jadi penulis sebuah reply.
function withAuthorIdentity(item, byUsername) {
    const u = byUsername.get(item.username)
    return {
        ...item,
        avatar: u ? avatarUrl(u) : null,
        nickname: u ? (u.nickname || u.username) : (item.username || null),
        ...badgeDisplay(u, u ? readBadges(u) : [])
    }
}

router.get('/:shortId/comments', async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    const [comments, users] = await Promise.all([Comments.forSnippet(req.params.shortId), Users.all()])
    const byUsername = new Map(users.map(u => [u.username, u]))
    res.json(comments.map(c => {
        const normalized = Comments.normalize(c, snippet.ownerUsername)
        return withAuthorIdentity({
            ...normalized,
            replies: normalized.replies.map(r => withAuthorIdentity(r, byUsername))
        }, byUsername)
    }))
})

router.post('/:shortId/comments', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    const text = String(req.body.text || '').trim()
    const stickerUrl = req.body.stickerUrl ? String(req.body.stickerUrl).trim() : ''
    if (stickerUrl && !isValidStickerUrl(stickerUrl)) return res.status(400).json({ error: 'Invalid sticker' })
    if (!text && !stickerUrl) return res.status(400).json({ error: 'Comment cannot be empty' })
    if (text.length > 500) return res.status(400).json({ error: 'komentar maksimal 500 karakter' })
    const comment = {
        id: crypto.randomBytes(6).toString('hex'),
        shortId: req.params.shortId,
        username: req.username,
        text,
        stickerUrl: stickerUrl || null,
        createdAt: Date.now(),
        replies: []
    }
    await Comments.add(comment)
    Notifications.create({
        username: snippet.ownerUsername,
        fromUsername: req.username,
        type: 'comment',
        shortId: snippet.shortId,
        commentId: comment.id
    }).catch(() => {})
    const user = await Users.find(req.username)
    res.json({
        ...comment,
        avatar: user ? avatarUrl(user) : null,
        nickname: user ? (user.nickname || user.username) : null,
        ...badgeDisplay(user, user ? readBadges(user) : [])
    })
})

router.delete('/:shortId/comments/:commentId', requireAuth, async (req, res) => {
    const comments = await Comments.forSnippet(req.params.shortId)
    const comment = comments.find(c => c.id === req.params.commentId)
    if (!comment) return res.status(404).json({ error: 'komentar tidak ditemukan' })
    const snippet = await Snippets.findByShort(req.params.shortId)
    const isOwnerOfSnippet = snippet && snippet.ownerUsername === req.username
    if (comment.username !== req.username && !isOwnerOfSnippet) return res.status(403).json({ error: 'bukan milikmu' })
    await Comments.remove(comment.id, req.params.shortId)
    res.json({ ok: true })
})

// Balas komentar: dulu cuma pemilik kode yang boleh membalas, jadi kalau
// owner sudah membalas User, User gak punya cara buat membalas lagi di
// thread yang sama (kepaksa bikin komentar baru). Sekarang SEMUA user yang
// login boleh membalas komentar ATAU balasan siapa pun di thread yang sama,
// jadi diskusi bisa nyambung terus-menerus (continuous nested replies) --
// mirip Instagram/TikTok, semua balasan disimpan flat di dalam satu thread
// milik komentar top-level-nya, dan tiap balasan bisa nyimpen `replyToUsername`
// buat nunjukin dia lagi membalas siapa persisnya.
router.post('/:shortId/comments/:commentId/reply', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    const comments = await Comments.forSnippet(req.params.shortId)
    const originalComment = comments.find(c => c.id === req.params.commentId)
    if (!originalComment) return res.status(404).json({ error: 'komentar tidak ditemukan' })

    const text = String(req.body.text || '').trim()
    const stickerUrl = req.body.stickerUrl ? String(req.body.stickerUrl).trim() : ''
    if (stickerUrl && !isValidStickerUrl(stickerUrl)) return res.status(400).json({ error: 'Invalid sticker' })
    if (!text && !stickerUrl) return res.status(400).json({ error: 'balasan tidak boleh kosong' })
    if (text.length > 500) return res.status(400).json({ error: 'balasan maksimal 500 karakter' })

    // replyToUsername: siapa yang lagi dibalas (bisa penulis komentar utama,
    // atau penulis salah satu reply lain di thread ini). Divalidasi supaya
    // cuma boleh nunjuk ke partisipan yang beneran ada di thread ini --
    // mencegah klaim "membalas @siapapun" yang gak nyambung ke percakapan.
    const normalizedComment = Comments.normalize(originalComment, snippet.ownerUsername)
    const threadUsernames = new Set([
        normalizedComment.username,
        ...normalizedComment.replies.map(r => r.username).filter(Boolean)
    ])
    const requestedReplyTo = String(req.body.replyToUsername || '').trim()
    const replyToUsername = requestedReplyTo && threadUsernames.has(requestedReplyTo)
        ? requestedReplyTo
        : normalizedComment.username

    const reply = await Comments.addReply(req.params.commentId, req.params.shortId, {
        text,
        stickerUrl: stickerUrl || null,
        createdAt: Date.now(),
        username: req.username,
        replyToUsername
    })

    // Notif ke orang yang benar-benar dibalas (bukan selalu penulis komentar
    // utama), biar semua peserta thread ikut ke-notif giliran mereka dibalas.
    Notifications.create({
        username: replyToUsername,
        fromUsername: req.username,
        type: 'reply',
        shortId: snippet.shortId,
        commentId: req.params.commentId,
        replyId: reply.id
    }).catch(() => {})

    const users = await Users.all()
    const byUsername = new Map(users.map(u => [u.username, u]))
    res.json({ ok: true, reply: withAuthorIdentity(reply, byUsername) })
})

router.delete('/:shortId/comments/:commentId/reply/:replyId', requireAuth, async (req, res) => {
    const snippet = await Snippets.findByShort(req.params.shortId)
    if (!snippet) return res.status(404).json({ error: 'Not found' })
    const comments = await Comments.forSnippet(req.params.shortId)
    const comment = comments.find(c => c.id === req.params.commentId)
    if (!comment) return res.status(404).json({ error: 'komentar tidak ditemukan' })

    const normalized = Comments.normalize(comment, snippet.ownerUsername)
    const reply = normalized.replies.find(r => r.id === req.params.replyId)
    if (!reply) return res.status(404).json({ error: 'balasan tidak ditemukan' })

    // Boleh dihapus oleh penulis balasan itu sendiri, atau oleh pemilik kode
    // (moderasi), sama seperti aturan hapus komentar top-level.
    const isOwnerOfSnippet = snippet.ownerUsername === req.username
    if (reply.username !== req.username && !isOwnerOfSnippet) return res.status(403).json({ error: 'bukan milikmu' })

    await Comments.removeReply(req.params.commentId, req.params.shortId, req.params.replyId)
    res.json({ ok: true })
})

export default router
