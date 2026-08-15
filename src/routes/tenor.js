import { Router } from 'express'
import axios from 'axios'
import { giphyGet } from './giphy.js'

const router = Router()

// Sumber stiker digabung dari DUA tempat: Tenor (utama, lewat API key kalau
// ADA) + Giphy (scrape doang, lihat giphy.js) -- hasilnya diselang-seling
// di tenorGet() lewat interleave(). API key Tenor disimpan di server (env
// var), gak pernah dikirim ke browser. Kalau ADA, dipakai (lebih
// stabil/resmi). Kalau KOSONG, otomatis fallback scraping halaman
// tenor.com langsung -- gak butuh API key sama sekali, tapi lebih rapuh
// karena nempel ke struktur halaman mereka yang bisa berubah kapan aja
// (khas scraper: kalau suatu saat berhenti kerja, cek lagi lewat Test
// Scraper, kemungkinan besar cuma butuh nyesuaiin selector/JSON path-nya
// di findGifObjects()).
const TENOR_API_KEY = process.env.TENOR_API_KEY
const CLIENT_KEY = 'codery-app'
const SCRAPE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
}

// Sticker/GIF yang bentuknya kelewat lonjong (mis. rasio 16:9 landscape
// atau 9:16 portrait) keluar aneh pas dipajang di grid kotak-kotak kayak
// TikTok/WhatsApp -- makanya kita saring biar yang lolos itu yang bentuknya
// "agak kotak" (mendekati 1:1), sama kayak sticker pack pada umumnya.
// Rentang 0.72-1.4 masih ngasih toleransi buat gambar sedikit persegi
// panjang, tapi nolak yang jelas-jelas 16:9/9:16.
function isSquareish(w, h) {
    if (!w || !h) return true // gak ada info dimensi -> jangan dibuang, biar difilter di sisi client aja
    const ratio = w / h
    return ratio >= 0.72 && ratio <= 1.4
}

function mapApiResults(results) {
    return (results || [])
        .map(item => {
            const fmt = item.media_formats?.tinygif || item.media_formats?.gif
            const [w, h] = fmt?.dims || []
            return {
                id: item.id,
                previewUrl: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || null,
                url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url || null,
                w, h
            }
        })
        .filter(x => x.url && isSquareish(x.w, x.h))
}

async function fetchViaApi(path, params) {
    const { data } = await axios.get(`https://tenor.googleapis.com/v2/${path}`, {
        params: { key: TENOR_API_KEY, client_key: CLIENT_KEY, limit: 50, contentfilter: 'medium', media_filter: 'tinygif,gif', ...params }
    })
    return { next: data.next || '', results: mapApiResults(data.results) }
}

// Nyari rekursif di dalam JSON __NEXT_DATA__ halaman tenor.com buat nemuin
// array hasil GIF -- dibikin rekursif (bukan path tetap kayak
// `props.pageProps.xxx`) soalnya struktur Next.js mereka bisa beda-beda
// tergantung versi & gampang berubah; ini lebih tahan banting walau gak
// 100% ngejamin selamanya.
function findGifObjects(node, out = [], depth = 0) {
    if (!node || depth > 12 || out.length >= 200) return out
    if (Array.isArray(node)) {
        for (const item of node) findGifObjects(item, out, depth + 1)
        return out
    }
    if (typeof node === 'object') {
        const mf = node.media_formats || (Array.isArray(node.media) ? node.media[0] : null)
        const gifUrl = mf?.gif?.url || mf?.tinygif?.url || node.url
        const dimsSrc = mf?.tinygif || mf?.gif
        const [w, h] = dimsSrc?.dims || []
        if (node.id && typeof gifUrl === 'string' && gifUrl.includes('tenor.com') && isSquareish(w, h)) {
            out.push({
                id: String(node.id),
                url: mf?.gif?.url || gifUrl,
                previewUrl: mf?.tinygif?.url || mf?.gif?.url || gifUrl
            })
        }
        for (const key in node) findGifObjects(node[key], out, depth + 1)
    }
    return out
}

// Fallback kalau __NEXT_DATA__ gak ketemu/berubah bentuk: comot langsung
// semua link media*.tenor.com yang nongol di HTML mentah. PENTING: CDN
// gif Tenor sekarang dilayani dari subdomain BERNOMOR (media1.tenor.com,
// media2.tenor.com, dst) -- bukan lagi domain polos "media.tenor.com"
// (itu sekarang cuma dipakai buat aset non-gif kayak .webm di meta tag).
// Regex lama yang nembak persis "media.tenor.com" gak bakal dapet apa-apa
// di halaman Tenor yang sekarang, makanya sekarang \d* biar match subdomain
// bernomor juga (pola yang sama kayak dipakai buat Giphy di giphy.js).
function scrapeGifUrlsFromHtml(html) {
    const seen = new Set()
    const results = []
    const re = /https:\\?\/\\?\/media\d*\.tenor\.com\\?\/[^"'\s\\]+\.(?:gif|mp4)/g
    let m
    while ((m = re.exec(html)) && results.length < 200) {
        const url = m[0].replace(/\\\//g, '/')
        if (seen.has(url) || !url.endsWith('.gif')) continue
        seen.add(url)
        results.push({ id: url, url, previewUrl: url })
    }
    return results
}

async function fetchViaScrape(query) {
    const url = query
        ? `https://tenor.com/search/${encodeURIComponent(query.replace(/\s+/g, '-'))}-gifs`
        : `https://tenor.com/search/trending-gifs`
    const { data: html } = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 10000 })
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    let results = []
    if (match) {
        try {
            const json = JSON.parse(match[1])
            results = findGifObjects(json)
        } catch { /* lanjut ke fallback regex di bawah */ }
    }
    if (!results.length) results = scrapeGifUrlsFromHtml(html)
    return { next: '', results }
}

