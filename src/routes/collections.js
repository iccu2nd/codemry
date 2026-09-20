import { Router } from 'express'
import { Collections, Snippets, Users, avatarUrl, stripSnippetSecrets } from '../db.js'

const router = Router()

function requireAuth(req, res, next) {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  next()
}

function summarize(c) {
  return {
    id: c.id,
    username: c.username,
    name: c.name,
    description: c.description || '',
    isPublic: c.isPublic !== false,
    count: (c.shortIds || []).length,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  }
}

// List collections for a user
router.get('/', async (req, res) => {
  try {
    const user = (req.query.user || '').trim()
    if (!user) return res.status(400).json({ error: 'user is required' })
    const isOwner = req.username && req.username.toLowerCase() === user.toLowerCase()
    const list = await Collections.forUser(user, { includePrivate: isOwner })
    res.json(list.map(summarize))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// My collections (auth)
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const list = await Collections.forUser(req.username, { includePrivate: true })
    res.json(list.map(summarize))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const c = await Collections.find(req.params.id)
    if (!c) return res.status(404).json({ error: 'Collection not found' })
    const isOwner = req.username && req.username.toLowerCase() === String(c.username || '').toLowerCase()
    if (c.isPublic === false && !isOwner) return res.status(404).json({ error: 'Collection not found' })

    const [all, users, owner] = await Promise.all([Snippets.all(), Users.all(), Users.find(c.username)])
    const byShort = new Map(all.map(s => [s.shortId, s]))
    const userByName = new Map(users.map(u => [u.username.toLowerCase(), u]))
    const snippets = []
    for (const sid of (c.shortIds || [])) {
      const s = byShort.get(sid)
      if (!s || !s.isPublic) continue
      const u = userByName.get(String(s.ownerUsername || '').toLowerCase())
      snippets.push({
        ...stripSnippetSecrets(s),
        ownerAvatar: u ? avatarUrl(u) : null,
        ownerNickname: u ? (u.nickname || u.username) : s.ownerUsername
      })
    }
    res.json({
      ...summarize(c),
      isOwner: !!isOwner,
      ownerNickname: owner ? (owner.nickname || owner.username) : c.username,
      ownerAvatar: owner ? avatarUrl(owner) : null,
      snippets
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/', requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Name is required' })
    const description = String(req.body?.description || '').trim()
    const isPublic = req.body?.isPublic !== false
    const c = await Collections.create({ username: req.username, name, description, isPublic })
    res.json(summarize(c))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const c = await Collections.find(req.params.id)
    if (!c) return res.status(404).json({ error: 'Collection not found' })
    if (String(c.username || '').toLowerCase() !== req.username.toLowerCase()) {
      return res.status(403).json({ error: 'Not allowed' })
    }
    const patch = {}
    if (typeof req.body?.name === 'string') patch.name = req.body.name
    if (typeof req.body?.description === 'string') patch.description = req.body.description
    if (typeof req.body?.isPublic === 'boolean') patch.isPublic = req.body.isPublic
    const updated = await Collections.update(req.params.id, req.username, patch)
    res.json(summarize(updated))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/:id/items', requireAuth, async (req, res) => {
  try {
    const shortId = String(req.body?.shortId || '').trim()
    if (!shortId) return res.status(400).json({ error: 'shortId is required' })
    const c = await Collections.find(req.params.id)
    if (!c) return res.status(404).json({ error: 'Collection not found' })
    if (String(c.username || '').toLowerCase() !== req.username.toLowerCase()) {
      return res.status(403).json({ error: 'Not allowed' })
    }
    const snip = await Snippets.findByShort(shortId)
    if (!snip) return res.status(404).json({ error: 'Code not found' })
    const updated = await Collections.addSnippet(req.params.id, req.username, shortId)
    res.json(summarize(updated))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id/items/:shortId', requireAuth, async (req, res) => {
  try {
    const c = await Collections.find(req.params.id)
    if (!c) return res.status(404).json({ error: 'Collection not found' })
    if (String(c.username || '').toLowerCase() !== req.username.toLowerCase()) {
      return res.status(403).json({ error: 'Not allowed' })
    }
    const updated = await Collections.removeSnippet(req.params.id, req.username, req.params.shortId)
    res.json(summarize(updated))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const c = await Collections.find(req.params.id)
    if (!c) return res.status(404).json({ error: 'Collection not found' })
    if (String(c.username || '').toLowerCase() !== req.username.toLowerCase()) {
      return res.status(403).json({ error: 'Not allowed' })
    }
    await Collections.remove(req.params.id, req.username)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
