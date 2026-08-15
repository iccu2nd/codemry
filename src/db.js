import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { readDbFile, writeDbFile, listGists } from './github.js'

export function avatarUrl(user) {
    if (!user) return null
    return user.avatarPath ? `/avatar/${encodeURIComponent(user.username)}` : user.avatar
}

export function bannerUrl(user) {
    if (!user || !user.bannerPath) return null
    return `/banner/${encodeURIComponent(user.username)}`
}

async function update(path, mutator, message) {
    for (let i = 0; i < 3; i++) {
        const { data, sha } = await readDbFile(path)
        const updated = mutator(data)
        if (updated === data) return updated // mutator made no change, skip the write
        try {
            await writeDbFile(path, updated, sha, message)
            return updated
        } catch (e) {
            if (e.response?.status === 409 && i < 2) continue
            throw e
        }
    }
}

export async function ensureSessionSecret() {
    const { data, sha } = await readDbFile('session-secret.json')
    if (data && data.secret) return data.secret
    const secret = crypto.randomBytes(32).toString('hex')
    await writeDbFile('session-secret.json', { secret }, sha, 'init persistent session secret')
    return secret
}

export const Users = {
    async all() { return (await readDbFile('users.json')).data },
    async find(username) {
        const u = await this.all()
        return u.find(x => x.username.toLowerCase() === username.toLowerCase())
    },
    async create(user) { return update('users.json', d => [...d, user], `add user ${user.username}`) },
    async update(username, patch) {
        return update('users.json', d => d.map(u =>
            u.username.toLowerCase() === username.toLowerCase() ? { ...u, ...patch } : u
        ), `update user ${username}`)
    }
}

export const DEV_USERNAME = 'reyzdesu'
export function isDeveloperUsername(username) {
    return String(username || '').toLowerCase() === DEV_USERNAME
}

// Moderator itu peran terpisah dari developer: developer (akun hardcoded di atas)
// otomatis punya akses moderasi, tapi role 'moderator'/'admin' yang di-assign lewat
// devpanel juga bisa akses /moderasi tanpa perlu jadi developer.
export const MODERATOR_ROLES = ['moderator', 'admin']
export function isModeratorRole(role) {
    return MODERATOR_ROLES.includes(String(role || '').toLowerCase())
}
export function isModeratorUser(user) {
    if (!user) return false
    return isDeveloperUsername(user.username) || isModeratorRole(user.role)
}

export const BADGE_TYPES = ['verified', 'staff', 'contributor', 'supporter']

export function readBadges(user) {
    let badges
    if (Array.isArray(user.badges)) badges = user.badges.filter(b => BADGE_TYPES.includes(b))
    else if (user.badge !== undefined) badges = user.badge === 'verified' ? ['verified'] : []
    else badges = []
    if (isDeveloperUsername(user.username) && !badges.includes('verified')) badges = [...badges, 'verified']
    return badges
}

export async function ensureBadges(user) {
    if (Array.isArray(user.badges)) return user.badges.filter(b => BADGE_TYPES.includes(b))
    const badges = readBadges(user)
    await Users.update(user.username, { badges })
    return badges
}

export function badgeDisplay(user, badges) {
    if (!user || user.hideBadges) return { badges: [], role: null, isDeveloper: false, isModerator: false }
    return { badges, role: user.role || null, isDeveloper: isDeveloperUsername(user.username), isModerator: isModeratorUser(user) }
}

export async function setBadge(username, badgeId, enabled) {
    if (!BADGE_TYPES.includes(badgeId)) throw new Error('jenis lencana tidak dikenal')
    const target = await Users.find(username)
    if (!target) throw new Error('user tidak ditemukan')
    const current = readBadges(target)
    const next = enabled ? [...new Set([...current, badgeId])] : current.filter(b => b !== badgeId)
    await Users.update(username, { badges: next })
    return next
}

export function generateNickname(username) {
    const clean = String(username || 'user').replace(/[^a-zA-Z0-9]/g, '') || 'user'
    const base = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
    const rand = Math.floor(100 + Math.random() * 900)
    return `${base}${rand}`
}

export async function ensureNickname(user) {
    if (user.nickname) return user.nickname
    const nickname = generateNickname(user.username)
    await Users.update(user.username, { nickname })
    return nickname
}

