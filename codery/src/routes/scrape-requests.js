import { Router } from 'express'
import crypto from 'crypto'
import { ScrapeRequests } from '../db.js'

const router = Router()

router.post('/', async (req, res) => {
    const { url, description, imageBase64 } = req.body
    if (!url || !String(url).trim()) return res.status(400).json({ error: 'url wajib diisi' })
    if (!/^https?:\/\/.+/i.test(String(url).trim())) return res.status(400).json({ error: 'url harus diawali http:// atau https://' })
    if (!description || !String(description).trim()) return res.status(400).json({ error: 'deskripsi wajib diisi' })

    const entry = {
        id: crypto.randomUUID(),
        username: req.username || null,
        url: String(url).trim().slice(0, 500),
        description: String(description).trim().slice(0, 1000),
        image: imageBase64 ? String(imageBase64).slice(0, 3_000_000) : null,
        status: 'pending',
        createdAt: Date.now()
    }

    try {
        await ScrapeRequests.create(entry)
        res.json({ ok: true, id: entry.id })
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message || 'gagal kirim request, coba lagi' })
    }
})

router.get('/', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    try {
        const all = await ScrapeRequests.all()
        res.json(all.sort((a, b) => b.createdAt - a.createdAt))
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

router.post('/:id/claim', async (req, res) => {
    if (!req.username) return res.status(401).json({ error: 'login dulu' })
    try {
        const updated = await ScrapeRequests.claim(req.params.id, req.username)
        if (!updated || updated.status !== 'claimed' || updated.claimedBy !== req.username) {
            return res.status(400).json({ error: 'request sudah diambil orang lain atau tidak ditemukan' })
        }
        res.json(updated)
    } catch (e) {
        res.status(500).json({ error: e.response?.data?.message || e.message })
    }
})

export default router
