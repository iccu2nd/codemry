import { Router } from 'express'
import { Collections, Series, Snippets, Users, avatarUrl, stripSnippetSecrets, lockedSnippetStub, isSnippetExpired } from '../db.js'

const router = Router()

router.get('/mine', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  res.json(await Collections.byUser(req.username))
})

router.get('/user/:username', async (req, res) => {
  const list = await Collections.byUser(req.params.username)
  // public view: only names + counts
  res.json(list.map(c => ({
    id: c.id,
    name: c.name,
    count: (c.shortIds || []).length,
    owner: c.owner,
    updatedAt: c.updatedAt
  })))
})

router.post('/', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  try {
    const col = await Collections.create(req.username, req.body?.name)
    res.json(col)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.patch('/:id', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  const col = await Collections.rename(req.params.id, req.username, req.body?.name)
  if (!col) return res.status(404).json({ error: 'Not found' })
  res.json(col)
})

router.delete('/:id', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  await Collections.remove(req.params.id, req.username)
  res.json({ ok: true })
})

router.post('/:id/toggle', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  const shortId = String(req.body?.shortId || '')
  if (!shortId) return res.status(400).json({ error: 'shortId required' })
  const col = await Collections.toggleCode(req.params.id, req.username, shortId)
  if (!col) return res.status(404).json({ error: 'Not found' })
  res.json(col)
})

router.get('/:id/codes', async (req, res) => {
  const col = await Collections.find(req.params.id)
  if (!col) return res.status(404).json({ error: 'Not found' })
  const isOwner = req.username && req.username === col.owner
  const live = await Snippets.allLive()
  const byId = new Map(live.map(s => [s.shortId, s]))
  const codes = (col.shortIds || []).map(id => byId.get(id)).filter(Boolean)
    .filter(s => isOwner || (s.isPublic && !isSnippetExpired(s)))
    .map(s => {
      if (s.locked && s.ownerUsername !== req.username) return lockedSnippetStub(s)
      return stripSnippetSecrets(s)
    })
  res.json({ collection: { id: col.id, name: col.name, owner: col.owner }, codes })
})

// Series
router.get('/series/mine', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  res.json(await Series.byUser(req.username))
})

router.get('/series/user/:username', async (req, res) => {
  res.json(await Series.byUser(req.params.username))
})

router.post('/series', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  try {
    const series = await Series.create(req.username, req.body?.title, req.body?.shortIds || [])
    res.json(series)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.patch('/series/:id', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  const series = await Series.update(req.params.id, req.username, req.body || {})
  if (!series) return res.status(404).json({ error: 'Not found' })
  res.json(series)
})

router.delete('/series/:id', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  await Series.remove(req.params.id, req.username)
  res.json({ ok: true })
})

router.get('/series/:id', async (req, res) => {
  const series = await Series.find(req.params.id)
  if (!series) return res.status(404).json({ error: 'Not found' })
  const isOwner = req.username && req.username === series.owner
  const live = await Snippets.allLive()
  const byId = new Map(live.map(s => [s.shortId, s]))
  const codes = (series.shortIds || []).map(id => byId.get(id)).filter(Boolean)
    .filter(s => isOwner || (s.isPublic && !isSnippetExpired(s)))
  res.json({ series, codes: codes.map(s => stripSnippetSecrets(s)) })
})

export default router
