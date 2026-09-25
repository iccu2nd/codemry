import { Router } from 'express'
import { Users, Messages, Blocks, Notifications, avatarUrl } from '../db.js'

const router = Router()

router.get('/conversations', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  try {
    const list = await Messages.conversations(req.username)
    const users = await Users.all()
    const by = new Map(users.map(u => [u.username.toLowerCase(), u]))
    res.json(list.map(m => {
      const u = by.get(String(m.otherUsername || '').toLowerCase())
      return {
        otherUsername: u?.username || m.otherUsername,
        otherNickname: u?.nickname || u?.username || m.otherUsername,
        otherAvatar: u ? avatarUrl(u) : null,
        lastText: m.text,
        lastAt: m.createdAt,
        unread: !m.read && String(m.to || '').toLowerCase() === req.username.toLowerCase()
      }
    }))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/unread', async (req, res) => {
  if (!req.username) return res.json({ count: 0 })
  try {
    res.json({ count: await Messages.unreadCount(req.username) })
  } catch {
    res.json({ count: 0 })
  }
})

router.get('/with/:username', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  const other = await Users.find(req.params.username)
  if (!other) return res.status(404).json({ error: 'User not found' })
  if (await Blocks.isBlocked(req.username, other.username) || await Blocks.isBlocked(other.username, req.username)) {
    return res.status(403).json({ error: 'Cannot message this user' })
  }
  try {
    const messages = await Messages.between(req.username, other.username, 150)
    await Messages.markRead(req.username, other.username)
    res.json({
      other: { username: other.username, nickname: other.nickname || other.username, avatar: avatarUrl(other) },
      messages
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/with/:username', async (req, res) => {
  if (!req.username) return res.status(401).json({ error: 'Please sign in' })
  const other = await Users.find(req.params.username)
  if (!other) return res.status(404).json({ error: 'User not found' })
  if (req.username.toLowerCase() === other.username.toLowerCase()) {
    return res.status(400).json({ error: 'Cannot message yourself' })
  }
  if (await Blocks.isBlocked(req.username, other.username) || await Blocks.isBlocked(other.username, req.username)) {
    return res.status(403).json({ error: 'Cannot message this user' })
  }
  try {
    const text = String(req.body?.text || '').trim()
    const msg = await Messages.send(req.username, other.username, text)
    Notifications.create({
      username: other.username,
      fromUsername: req.username,
      type: 'message',
      text: text.slice(0, 120)
    }).catch(() => {})
    res.json(msg)
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

export default router
