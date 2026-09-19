import axios from 'axios'

const API = 'https://api.github.com'
const TOKEN = process.env.GITHUB_TOKEN
const DB_REPO_NAME = process.env.GITHUB_DB_REPO_NAME || 'codery-db'
const ASSETS_REPO_NAME = process.env.GITHUB_ASSETS_REPO_NAME || 'codery-assets'

let DB_REPO = null
let ASSETS_REPO = null

function headers() {
    return {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Codery'
    }
}

async function repoExists(fullName) {
    try {
        await axios.get(`${API}/repos/${fullName}`, { headers: headers() })
        return true
    } catch (e) {
        if (e.response?.status === 404) return false
        throw e
    }
}

async function createRepo(name, isPrivate) {
    await axios.post(`${API}/user/repos`, {
        name,
        private: isPrivate,
        auto_init: true,
        description: isPrivate ? 'Codery data store (private)' : 'Codery public assets (avatars)'
    }, { headers: headers() })
}

export async function initGithub() {
    if (!TOKEN) throw new Error('GITHUB_TOKEN belum diisi di .env')
    const { data: user } = await axios.get(`${API}/user`, { headers: headers() })
    const login = user.login
    DB_REPO = `${login}/${DB_REPO_NAME}`
    ASSETS_REPO = `${login}/${ASSETS_REPO_NAME}`

    if (!(await repoExists(DB_REPO))) {
        console.log(`Repo ${DB_REPO} belum ada, membuat otomatis (private)...`)
        await createRepo(DB_REPO_NAME, true)
    }
    if (!(await repoExists(ASSETS_REPO))) {
        console.log(`Repo ${ASSETS_REPO} belum ada, membuat otomatis (public)...`)
        await createRepo(ASSETS_REPO_NAME, false)
    }
    console.log(`GitHub siap. DB: ${DB_REPO} | Assets: ${ASSETS_REPO}`)
}

// PENTING: app ini jalan di serverless (Vercel, lihat vercel.json) -- tiap
// request BISA ditangani proses/instance yang beda-beda, masing-masing
// punya memori sendiri-sendiri. `dbCache` cuma hidup di SATU instance itu.
//
// Sebelumnya cache ini gak punya kadaluarsa sama sekali (disimpen selamanya
// selama instance-nya "hangat"/reused). Itu sumber bug "upload kode gak
// ketemu" & "komentar stiker ilang": instance A yang nerima POST upload/komentar
// nulis ke GitHub DAN update cache lokalnya sendiri -- tapi kalau request
// berikutnya (mis. buka halaman detail kode buat ngeliat hasil upload/komentar
// tadi) nyasar ke instance B yang udah lebih dulu nyimpen snapshot lama
// snippets.json/comments.json di cache-nya, instance B gak akan pernah tau
// ada data baru & bakal terus jawab pake data basi (kode "tidak ditemukan",
// komentar ilang) sampe instance itu di-cold-start ulang (bisa berjam-jam).
//
// Fixnya: kasih TTL pendek (sama polanya kayak GIST_TTL_MS di bawah) biar
// tiap instance otomatis nyegat ulang data terbaru dalam hitungan detik --
// tetep kerasa cepet buat request yang beruntun (gak nembak GitHub API tiap
// kali), tapi gak nyimpen data basi lama-lama kalau nyasar ke instance lain.
const DB_CACHE_TTL_MS = 5_000
const dbCache = new Map()

function cacheGetDb(path) {
    const hit = dbCache.get(path)
    if (hit && Date.now() - hit.at < DB_CACHE_TTL_MS) return hit
    return null
}
function cacheSetDb(path, data, sha) {
    const entry = { data, sha, at: Date.now() }
    dbCache.set(path, entry)
    return entry
}

export async function readDbFile(path, { fresh = false } = {}) {
    if (!fresh) {
        const cached = cacheGetDb(path)
        if (cached) return cached
    }
    try {
        const res = await axios.get(`${API}/repos/${DB_REPO}/contents/${path}`, { headers: headers() })
        const content = Buffer.from(res.data.content, 'base64').toString('utf-8')
        return cacheSetDb(path, JSON.parse(content || '[]'), res.data.sha)
    } catch (e) {
        if (e.response?.status === 404) {
            return cacheSetDb(path, [], null)
        }
        throw e
    }
}

export async function writeDbFile(path, data, sha, message) {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
    const body = { message, content, branch: 'main' }
    if (sha) body.sha = sha
    try {
        const res = await axios.put(`${API}/repos/${DB_REPO}/contents/${path}`, body, { headers: headers() })
        const newSha = res.data.content.sha
        cacheSetDb(path, data, newSha)
        return newSha
    } catch (e) {
        if (e.response?.status === 409) dbCache.delete(path)
        throw e
    }
}

const GIST_TTL_MS = 20_000
const gistCache = new Map()
let gistListCache = null

