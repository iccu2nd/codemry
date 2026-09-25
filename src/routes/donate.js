import { Router } from 'express'
import { Users, Notifications } from '../db.js'
import {
  createPayment,
  getTransaction,
  checkStatus,
  listMethods,
  normalizeSociabuzzUsername,
  markNotified
} from '../sociabuzz.js'

const router = Router()

// Rate-ish: simple in-memory throttle per IP
const hits = new Map()
function throttle(ip, limit = 8, windowMs = 60000) {
  const now = Date.now()
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs)
  if (arr.length >= limit) return false
  arr.push(now)
  hits.set(ip, arr)
  return true
}

function formatRp(n) {
  return 'Rp ' + Number(n || 0).toLocaleString('id-ID')
}

async function notifyDonationIfNeeded(trx) {
  if (!trx || trx.status !== 'paid') return
  if (trx.notified) return
  const owner = trx.ownerUsername
  if (!owner) {
    markNotified(trx.id)
    return
  }
  // jangan notif ke diri sendiri kalau fromUsername = owner
  const from = trx.fromUsername || null
  try {
    await Notifications.create({
      username: owner,
      fromUsername: from || 'donatur',
      type: 'donate',
      text: `${trx.supporter || 'Someone'} donated ${formatRp(trx.total_amount || trx.amount)}${trx.message ? ': ' + String(trx.message).slice(0, 80) : ''}`,
      amount: trx.total_amount || trx.amount,
      supporter: trx.supporter || null,
      message: trx.message || null,
      trxId: trx.id
    })
  } catch (e) {
    console.error('[donate] notify failed', e.message)
  }
  markNotified(trx.id)
}

router.get('/methods', (_req, res) => {
  res.json({ methods: listMethods() })
})

/** Public: start donation to a Codery user who linked Sociabuzz */
router.post('/:username', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || 'unknown'
  if (!throttle(ip)) return res.status(429).json({ error: 'Terlalu banyak permintaan, coba lagi nanti' })

  try {
    const user = await Users.find(req.params.username)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const sb = normalizeSociabuzzUsername(user.sociabuzz)
    if (!sb) return res.status(400).json({ error: 'User belum mengaktifkan donasi' })

    const { amount, method, name, message, phone, email } = req.body || {}
    const trx = await createPayment(amount, {
      username: sb,
      ownerUsername: user.username,
      fromUsername: req.username || null,
      method: method || 'qris',
      name: name || (req.username ? req.username : 'Donatur'),
      message: message || '',
      phone,
      email
    })
    res.json(trx)
  } catch (e) {
    console.error('[donate]', e.message)
    res.status(400).json({ error: e.message || 'Gagal membuat donasi' })
  }
})

router.get('/trx/:id', async (req, res) => {
  try {
    const trx = await checkStatus(req.params.id)
    if (!trx) return res.status(404).json({ error: 'Transaksi tidak ditemukan' })
    // Saat status jadi paid, kirim notifikasi ke pemilik profil
    if (trx.status === 'paid' && !trx.notified) {
      await notifyDonationIfNeeded(trx)
    }
    res.json(trx)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/trx/:id/raw', (req, res) => {
  const trx = getTransaction(req.params.id)
  if (!trx) return res.status(404).json({ error: 'Not found' })
  res.json(trx)
})

export default router
