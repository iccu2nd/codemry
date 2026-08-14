import axios from 'axios'

// Giphy TIDAK dipanggil lewat API resmi mereka sama sekali di sini --
// selalu scrape HTML halaman giphy.com langsung (beda sama Tenor yang
// masih ada opsi API key). ID unik diambil dari path media-nya sendiri
// (mediaN.giphy.com/media/{id}/...), BUKAN dari slug di URL /gifs/...,
// jadi gak perlu parsing __NEXT_DATA__ yang gampang berubah struktur --
// cukup comot semua link media.giphy.com yang nongol di HTML mentahnya.
// Sama kayak scraper Tenor: rapuh karena nempel struktur halaman mereka,
// kalau suatu saat berhenti kerja kemungkinan besar cuma butuh nyesuaiin
// regex-nya.
const SCRAPE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
}

function scrapeGifUrlsFromHtml(html) {
    const seen = new Set()
    const results = []
    const re = /https:\/\/media\d*\.giphy\.com\/media\/([^\/"'\s]+)\/(?:200\.gif|giphy\.gif|giphy\.webp)/g
    let m
    while ((m = re.exec(html)) && results.length < 48) {
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

// `query` kosong -> halaman /trending (dipakai buat rekomendasi awal pas
// picker kebuka belum ngetik apa-apa). Kalau gagal (misal struktur halaman
// mereka berubah / lagi diblokir), balikin array kosong -- jangan sampe
// bikin seluruh picker error cuma gara-gara satu sumber gagal.
export async function scrapeGiphy(query) {
    try {
        const url = query
            ? `https://giphy.com/explore/${encodeURIComponent(query.trim().replace(/\s+/g, '-'))}`
            : `https://giphy.com/trending`
        const { data: html } = await axios.get(url, { headers: SCRAPE_HEADERS, timeout: 10000 })
        return scrapeGifUrlsFromHtml(html)
    } catch {
        return []
    }
}
