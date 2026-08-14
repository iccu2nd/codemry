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

const dbCache = new Map()

export async function readDbFile(path) {
    if (dbCache.has(path)) return dbCache.get(path)
    try {
        const res = await axios.get(`${API}/repos/${DB_REPO}/contents/${path}`, { headers: headers() })
        const content = Buffer.from(res.data.content, 'base64').toString('utf-8')
        const result = { data: JSON.parse(content || '[]'), sha: res.data.sha }
        dbCache.set(path, result)
        return result
    } catch (e) {
        if (e.response?.status === 404) {
            const result = { data: [], sha: null }
            dbCache.set(path, result)
            return result
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
        dbCache.set(path, { data, sha: newSha })
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

const assetShaCache = new Map()
const assetContentCache = new Map()

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
    let sha = assetShaCache.has(path) ? assetShaCache.get(path) : await fetchAssetSha(path)
    const body = { message, content: base64Content, branch: 'main' }
    if (sha) body.sha = sha
    try {
        const res = await axios.put(`${API}/repos/${ASSETS_REPO}/contents/${path}`, body, { headers: headers() })
        assetShaCache.set(path, res.data.content.sha)
        assetContentCache.set(path, Buffer.from(base64Content, 'base64'))
        return res.data.content.download_url
    } catch (e) {
        if (e.response?.status === 409) {
            const freshSha = await fetchAssetSha(path)
            const retryRes = await axios.put(`${API}/repos/${ASSETS_REPO}/contents/${path}`,
                { ...body, sha: freshSha }, { headers: headers() })
            assetShaCache.set(path, retryRes.data.content.sha)
            assetContentCache.set(path, Buffer.from(base64Content, 'base64'))
            return retryRes.data.content.download_url
        }
        throw e
    }
}

export async function getAssetContent(path) {
    if (assetContentCache.has(path)) return assetContentCache.get(path)
    const res = await axios.get(`${API}/repos/${ASSETS_REPO}/contents/${path}`, { headers: headers() })
    const buf = Buffer.from(res.data.content, 'base64')
    assetContentCache.set(path, buf)
    assetShaCache.set(path, res.data.sha)
    return buf
}