export async function renameUsername(oldUsername, newUsername) {
    await update('snippets.json', d => d.map(s =>
        s.ownerUsername === oldUsername ? { ...s, ownerUsername: newUsername } : s
    ), `rename snippet owner ${oldUsername} -> ${newUsername}`)
    await update('follows.json', d => d.map(f => ({
        ...f,
        follower: f.follower === oldUsername ? newUsername : f.follower,
        following: f.following === oldUsername ? newUsername : f.following
    })), `rename follow refs ${oldUsername} -> ${newUsername}`)
    await update('users.json', d => d.map(u =>
        u.username.toLowerCase() === oldUsername.toLowerCase()
            ? { ...u, username: newUsername, usernameChangedAt: Date.now() }
            : u
    ), `rename user ${oldUsername} -> ${newUsername}`)
}

export const SCRAPE_REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000

export const ScrapeRequests = {
    async all() { return (await readDbFile('scrape-requests.json')).data },
    async create(reqData) { return update('scrape-requests.json', d => [...d, reqData], `scrape request by ${reqData.username}`) },
    async claim(id, username) {
        const updated = await update('scrape-requests.json', d => d.map(r =>
            r.id === id && r.status === 'pending' ? { ...r, status: 'claimed', claimedBy: username, claimedAt: Date.now() } : r
        ), `claim scrape request ${id} by ${username}`)
        return updated.find(r => r.id === id)
    },
    async pruneExpired() {
        const cutoff = Date.now() - SCRAPE_REQUEST_TTL_MS
        const { data } = await readDbFile('scrape-requests.json')
        const expired = data.filter(r => r.createdAt < cutoff)
        if (!expired.length) return { removed: 0 }
        await update('scrape-requests.json', d => d.filter(r => r.createdAt >= cutoff), `auto-prune ${expired.length} scrape request(s) older than 7 hari`)
        return { removed: expired.length }
    }
}

export const Follows = {
    async all() { return (await readDbFile('follows.json')).data },
    async toggle(follower, following) {
        return update('follows.json', d => {
            const exists = d.find(f => f.follower === follower && f.following === following)
            if (exists) return d.filter(f => !(f.follower === follower && f.following === following))
            return [...d, { follower, following, at: Date.now() }]
        }, `toggle follow ${follower}->${following}`)
    },
    async followers(username) { const d = await this.all(); return d.filter(f => f.following === username).map(f => f.follower) },
    async following(username) { const d = await this.all(); return d.filter(f => f.follower === username).map(f => f.following) },
    async isFollowing(follower, following) { const d = await this.all(); return !!d.find(f => f.follower === follower && f.following === following) }
}

export const Views = {
    async all() { return (await readDbFile('views.json')).data },
    hashIp(ip) { return crypto.createHash('sha256').update(String(ip || 'unknown')).digest('hex') },
    async register(shortId, ip) {
        const ipHash = this.hashIp(ip)
        // Dedupe per-IP per-hari (bukan permanen selamanya). Sebelumnya sekali
        // sebuah IP kehitung, view snippet itu gak akan nambah lagi buat IP itu
        // selama-lamanya - makanya kerasa "views-nya gak jalan" pas dicek ulang.
        // Sekarang tiap IP bisa nambah 1 view per snippet per hari, jadi tetep
        // kebendung dari spam-refresh tapi beneran nambah kalau ada yang balik lagi.
        const dayBucket = Math.floor(Date.now() / 86400000)
        await update('views.json', d => {
            if (d.find(v => v.shortId === shortId && v.ipHash === ipHash && v.day === dayBucket)) return d
            return [...d, { shortId, ipHash, day: dayBucket, at: Date.now() }]
        }, `view ${shortId}`)
    },
    async count(shortId) {
        const d = await this.all()
        return d.filter(v => v.shortId === shortId).length
    },
    async countMany(shortIds) {
        const d = await this.all()
        const counts = new Map()
        for (const v of d) counts.set(v.shortId, (counts.get(v.shortId) || 0) + 1)
        return shortIds.reduce((acc, id) => { acc[id] = counts.get(id) || 0; return acc }, {})
    }
}