function cacheGetGist(id) {
    const hit = gistCache.get(id)
    if (hit && Date.now() - hit.at < GIST_TTL_MS) return hit.data
    return null
}
function cacheSetGist(id, data) { gistCache.set(id, { data, at: Date.now() }) }

export async function createGist(files, description, isPublic) {
    const res = await axios.post(`${API}/gists`, { description, public: isPublic, files }, { headers: headers() })
    cacheSetGist(res.data.id, res.data)
    gistListCache = null
    return res.data
}

export async function getGist(id) {
    const cached = cacheGetGist(id)
    if (cached) return cached
    const res = await axios.get(`${API}/gists/${id}`, { headers: headers() })
    cacheSetGist(id, res.data)
    return res.data
}

export async function listGists() {
    if (gistListCache && Date.now() - gistListCache.at < GIST_TTL_MS) return gistListCache.data
    let page = 1
    let all = []
    while (true) {
        const res = await axios.get(`${API}/gists`, { headers: headers(), params: { per_page: 100, page } })
        all = all.concat(res.data)
        if (res.data.length < 100) break
        page++
    }
    gistListCache = { data: all, at: Date.now() }
    return all
}

export async function deleteGist(id) {
    await axios.delete(`${API}/gists/${id}`, { headers: headers() })
    gistCache.delete(id)
    gistListCache = null
}

export async function editGist(id, files, description) {
    const body = {}
    if (description !== undefined) body.description = description
    if (files) body.files = files
    const res = await axios.patch(`${API}/gists/${id}`, body, { headers: headers() })
    cacheSetGist(id, res.data)
    gistListCache = null
    return res.data
}

// PENTING: sebelumnya `assetShaCache`/`assetContentCache` ini gak punya
// kadaluarsa SAMA SEKALI -- sekali satu instance server nyimpen isi file
// gambar (avatar/banner) di cache-nya, dia gak akan pernah cek ulang ke
// GitHub lagi. Ini sumber bug "ganti foto profil kok gak berubah, malah
// balik lagi ke yang lama" -- instance server yang kebetulan nanganin
// request GET /avatar (atau /banner) abis nyimpen versi LAMA di cache-nya
// bakal terus-terusan balikin versi lama itu ke SEMUA orang yang minta
// (termasuk di feed, komentar, dst), walau kamu udah upload foto baru
// berkali-kali -- sampai instance itu di-recycle sendiri sama platform-nya
// (bisa berjam-jam). Fixnya sama polanya kayak `dbCache` di atas: kasih TTL
// pendek, jadi tiap instance otomatis nyegat ulang isi file yang terbaru
// dalam hitungan detik.
const ASSET_TTL_MS = 5_000
const assetShaCache = new Map()
const assetContentCache = new Map()

function cacheGetAssetSha(path) {
    const hit = assetShaCache.get(path)
    if (hit && Date.now() - hit.at < ASSET_TTL_MS) return hit.sha
    return undefined
}
function cacheSetAssetSha(path, sha) { assetShaCache.set(path, { sha, at: Date.now() }) }

function cacheGetAssetContent(path) {
    const hit = assetContentCache.get(path)
    if (hit && Date.now() - hit.at < ASSET_TTL_MS) return hit.buf
    return null
}
function cacheSetAssetContent(path, buf) { assetContentCache.set(path, { buf, at: Date.now() }) }

async function fetchAssetSha(path) {
    try {
        const existing = await axios.get(`${API}/repos/${ASSETS_REPO}/contents/${path}`, { headers: headers() })
        return existing.data.sha
    } catch (e) {
        if (e.response?.status === 404) return null
        throw e
    }
}

export async function upsertAsset(path, base64Content, message) {
    let sha = cacheGetAssetSha(path)
    if (sha === undefined) sha = await fetchAssetSha(path)
    const body = { message, content: base64Content, branch: 'main' }
    if (sha) body.sha = sha
    try {
        const res = await axios.put(`${API}/repos/${ASSETS_REPO}/contents/${path}`, body, { headers: headers() })
        cacheSetAssetSha(path, res.data.content.sha)
        cacheSetAssetContent(path, Buffer.from(base64Content, 'base64'))
        return res.data.content.download_url
    } catch (e) {
        if (e.response?.status === 409) {
            const freshSha = await fetchAssetSha(path)
            const retryRes = await axios.put(`${API}/repos/${ASSETS_REPO}/contents/${path}`,
                { ...body, sha: freshSha }, { headers: headers() })
            cacheSetAssetSha(path, retryRes.data.content.sha)
            cacheSetAssetContent(path, Buffer.from(base64Content, 'base64'))
            return retryRes.data.content.download_url
        }
        throw e
    }
}

export async function getAssetContent(path) {
    const cached = cacheGetAssetContent(path)
    if (cached) return cached
    const res = await axios.get(`${API}/repos/${ASSETS_REPO}/contents/${path}`, { headers: headers() })
    const buf = Buffer.from(res.data.content, 'base64')
    cacheSetAssetContent(path, buf)
    cacheSetAssetSha(path, res.data.sha)
    return buf
}
