import crypto from 'crypto'

let SECRET = process.env.SESSION_SECRET || 'codery-secret'
export function setSecret(secret) {
    if (secret) SECRET = secret
}

export const MAX_AGE = 1000 * 60 * 60 * 24 * 7
export const COOKIE_NAME = 'codery_session'

function sign(value) {
    return crypto.createHmac('sha256', SECRET).update(value).digest('hex')
}

export function createToken(username) {
    const payload = `${username}.${Date.now() + MAX_AGE}`
    const payloadB64 = Buffer.from(payload).toString('base64url')
    const sig = sign(payloadB64)
    return `${payloadB64}.${sig}`
}

export function verifyToken(token) {
    if (!token || typeof token !== 'string') return null
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) return null
    const payloadB64 = token.slice(0, dotIndex)
    const sig = token.slice(dotIndex + 1)
    const expected = sign(payloadB64)
    const a = Buffer.from(expected)
    const b = Buffer.from(sig)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

    let payload
    try {
        payload = Buffer.from(payloadB64, 'base64url').toString('utf-8')
    } catch {
        return null
    }
    const lastDot = payload.lastIndexOf('.')
    if (lastDot === -1) return null
    const username = payload.slice(0, lastDot)
    const expiry = Number(payload.slice(lastDot + 1))
    if (!username || !expiry || Date.now() > expiry) return null
    return username
}

const CAPTCHA_TTL_MS = 5 * 60 * 1000

export function createCaptchaToken(a, b) {
    const payload = `${a}.${b}.${Date.now() + CAPTCHA_TTL_MS}`
    const payloadB64 = Buffer.from(payload).toString('base64url')
    return `${payloadB64}.${sign(payloadB64)}`
}

export function verifyCaptchaToken(token, answer) {
    if (!token || typeof token !== 'string') return false
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) return false
    const payloadB64 = token.slice(0, dotIndex)
    const sig = token.slice(dotIndex + 1)
    const expectedBuf = Buffer.from(sign(payloadB64))
    const sigBuf = Buffer.from(sig)
    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) return false
    let payload
    try {
        payload = Buffer.from(payloadB64, 'base64url').toString('utf-8')
    } catch {
        return false
    }
    const [a, b, expiry] = payload.split('.')
    if (!a || !b || !expiry || Date.now() > Number(expiry)) return false
    return Number(a) + Number(b) === Number(answer)
}

export function parseCookies(header) {
    const out = {}
    if (!header) return out
    header.split(';').forEach(part => {
        const idx = part.indexOf('=')
        if (idx === -1) return
        const k = part.slice(0, idx).trim()
        const v = part.slice(idx + 1).trim()
        try { out[k] = decodeURIComponent(v) } catch { out[k] = v }
    })
    return out
}
