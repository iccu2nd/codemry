const WINDOW_MS = 10 * 60 * 1000

export function createRateLimiter(limit) {
    const attempts = new Map()
    return function tooManyAttempts(key) {
        const now = Date.now()
        const rec = attempts.get(key)
        if (!rec || now - rec.first > WINDOW_MS) { attempts.set(key, { count: 1, first: now }); return false }
        rec.count++
        return rec.count > limit
    }
}