export const Likes = {
    async all() { return (await readDbFile('likes.json')).data },
    async toggle(username, shortId) {
        const updated = await update('likes.json', d => {
            const exists = d.find(l => l.username === username && l.shortId === shortId)
            if (exists) return d.filter(l => !(l.username === username && l.shortId === shortId))
            return [...d, { username, shortId, at: Date.now() }]
        }, `toggle like ${username}->${shortId}`)
        return !!updated.find(l => l.username === username && l.shortId === shortId)
    },
    async count(shortId) {
        const d = await this.all()
        return d.filter(l => l.shortId === shortId).length
    },
    async countMany(shortIds) {
        const d = await this.all()
        const counts = new Map()
        for (const l of d) counts.set(l.shortId, (counts.get(l.shortId) || 0) + 1)
        return shortIds.reduce((acc, id) => { acc[id] = counts.get(id) || 0; return acc }, {})
    },
    async hasLiked(username, shortId) {
        if (!username) return false
        const d = await this.all()
        return !!d.find(l => l.username === username && l.shortId === shortId)
    },
    async likedShortIds(username) {
        if (!username) return new Set()
        const d = await this.all()
        return new Set(d.filter(l => l.username === username).map(l => l.shortId))
    },
    async removeAllForSnippet(shortId) {
        return update('likes.json', d => d.filter(l => l.shortId !== shortId), `clear likes for ${shortId}`)
    }
}

export const Comments = {
    async all() { return (await readDbFile('comments.json')).data },
    async forSnippet(shortId) {
        const all = await this.all()
        return all.filter(c => c.shortId === shortId).sort((a, b) => a.createdAt - b.createdAt)
    },
    async add(comment) { return update('comments.json', d => [...d, comment], `comment on ${comment.shortId}`) },
    async remove(id, shortId) {
        return update('comments.json', d => d.filter(c => c.id !== id), `remove comment ${id} on ${shortId}`)
    },
    async removeAllForSnippet(shortId) {
        return update('comments.json', d => d.filter(c => c.shortId !== shortId), `clear comments for ${shortId}`)
    },
    // Komentar lama cuma punya 1 balasan owner (ownerReply), dan format "baru"
    // sebelumnya cuma nyimpen balasan tanpa `username` (karena dulu cuma owner
    // yang boleh balas). Sekarang SEMUA user bisa saling balas terus-menerus di
    // satu thread yang sama (nested reply), jadi tiap reply wajib punya
    // `username` (siapa yang nulis) dan opsional `replyToUsername` (lagi
    // membalas siapa, buat ditampilkan sebagai "membalas @user"). Fungsi ini
    // nyamain bentuk komentar lama/legacy biar tetep kebaca di frontend baru.
    // `fallbackUsername` dipakai buat balasan legacy yang belum punya
    // `username` sama sekali (dulu selalu ditulis owner kode).
    normalize(c, fallbackUsername) {
        if (Array.isArray(c.replies)) {
            return {
                ...c,
                replies: c.replies.map(r => ({
                    replyToUsername: c.username,
                    ...r,
                    username: r.username || fallbackUsername || null
                }))
            }
        }
        return {
            ...c,
            replies: c.ownerReply
                ? [{ id: 'legacy', text: c.ownerReply.text, createdAt: c.ownerReply.createdAt, username: fallbackUsername || null, replyToUsername: c.username }]
                : []
        }
    },
    async addReply(id, shortId, reply) {
        const entry = { id: crypto.randomBytes(4).toString('hex'), ...reply }
        await update('comments.json', d => d.map(c => {
            if (c.id !== id || c.shortId !== shortId) return c
            const normalized = Comments.normalize(c)
            return { ...normalized, replies: [...normalized.replies, entry] }
        }), `reply from ${reply.username} on comment ${id}`)
        return entry
    },
    async removeReply(id, shortId, replyId) {
        return update('comments.json', d => d.map(c => {
            if (c.id !== id || c.shortId !== shortId) return c
            const normalized = Comments.normalize(c)
            return { ...normalized, replies: normalized.replies.filter(r => r.id !== replyId) }
        }), `remove reply ${replyId} on comment ${id}`)
    }
}

export async function hashPin(pin) {
    return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin, pinHash) {
    if (!pinHash) return false
    return bcrypt.compare(String(pin || ''), pinHash)
}

export function stripSnippetSecrets(snippet) {
    const { pinHash, ...rest } = snippet
    return rest
}

export function lockedSnippetStub(snippet) {
    const { pinHash, rawUrl, htmlUrl, preview, ...rest } = snippet
    return { ...rest, preview: null, locked: true }
}

export const Bookmarks = {
    async all() { return (await readDbFile('bookmarks.json')).data },
    async toggle(username, shortId) {
        const updated = await update('bookmarks.json', d => {
            const exists = d.find(b => b.username === username && b.shortId === shortId)
            if (exists) return d.filter(b => !(b.username === username && b.shortId === shortId))
            return [...d, { username, shortId, at: Date.now() }]
        }, `toggle bookmark ${username}->${shortId}`)
        return !!updated.find(b => b.username === username && b.shortId === shortId)
    },
    async hasSaved(username, shortId) {
        if (!username) return false
        const d = await this.all()
        return !!d.find(b => b.username === username && b.shortId === shortId)
    },
    async savedShortIds(username) {
        if (!username) return new Set()
        const d = await this.all()
        return new Set(d.filter(b => b.username === username).map(b => b.shortId))
    },
    async removeAllForSnippet(shortId) {
        return update('bookmarks.json', d => d.filter(b => b.shortId !== shortId), `clear bookmarks for ${shortId}`)
    }
}

