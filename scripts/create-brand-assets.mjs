import { createCanvas } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'public')
const ICONS = path.join(OUT, 'icons')
fs.mkdirSync(ICONS, { recursive: true })

const DARK = '#0c0c0c'
const WHITE = '#f0f0f0'

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawMark(ctx, size, { bg = DARK, fg = WHITE } = {}) {
  const r = size * 0.22
  ctx.fillStyle = bg
  roundRect(ctx, 0, 0, size, size, r)
  ctx.fill()

  ctx.strokeStyle = fg
  ctx.lineWidth = Math.max(2, size * 0.09)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const cx = size / 2
  const cy = size / 2
  const h = size * 0.38
  const w = size * 0.22

  ctx.beginPath()
  ctx.moveTo(cx - w * 0.15, cy - h / 2)
  ctx.lineTo(cx - w * 1.05, cy)
  ctx.lineTo(cx - w * 0.15, cy + h / 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx + w * 0.15, cy - h / 2)
  ctx.lineTo(cx + w * 1.05, cy)
  ctx.lineTo(cx + w * 0.15, cy + h / 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx + w * 0.35, cy - h * 0.55)
  ctx.lineTo(cx - w * 0.35, cy + h * 0.55)
  ctx.stroke()
}

function renderPng(size, file) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  drawMark(ctx, size)
  fs.writeFileSync(file, canvas.toBuffer('image/png'))
  console.log('wrote', path.relative(process.cwd(), file), `(${size}x${size})`)
}

renderPng(512, path.join(OUT, 'icon-512.png'))
renderPng(192, path.join(OUT, 'icon-192.png'))
renderPng(180, path.join(OUT, 'apple-touch-icon.png'))
renderPng(48, path.join(ICONS, 'favicon-48x48.png'))
renderPng(32, path.join(ICONS, 'favicon-32x32.png'))
renderPng(16, path.join(ICONS, 'favicon-16x16.png'))

fs.copyFileSync(path.join(ICONS, 'favicon-32x32.png'), path.join(OUT, 'favicon-32x32.png'))
fs.copyFileSync(path.join(ICONS, 'favicon-16x16.png'), path.join(OUT, 'favicon-16x16.png'))
fs.copyFileSync(path.join(OUT, 'icon-512.png'), path.join(OUT, 'logo.png'))

// Static OG 1200x630
const W = 1200, H = 630
const og = createCanvas(W, H)
const octx = og.getContext('2d')
octx.fillStyle = '#eaf5fc'
octx.fillRect(0, 0, W, H)
const cx = 80, cy = 70, cw = W - 160, ch = H - 140
octx.fillStyle = 'rgba(0,0,0,0.08)'
roundRect(octx, cx + 8, cy + 10, cw, ch, 28)
octx.fill()
octx.fillStyle = '#ffffff'
roundRect(octx, cx, cy, cw, ch, 28)
octx.fill()

const markSize = 120
const mx = cx + 60, my = cy + (ch - markSize) / 2 - 20
octx.save()
octx.translate(mx, my)
drawMark(octx, markSize)
octx.restore()

octx.fillStyle = '#17293d'
octx.font = '700 64px sans-serif'
octx.textBaseline = 'middle'
octx.fillText('Codery', mx + markSize + 36, my + markSize / 2 - 12)
octx.fillStyle = '#6b7280'
octx.font = '500 28px sans-serif'
octx.fillText('Code Sharing Platform', mx + markSize + 36, my + markSize / 2 + 36)
octx.fillStyle = '#2f8fd6'
octx.font = '500 22px sans-serif'
const domain = 'codery.my.id'
octx.fillText(domain, cx + cw - 60 - octx.measureText(domain).width, cy + 48)
fs.writeFileSync(path.join(OUT, 'og-image.png'), og.toBuffer('image/png'))
console.log('wrote og-image.png')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="Codery">
  <rect width="512" height="512" rx="112" fill="#0c0c0c"/>
  <g fill="none" stroke="#f0f0f0" stroke-width="46" stroke-linecap="round" stroke-linejoin="round">
    <path d="M218 156 L140 256 L218 356"/>
    <path d="M294 156 L372 256 L294 356"/>
    <path d="M300 140 L212 372"/>
  </g>
</svg>
`
fs.writeFileSync(path.join(OUT, 'logo.svg'), svg)
console.log('wrote logo.svg')
console.log('done')
