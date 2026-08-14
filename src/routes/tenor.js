import { Router } from 'express'
import axios from 'axios'
import { scrapeGiphy } from './giphy.js'

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

function mapApiResults(results) {
    return (results || [])
        .map(item => ({
            id: item.id,
            previewUrl: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || null,
            url: item.media_formats?.gif?.url || item.media_formats?.tinygif?.url || null
        }))
        .filter(x => x.url)
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
    if (!node || depth > 12 || out.length >= 48) return out
    if (Array.isArray(node)) {
        for (const item of node) findGifObjects(item, out, depth + 1)
        return out
    }
    if (typeof node === 'object') {
        const mf = node.media_formats || (Array.isArray(node.media) ? node.media[0] : null)
        const gifUrl = mf?.gif?.url || mf?.tinygif?.url || node.url
        if (node.id && typeof gifUrl === 'string' && gifUrl.includes('tenor.com')) {
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
    while ((m = re.exec(html)) && results.length < 48) {
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

async function tenorGet(res, { query, path, params }) {
    try {
        const tenorPromise = TENOR_API_KEY ? fetchViaApi(path, params) : fetchViaScrape(query)
        // Giphy cuma nyumbang buat batch PERTAMA (reset, bukan "muat lagi")
        // -- scrape halamannya gak punya token pagination yang bisa
        // diandalkan kayak `next` punya Tenor, jadi "muat lagi" tetap
        // paginasi lewat Tenor doang.
        const giphyPromise = params?.pos ? Promise.resolve([]) : scrapeGiphy(query)
        const [tenorResult, giphyResults] = await Promise.all([tenorPromise, giphyPromise])
        res.json({ next: tenorResult.next, results: interleave(tenorResult.results, giphyResults) })
    } catch (e) {
        res.status(502).json({ error: e.response?.data?.error?.message || 'gagal ambil stiker' })
    }
}

router.get('/search', (req, res) => {
    const q = String(req.query.q || '').trim()
    if (!q) return res.status(400).json({ error: 'kata kunci kosong' })
    tenorGet(res, { query: q, path: 'search', params: { q, pos: req.query.pos || undefined } })
})

router.get('/featured', (req, res) => {
    // Halaman "gak ada query" ini yang paling sering dibuka orang (dibuka
    // duluan sebelum ngetik apa-apa), jadi limitnya sengaja dilebihin dari
    // default biar begitu picker kebuka udah langsung padat kayak
    // rekomendasi/"sedang tren" bawaan WhatsApp -- bukan cuma beberapa item.
    tenorGet(res, { query: '', path: 'featured', params: { limit: 60, pos: req.query.pos || undefined } })
})

export default router