export const NOTIF_TYPES = ['like', 'comment', 'reply', 'follow', 'fork', 'report', 'upload']

export const Notifications = {
    async all() { return (await readDbFile('notifications.json')).data },
    async create(notif) {
        // Gak perlu notif ke diri sendiri (like/comment di kode sendiri, dst).
        if (!notif.username || notif.username === notif.fromUsername) return
        const entry = { id: crypto.randomUUID(), read: false, createdAt: Date.now(), ...notif }
        await update('notifications.json', d => {
            const next = [entry, ...d]
            // Batasi riwayat biar file index gak membengkak tak terbatas.
            return next.length > 500 ? next.slice(0, 500) : next
        }, `notify ${notif.username} <- ${notif.type} from ${notif.fromUsername}`)
        return entry
    },
    async forUser(username, limit = 50) {
        const d = await this.all()
        return d.filter(n => n.username === username).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
    },
    async unreadCount(username) {
        const d = await this.all()
        return d.filter(n => n.username === username && !n.read).length
    },
    async markRead(username, id) {
        return update('notifications.json', d => d.map(n =>
            n.username === username && n.id === id ? { ...n, read: true } : n
        ), `read notif ${id}`)
    },
    async markAllRead(username) {
        return update('notifications.json', d => d.map(n =>
            n.username === username && !n.read ? { ...n, read: true } : n
        ), `read all notif for ${username}`)
    }
}

export const REPORT_REASONS = ['vulgar', 'spam', 'plagiarism', 'malware', 'other']
export const REPORT_REASON_LABELS = {
    vulgar: 'Konten vulgar/tidak pantas',
    spam: 'Spam/promosi',
    plagiarism: 'Plagiat/klaim kode orang lain',
    malware: 'Malware/kode berbahaya',
    other: 'Lainnya'
}

export const Reports = {
    async all() { return (await readDbFile('reports.json')).data },
    async create(report) {
        const entry = { id: crypto.randomUUID(), status: 'pending', createdAt: Date.now(), ...report }
        await update('reports.json', d => [entry, ...d], `report ${report.shortId} by ${report.fromUsername}`)
        return entry
    },
    async setStatus(id, status) {
        return update('reports.json', d => d.map(r => r.id === id ? { ...r, status } : r), `report ${id} -> ${status}`)
    },
    async pendingCount() {
        const d = await this.all()
        return d.filter(r => r.status === 'pending').length
    },
    async hasPendingFrom(username, shortId) {
        const d = await this.all()
        return !!d.find(r => r.fromUsername === username && r.shortId === shortId && r.status === 'pending')
    }
}

export const Snippets = {
    async all() { return (await readDbFile('snippets.json')).data },
    async find(id) { const s = await this.all(); return s.find(x => x.id === id) },
    async findByShort(shortId) { const s = await this.all(); return s.find(x => x.shortId === shortId) },
    async create(snippet) { return update('snippets.json', d => [snippet, ...d], `add snippet ${snippet.id}`) },
    async remove(id) { return update('snippets.json', d => d.filter(x => x.id !== id), `remove snippet ${id}`) },
    async update(id, patch) {
        const updated = await update('snippets.json', d => d.map(x => x.id === id ? { ...x, ...patch } : x), `update snippet ${id}`)
        return updated.find(x => x.id === id)
    },
    async byUser(username) { const s = await this.all(); return s.filter(x => x.ownerUsername === username) },

    async allLive() {
        const [snippets, gists] = await Promise.all([this.all(), listGists()])
        const gistIds = new Set(gists.map(g => g.id))
        const live = snippets.filter(s => gistIds.has(s.id))
        if (live.length !== snippets.length) {
            await update('snippets.json', d => d.filter(x => gistIds.has(x.id)), 'sync index dengan gist yang masih ada')
        }
        return live
    },
    async byUserLive(username) {
        const live = await this.allLive()
        return live.filter(x => x.ownerUsername === username)
    },

    async uniqueShortId() {
        const existing = new Set((await this.all()).map(x => x.shortId))
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        let id
        do {
            id = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
        } while (existing.has(id))
        return id
    }
}
