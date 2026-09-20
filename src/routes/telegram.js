import { Router } from 'express'
import { Users } from '../db.js'
import { sendTelegram } from '../push.js'

const router = Router()

router.post('/webhook', async (req, res) => {
    res.json({ ok: true })
    try {
        const msg = req.body?.message
        const text = msg?.text || ''
        const chatId = msg?.chat?.id
        if (!chatId || !text.startsWith('/start')) return
        const token = text.split(' ')[1]
        if (!token) return
        const user = await Users.findByTelegramToken(token)
        if (!user) return sendTelegram(chatId, 'Link invalid atau udah kepake. Coba connect ulang dari Codery.').catch(() => {})
        await Users.update(user.username, { telegramChatId: String(chatId), telegramLinkToken: null })
        await sendTelegram(chatId, `Berhasil connect ke akun Codery @${user.username}. Notifikasi bakal masuk ke sini dari sekarang.`)
    } catch {}
})

export default router
