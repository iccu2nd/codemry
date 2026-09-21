import axios from 'axios'

// Giphy dijadiin sumber UTAMA stiker (lihat tenor.js) karena ini provider
// ASLI yang beneran dipakai TikTok buat fitur cari stiker mereka.
//
// Dua mode, sama polanya kayak Tenor di tenor.js:
//   - ADA GIPHY_API_KEY -> pakai API resmi mereka (stabil, punya pagination
//     asli lewat `offset`, gak rapuh ke perubahan struktur halaman).
//   - KOSONG -> fallback scrape HTML giphy.com langsung (coba baca JSON
//     state ke-embed di halaman dulu buat dapetin width/height asli tiap
//     GIF, kalau gak ketemu baru jatoh ke regex comot link media.giphy.com
//     mentah-mentah). Mode ini cuma dapet SATU halaman awal, gak ada
//     pagination asli.
// API key gak pernah dikirim ke browser -- disimpen di server doang.
const GIPHY_API_KEY = process.env.GIPHY_API_KEY
const SCRAPE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
}

// Skema publik GIPHY (dipakai juga di API resmi mereka): tiap item GIF/stiker
// punya field `images` isinya beberapa rendisi, masing-masing punya url +
// width/height sendiri-sendiri. Kita pakai rendisi "fixed_width" (pas buat
// preview grid kecil) atau "original" sebagai cadangan.
function isSquareish(w, h) {
    if (!w || !h) return true
    const ratio = Number(w) / Number(h)
    return ratio >= 0.72 && ratio <= 1.4
}

// --- Mode API resmi (butuh GIPHY_API_KEY) ---------------------------------

async function fetchViaApi(query, offset) {
    const endpoint = query ? 'search' : 'trending'
    const { data } = await axios.get(`https://api.giphy.com/v1/gifs/${endpoint}`, {
        params: {
            api_key: GIPHY_API_KEY,
            q: query || undefined,
            limit: 50,
            offset,
            rating: 'pg-13',
            lang: 'id'
        }
    })
    const results = (data.data || [])
        .map(item => {
            const rend = item.images?.fixed_width || item.images?.original
            return {
                id: `gph_${item.id}`,
                previewUrl: rend?.url || null,
                url: item.images?.original?.url || rend?.url || null,
                w: Number(rend?.width), h: Number(rend?.height)
            }
        })
        .filter(x => x.url && isSquareish(x.w, x.h))
    return {
        results,
        total: data.pagination?.total_count ?? results.length,
        count: data.pagination?.count ?? results.length
    }
}

// --- Mode scrape (tanpa API key) ------------------------------------------

function findGiphyObjects(node, out = [], depth = 0) {
    if (!node || depth > 14 || out.length >= 200) return out
    if (Array.isArray(node)) {
        for (const item of node) findGiphyObjects(item, out, depth + 1)
        return out
    }
    if (typeof node === 'object') {
        const images = node.images
        if (node.id && images && typeof images === 'object') {
            const rend = images.fixed_width || images.original || images.downsized
            const url = rend?.url
            if (typeof url === 'string' && url.includes('giphy.com') && isSquareish(rend?.width, rend?.height)) {
                out.push({ id: `gph_${node.id}`, previewUrl: url, url: images.original?.url || url })
            }
        }
        for (const key in node) findGiphyObjects(node[key], out, depth + 1)
    }
    return out
}

function scrapeGifUrlsFromHtml(html) {
    const seen = new Set()
    const results = []
    const re = /https:\/\/media\d*\.giphy\.com\/media\/([^\/"'\s]+)\/(?:200\.gif|giphy\.gif|giphy\.webp)/g
    let m
    while ((m = re.exec(html)) && results.length < 200) {
        const mediaId = m[1]
        if (seen.has(mediaId)) continue
        seen.add(mediaId)
        results.push({
            id: `gph_${mediaId}`,
            previewUrl: `https://media.giphy.com/media/${mediaId}/200.gif`,
            url: `https://media.giphy.com/media/${mediaId}/giphy.gif`
        })
    }
    return results
}

async function fetchViaScrape(query) {
    const url = query
        ? `https://giphy.com/explore/${encodeURIComponent(query.trim().replace(/\s+/g, '-'))}`
        : `https://giphy.com/trending`
    const { data: html } = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 10000 })
    const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
        || html.match(/<script[^>]*>window\.__remixContext\s*=\s*({[\s\S]*?})<\/script>/)
    let results = []
    if (scriptMatch) {
        try {
            results = findGiphyObjects(JSON.parse(scriptMatch[1]))
        } catch { /* lanjut ke fallback regex di bawah */ }
    }
    if (!results.length) results = scrapeGifUrlsFromHtml(html)
    return { results, total: results.length, count: results.length }
}

// Entry point dipakai tenor.js. `offset` cuma relevan pas mode API (buat
// "muat lagi" beneran); di mode scrape diabaikan karena cuma ada satu
// halaman. Kalau gagal (struktur halaman berubah / API error / lagi
// diblokir), balikin kosong -- jangan sampe bikin seluruh picker error
// cuma gara-gara satu sumber gagal.
export async function giphyGet(query, offset) {
    try {
        if (GIPHY_API_KEY) return await fetchViaApi(query, offset)
        return await fetchViaScrape(query)
    } catch {
        return { results: [], total: 0, count: 0 }
    }
}
