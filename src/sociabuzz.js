import axios from 'axios'
import fs from 'fs'
import path from 'path'

const BASE = 'https://sociabuzz.com'
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-A057F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
const DB_FILE = path.join(process.cwd(), 'data', 'sociabuzz-transactions.json')

export const METHODS = {
  qris: { type_payment: 'qris', source_payment: 'xendit', group: 'qris', min: 1000, label: 'QRIS' },
  gopay: { type_payment: 'ewallet_id', source_payment: 'midtrans', group: 'ewallet', min: 1000, label: 'GoPay' },
  ovo: { type_payment: 'ewallet_id', source_payment: 'xendit', group: 'ewallet', min: 1000, need_phone: true, label: 'OVO' },
  dana: { type_payment: 'ewallet_id', source_payment: 'xendit', group: 'ewallet', min: 1000, label: 'DANA' },
  linkaja: { type_payment: 'ewallet_id', source_payment: 'xendit', group: 'ewallet', min: 1000, label: 'LinkAja' },
  shopeepay_idr: { type_payment: 'ewallet_id', source_payment: '2c2p', group: 'ewallet', min: 1000, label: 'ShopeePay' },
  bca: { type_payment: 'bank_transfer', source_payment: 'midtrans', group: 'bank', min: 10000, label: 'BCA' },
  mandiri: { type_payment: 'bank_transfer', source_payment: 'xendit', group: 'bank', min: 10000, label: 'Mandiri' },
  bri: { type_payment: 'bank_transfer', source_payment: 'xendit', group: 'bank', min: 10000, label: 'BRI' },
  bni: { type_payment: 'bank_transfer', source_payment: 'xendit', group: 'bank', min: 10000, label: 'BNI' },
  bsi: { type_payment: 'bank_transfer', source_payment: 'xendit', group: 'bank', min: 10000, label: 'BSI' },
  cimb: { type_payment: 'bank_transfer', source_payment: 'xendit', group: 'bank', min: 10000, label: 'CIMB' },
  permata: { type_payment: 'bank_transfer', source_payment: 'xendit', group: 'bank', min: 10000, label: 'Permata' },
  indomaret: { type_payment: 'retail_outlet', source_payment: 'xendit', group: 'retail', min: 10000, label: 'Indomaret' },
  alfamart: { type_payment: 'retail_outlet', source_payment: 'xendit', group: 'retail', min: 10000, label: 'Alfamart' }
}

const EXPIRY_MS = {
  qris: 30 * 60 * 1000,
  ewallet: 30 * 60 * 1000,
  bank: 24 * 60 * 60 * 1000,
  retail: 24 * 60 * 60 * 1000
}

// In-memory store (file backup best-effort)
const mem = new Map()
let jar = ''

const api = axios.create({
  timeout: 25000,
  headers: { 'User-Agent': UA },
  maxRedirects: 5,
  validateStatus: s => s >= 200 && s < 400
})

api.interceptors.response.use(r => {
  const cookies = r.headers['set-cookie']
  if (cookies) {
    for (const c of cookies) {
      const [kv] = c.split(';')
      const idx = kv.indexOf('=')
      if (idx === -1) continue
      setCookie(kv.slice(0, idx).trim(), kv.slice(idx + 1).trim())
    }
  }
  return r
})

api.interceptors.request.use(c => {
  if (jar && c.url?.includes('sociabuzz')) c.headers.Cookie = jar
  return c
})

