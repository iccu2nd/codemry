import axios from 'axios'

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME
const WA_BRIDGE_URL = process.env.WA_BRIDGE_URL
const WA_BRIDGE_API_KEY = process.env.WA_BRIDGE_API_KEY
const SITE_URL = 'https://codery.my.id'

export const telegramLinkUrl = token => TELEGRAM_BOT_USERNAME ? `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}` : null

export async function sendTelegram(chatId, text) {
    if (!TELEGRAM_TOKEN || !chatId) return
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { chat_id: chatId, text, disable_web_page_preview: true })
}

export async function sendWhatsApp(number, text) {
    if (!WA_BRIDGE_URL || !number) return
    await axios.post(WA_BRIDGE_URL, { number, message: text }, { headers: WA_BRIDGE_API_KEY ? { Authorization: `Bearer ${WA_BRIDGE_API_KEY}` } : {}, timeout: 8000 })
}

const PUSH_TEXT_BY_TYPE = {
    like: 'liked your code',
    comment: 'commented on your code',
    reply: 'replied to your comment',
    follow: 'started following you',
    fork: 'forked your code',
    upload: 'uploaded new code'
}

export async function pushNotify(user, notif) {
    if (!user || !user.pushEnabled) return
    const line = PUSH_TEXT_BY_TYPE[notif.type]
    if (!line) return
    const url = notif.shortId ? `\n${SITE_URL}/code/${notif.shortId}` : ''
    const text = `${notif.fromUsername} ${line}${url}`
    await Promise.allSettled([sendTelegram(user.telegramChatId, text), sendWhatsApp(user.waNumber, text)])
}
