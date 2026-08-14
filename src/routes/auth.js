import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Users, avatarUrl, generateNickname, ensureNickname, ensureBadges, badgeDisplay } from '../db.js'
import { createCaptchaToken, verifyCaptchaToken } from '../token.js'
import { createRateLimiter } from '../rate-limit.js'

const router = Router()
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/

const tooManyAttempts = createRateLimiter(8)

router.get('/captcha', (req, res) => {
    const a = Math.floor(Math.random() * 9) + 1
    const b = Math.floor(Math.random() * 9) + 1
    res.json({ a, b, token: createCaptchaToken(a, b) })
})

router.post('/register', async (req, res) => {
    if (tooManyAttempts(`register:${req.ip}`)) return res.status(429).json({ error: 'Terlalu banyak percobaan, coba lagi nanti' })
    const { username, password, captchaToken, captchaAnswer } = req.body
    if (!username || !password) return res.status(400).json({ error: 'username & password wajib' })
    if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Username 3-20 karakter, cuma huruf/angka/_/. ya' })
    if (!verifyCaptchaToken(captchaToken, captchaAnswer)) return res.status(400).json({ error: 'Verifikasi salah, coba lagi' })
    if (await Users.find(username)) return res.status(409).json({ error: 'username sudah dipakai' })
    const passwordHash = await bcrypt.hash(password, 10)
    const user = {
        id: Date.now().toString(36),
        username,
        passwordHash,
        bio: '',
        nickname: generateNickname(username),
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(username)}`,
        createdAt: Date.now()
    }
    await Users.create(user)
    res.setAuthCookie(username)
    res.json({ username, bio: user.bio, nickname: user.nickname, avatar: avatarUrl(user), ...badgeDisplay(user, []) })
})

router.post('/login', async (req, res) => {
    const { username, password } = req.body
    if (tooManyAttempts(`login:${req.ip}:${String(username || '').toLowerCase()}`)) return res.status(429).json({ error: 'Terlalu banyak percobaan, coba lagi nanti' })
    const user = await Users.find(username || '')
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ error: 'username/password salah' })
    const nickname = await ensureNickname(user)
    const badges = await ensureBadges(user)
    res.setAuthCookie(user.username)
    res.json({ username: user.username, bio: user.bio, nickname, avatar: avatarUrl(user), ...badgeDisplay(user, badges) })
})

router.post('/logout', (req, res) => {
    res.clearAuthCookie()
    res.json({ ok: true })
})

router.get('/me', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'belum login' })
    const user = await Users.find(req.username)
    if (!user) return res.status(401).json({ error: 'belum login' })
    const nickname = await ensureNickname(user)
    const badges = await ensureBadges(user)
    res.setAuthCookie(user.username)
    res.json({ username: user.username, bio: user.bio, nickname, avatar: avatarUrl(user), hideBadges: !!user.hideBadges, ...badgeDisplay(user, badges) })
})

export default router