function setCookie(name, value) {
  if (!name || value == null) return
  const re = new RegExp('(^|;\\s*)' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=[^;]*')
  if (jar.match(re)) jar = jar.replace(re, '$1' + name + '=' + value)
  else jar = (jar ? jar + '; ' : '') + name + '=' + value
}

function getCsrfFromJar() {
  const m = jar.match(/csrf_cookie_name=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

function extractCsrf(html) {
  if (!html) return null
  const patterns = [
    /name=["']sb_token_csrf["'][^>]*value=["']([^"']+)/i,
    /value=["']([^"']+)["'][^>]*name=["']sb_token_csrf["']/i,
    /sb_token_csrf["']\s*value=["']([^"']+)/i
  ]
  for (const re of patterns) {
    const m = String(html).match(re)
    if (m?.[1]) return m[1]
  }
  return getCsrfFromJar()
}

function cleanAmount(v) {
  return Number(String(v || '').replace(/[^\d]/g, ''))
}

function trxId() {
  return 'TRX-' + Date.now() + String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

function loadFile() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8')
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) {
      for (const t of arr) {
        if (t?.id) mem.set(t.id, t)
        if (t?.order_id) mem.set('ord:' + t.order_id, t)
        if (t?.payment_info?.inv_id) mem.set('inv:' + t.payment_info.inv_id, t)
      }
    }
  } catch {}
}

function persist() {
  try {
    const dir = path.dirname(DB_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const seen = new Set()
    const list = []
    for (const [k, v] of mem) {
      if (k.startsWith('ord:') || k.startsWith('inv:')) continue
      if (seen.has(v.id)) continue
      seen.add(v.id)
      list.push(v)
    }
    // keep last 200
    list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    fs.writeFileSync(DB_FILE, JSON.stringify(list.slice(0, 200), null, 2))
  } catch {}
}

loadFile()

function saveTrx(trx) {
  mem.set(trx.id, trx)
  if (trx.order_id) mem.set('ord:' + trx.order_id, trx)
  if (trx.payment_info?.inv_id) mem.set('inv:' + trx.payment_info.inv_id, trx)
  persist()
}

export function normalizeSociabuzzUsername(input) {
  if (!input) return null
  let s = String(input).trim()
  if (!s) return null
  s = s.replace(/^https?:\/\/(www\.)?sociabuzz\.com\//i, '')
  s = s.replace(/\/(donate)?\/?$/i, '')
  s = s.split(/[?#]/)[0].replace(/^@/, '').trim()
  if (!/^[a-zA-Z0-9._-]{2,40}$/.test(s)) return null
  return s
}

export function listMethods() {
  return Object.keys(METHODS).map(k => ({
    id: k,
    label: METHODS[k].label || k,
    group: METHODS[k].group,
    min_amount: METHODS[k].min || 1000,
    need_phone: !!METHODS[k].need_phone
  }))
}

export function listTransactions({ status, limit = 50 } = {}) {
  const seen = new Set()
  const list = []
  for (const [k, v] of mem) {
    if (k.startsWith('ord:') || k.startsWith('inv:')) continue
    if (!v?.id || seen.has(v.id)) continue
    seen.add(v.id)
    if (status && v.status !== status) continue
    list.push({
      id: v.id,
      username: v.username,
      amount: v.amount,
      total_amount: v.total_amount,
      fee: v.fee,
      status: v.status,
      method: v.payment_info?.method || v.payment_info?.label || null,
      supporter: v.supporter || null,
      message: v.message || null,
      created_at: v.created_at,
      paid_at: v.paid_at,
      expired_at: v.expired_at
    })
  }
  list.sort((a, b) => String(b.paid_at || b.created_at || '').localeCompare(String(a.paid_at || a.created_at || '')))
  return list.slice(0, Math.min(200, Math.max(1, Number(limit) || 50)))
}

export function getTransaction(id) {
  const trx = mem.get(id) || mem.get('ord:' + id) || mem.get('inv:' + id)
  if (!trx) return null
  const { payment_url, ...rest } = trx
  return rest
}

export async function createPayment(amount, opts = {}) {
  const {
    name = 'Donatur',
    message = '',
    method = 'qris',
    email,
    phone,
    username
  } = opts

  const sbUser = normalizeSociabuzzUsername(username)
  if (!sbUser) throw new Error('Username Sociabuzz tidak valid')

  const methodKey = String(method || 'qris').toLowerCase()
  const pm = METHODS[methodKey]
  if (!pm) throw new Error(`Metode "${method}" tidak tersedia`)

  amount = cleanAmount(amount)
  if (!amount || amount < pm.min) {
    throw new Error(`Minimal Rp ${pm.min.toLocaleString('id-ID')} untuk ${pm.label || methodKey}`)
  }
  if (pm.need_phone && !phone) {
    throw new Error(`Metode ${pm.label || methodKey} membutuhkan nomor HP`)
  }

  // Fresh jar per payment attempt to avoid stale session issues across users
  jar = ''

  const donateUrl = `${BASE}/${sbUser}/donate`
  let home
  try {
    home = await api.get(donateUrl, { headers: { Accept: 'text/html' } })
  } catch (err) {
    throw new Error(`Gagal membuka halaman donasi Sociabuzz: ${err.message}`)
  }

  const csrf = extractCsrf(home.data)
  if (!csrf) {
    throw new Error('Username Sociabuzz tidak ditemukan atau halaman donasi tidak bisa dibuka')
  }

  const body = {
    sb_token_csrf: csrf,
    currency: 'IDR',
    amount: String(amount),
    qty: '1',
    support_duration: '30',
    note: String(message || '').slice(0, 200),
    fullname: String(name || 'Donatur').slice(0, 64),
    email: email || `donatur${Date.now()}@gmail.com`,
    is_agree: '1',
    years18: '1',
    is_vote: '0',
    is_voice: '0',
    is_mediashare: '0',
    is_gif: '0',
    is_sound: '0',
    is_voicy: '0',
    vote_id: '',
    ms_maxtime: '',
    start_from: '0',
    ms_starthour: '0',
    ms_startminute: '0',
    ms_startsecond: '0',
    spin_check: '0',
    prev_url: donateUrl,
    hide_email: '0',
    is_tiktok: '0',
    tiktok_duration: '0',
    is_instagram: '0',
    instagram_duration: '0',
    wishlist_id: '',
    quickpay: '0'
  }

  let sub
  try {
    sub = await api.post(`${donateUrl}/get-form-queue`, new URLSearchParams(body).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: BASE,
        Referer: donateUrl,
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
  } catch (err) {
    throw new Error(`Gagal mengirim form donasi: ${err.message}`)
  }

  if (sub.data?.success !== 'true' && sub.data?.success !== true) {
    throw new Error(sub.data?.content?.form_alert || 'Gagal membuat donasi di Sociabuzz')
  }

  const paymentUrl = sub.data?.content?.redirect
  const token = paymentUrl?.split('/payment/x/')[1]?.split(/[?#]/)[0]
  if (!token) throw new Error('Gagal mendapatkan token pembayaran')

  const pay = await api.get(paymentUrl, { headers: { Accept: 'text/html' } })
  let csrf2 = extractCsrf(pay.data)
  if (csrf2) setCookie('sociabuzz_sb_cookie_csrf', csrf2)

  await api.get(`${BASE}/payment/pay/setting`, {
    params: {
      amount: String(amount),
      currency: 'IDR',
      base_amount: String(amount),
      base_currency: 'IDR',
      currency_def: 'IDR',
      convertion: 'IDR',
      country: 'Indonesia',
      feature: 'TRIBE',
      is_borne_fee: '1',
      risk: '',
      message: '',
      direct: '',
      service_fee: '1',
      token,
      country_account: ''
    }
  })

  const c = getCsrfFromJar()
  if (c) {
    setCookie('sociabuzz_sb_cookie_csrf', c)
    csrf2 = c
  }
  if (!csrf2) throw new Error('Gagal mengambil token pembayaran')

  const sendBody = {
    sb_token_csrf: csrf2,
    order_id: token,
    final_currency: 'IDR',
    currency_def: 'IDR',
    payment_method: methodKey,
    type_payment: pm.type_payment,
    source_payment: pm.source_payment,
    country: 'ID',
    country_pay: 'Indonesia'
  }
  if (phone) sendBody.phone_number = String(phone).replace(/[^\d+]/g, '')

  let res
  try {
    res = await api.post(`${BASE}/payment/send/create`, sendBody, {
      headers: {
        'Content-Type': 'application/json',
        Origin: BASE,
        Referer: paymentUrl,
        'X-Requested-With': 'XMLHttpRequest'
      }
    })
  } catch (err) {
    throw new Error(`Gagal membuat transaksi: ${err.message}`)
  }

  if (!res.data?.status) {
    throw new Error(res.data?.message || 'Pembayaran gagal dibuat')
  }

  const rd = res.data
  const total = cleanAmount(rd.data?.amount || rd.data?.total || amount)
  const fee = Math.max(0, total - amount)
  const id = trxId()
  const created = new Date().toISOString()
  const expiryMs = EXPIRY_MS[pm.group] || 30 * 60 * 1000
  const expired = new Date(Date.now() + expiryMs).toISOString()

  const paymentInfo = {
    method: methodKey,
    label: pm.label || methodKey,
    payment_method: rd.payment_method,
    type_payment: rd.type_payment,
    source_payment: rd.source_payment
  }
  if (rd.data?.qr_string) paymentInfo.qr_string = rd.data.qr_string
  if (rd.data?.account_number) paymentInfo.account_number = rd.data.account_number
  if (rd.data?.name) paymentInfo.bank_name = rd.data.name
  if (rd.data?.bank) paymentInfo.bank = rd.data.bank
  if (rd.data?.redirect_url) paymentInfo.redirect_url = rd.data.redirect_url
  if (rd.data?.payment_link) paymentInfo.payment_link = rd.data.payment_link
  if (rd.inv_id) {
    paymentInfo.inv_id = rd.inv_id
    paymentInfo.pending_url = `${BASE}/payment/pending?type=${rd.payment_method}&inv_id=${rd.inv_id}`
  }
  if (rd.data?.id) paymentInfo.transaction_id = rd.data.id

  const trx = {
    id,
    username: sbUser,
    order_id: token,
    payment_url: paymentUrl,
    payment_info: paymentInfo,
    amount,
    total_amount: total,
    fee,
    status: 'pending',
    created_at: created,
    expired_at: expired,
    paid_at: null,
    supporter: name || null,
    message: message || null
  }
  saveTrx(trx)
  return getTransaction(id)
}

export async function checkStatus(trxIdOrInv) {
  const trx = getTransaction(trxIdOrInv)
  if (!trx) return null
  if (trx.status === 'paid') return trx

  const pendingUrl = trx.payment_info?.pending_url
  if (!pendingUrl) return trx

  try {
    const res = await api.get(pendingUrl, {
      headers: { Accept: 'text/html' },
      timeout: 15000,
      validateStatus: () => true
    })
    const title = ((res.data || '').match(/<title>([^<]+)/) || ['', ''])[1] || ''
    const t = title.toLowerCase()
    let status = trx.status
    if (t.includes('success')) status = 'paid'
    else if (t.includes('expired')) status = 'expired'
    else if (t.includes('fail')) status = 'failed'
    else if (t.includes('pending')) status = 'pending'

    if (status !== trx.status) {
      const full = mem.get(trx.id)
      if (full) {
        full.status = status
        if (status === 'paid') full.paid_at = new Date().toISOString()
        saveTrx(full)
      }
    }
  } catch {}

  return getTransaction(trx.id)
}