// Selang-seling hasil Tenor & Giphy (T G T T G T T G ...) daripada nempel
// blok-blokan -- biar grid keliatan campur dari awal, gak keliatan
// "separuh atas Tenor, separuh bawah Giphy". Dedupe pake url final biar
// gak ada dua kotak sama persis kalau kebetulan collide.
function interleave(primary, secondary) {
    const out = []
    const seen = new Set()
    let gi = 0
    primary.forEach((item, i) => {
        if (!seen.has(item.url)) { seen.add(item.url); out.push(item) }
        if ((i + 1) % 3 === 0 && gi < secondary.length) {
            const g = secondary[gi++]
            if (!seen.has(g.url)) { seen.add(g.url); out.push(g) }
        }
    })
    while (gi < secondary.length) {
        const g = secondary[gi++]
        if (!seen.has(g.url)) { seen.add(g.url); out.push(g) }
    }
    return out
}

// GIPHY dijadiin sumber UTAMA di sini, Tenor jadi pelengkap -- soalnya
// GIPHY itu provider asli yang beneran dipakai TikTok buat fitur cari
// stiker mereka (kerjasama resmi GIPHY x TikTok sejak 2019), jadi biar
// "berasa kayak TikTok" susunannya dibalik dari sebelumnya (dulu Tenor
// yang utama). Tenor tetap disisipin sebagai variasi tambahan karena API-nya
// sendiri sudah dimatikan Google (per 30 Juni 2026) tapi situs tenor.com-nya
// masih hidup dan masih bisa di-scrape langsung.
//
// "Muat lagi" sekarang bisa narik dari DUA sumber sekaligus (bukan cuma
// Tenor kayak sebelumnya), jadi progress masing-masing sumber (posisi
// scroll Tenor + offset GIPHY) digabung jadi satu token base64 yang
// dikirim balik ke client sebagai `next`. Client gak perlu tau isinya,
// cukup kirim balik apa adanya pas klik "Muat lagi". Kalau salah satu
// sumber udah abis (gd/td = done), sumber itu berhenti dipanggil lagi
// tapi sumber yang lain tetap bisa lanjut.
function encodePos(gOffset, gDone, tPos, tDone) {
    if (gDone && tDone) return ''
    return Buffer.from(JSON.stringify([gOffset, gDone ? 1 : 0, tPos || '', tDone ? 1 : 0])).toString('base64')
}
function decodePos(raw) {
    if (!raw) return { g: 0, gd: false, t: '', td: false }
    try {
        const [g, gd, t, td] = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
        return { g: g || 0, gd: !!gd, t: t || '', td: !!td }
    } catch {
        return { g: 0, gd: false, t: '', td: false }
    }
}

async function tenorGet(res, { query, path, extraParams, rawPos }) {
    try {
        const cur = decodePos(rawPos)

        let tenorResult, tDone = cur.td
        if (cur.td) {
            tenorResult = { next: '', results: [] }
        } else if (TENOR_API_KEY) {
            tenorResult = await fetchViaApi(path, { ...extraParams, pos: cur.t || undefined })
            tDone = !tenorResult.next
        } else {
            tenorResult = await fetchViaScrape(query)
            tDone = true // scrape cuma dapet satu halaman, gak ada pagination asli
        }

        let giphyResult, gOffset = cur.g, gDone = cur.gd
        if (cur.gd) {
            giphyResult = { results: [] }
        } else {
            giphyResult = await giphyGet(query, cur.g)
            const got = giphyResult.count ?? giphyResult.results.length
            gOffset = cur.g + got
            gDone = !got || gOffset >= (giphyResult.total ?? gOffset)
        }

        const next = encodePos(gOffset, gDone, tenorResult.next || cur.t, tDone)
        res.json({ next, results: interleave(giphyResult.results, tenorResult.results) })
    } catch (e) {
        res.status(502).json({ error: e.response?.data?.error?.message || 'gagal ambil stiker' })
    }
}

router.get('/search', (req, res) => {
    const q = String(req.query.q || '').trim()
    if (!q) return res.status(400).json({ error: 'kata kunci kosong' })
    tenorGet(res, { query: q, path: 'search', extraParams: { q }, rawPos: req.query.pos })
})

router.get('/featured', (req, res) => {
    // Halaman "gak ada query" ini yang paling sering dibuka orang (dibuka
    // duluan sebelum ngetik apa-apa), jadi limitnya sengaja dilebihin dari
    // default biar begitu picker kebuka udah langsung padat kayak
    // rekomendasi/"sedang tren" bawaan WhatsApp -- bukan cuma beberapa item.
    tenorGet(res, { query: '', path: 'featured', extraParams: { limit: 60 }, rawPos: req.query.pos })
})

export default router

