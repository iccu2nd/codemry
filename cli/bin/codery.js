#!/usr/bin/env node
// Codery CLI — small terminal client for the Codery public API (/api/public).
// No dependencies: uses Node's built-in fetch (Node >= 18) and fs/path/os only.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CONFIG_DIR = path.join(os.homedir(), '.codery')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

const EXT_LANG = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
  swift: 'swift', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cs: 'csharp',
  php: 'php', html: 'html', htm: 'html', css: 'css', scss: 'css',
  json: 'json', yml: 'yaml', yaml: 'yaml', sh: 'bash', bash: 'bash',
  md: 'markdown', sql: 'sql', txt: 'text'
}

function fail(msg) {
  console.error(`Error: ${msg}`)
  process.exit(1)
}

function guessLanguage(filename) {
  const ext = path.extname(filename).slice(1).toLowerCase()
  return EXT_LANG[ext] || 'text'
}

// ---- config -----------------------------------------------------------

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 })
}

function requireConfig() {
  const cfg = readConfig()
  if (!cfg || !cfg.apiKey || !cfg.server) {
    fail('Not logged in. Run: codery login <api-key> --server https://your-codery-domain.com')
  }
  return cfg
}

// ---- HTTP helpers -------------------------------------------------------

async function apiFetch(cfg, urlPath, opts = {}) {
  const res = await fetch(`${cfg.server}/api/public${urlPath}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': cfg.apiKey,
      ...(opts.headers || {})
    }
  })
  let data = null
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok) fail((data && data.error) || `${res.status} ${res.statusText}`)
  return data
}

// ---- arg parsing ----------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq !== -1) { out[a.slice(2, eq)] = a.slice(eq + 1); continue }
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) { out[key] = next; i++ }
      else out[key] = true
    } else if (a.startsWith('-') && a.length === 2) {
      const key = a.slice(1)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('-')) { out[key] = next; i++ }
      else out[key] = true
    } else {
      out._.push(a)
    }
  }
  return out
}

// ---- commands ---------------------------------------------------------

async function cmdLogin(args) {
  const apiKey = args._[0]
  if (!apiKey) fail('Usage: codery login <api-key> [--server https://your-codery-domain.com]')
  const existing = readConfig()
  const server = (args.server || existing?.server || '').replace(/\/+$/, '')
  if (!server) fail('No server set. Use: codery login <api-key> --server https://your-codery-domain.com')

  const res = await fetch(`${server}/api/public/me`, { headers: { 'X-API-Key': apiKey } })
  const data = await res.json().catch(() => null)
  if (!res.ok) fail((data && data.error) || 'Login failed — check your API key and server URL')

  writeConfig({ server, apiKey })
  console.log(`Logged in as @${data.username} on ${server}`)
  console.log(`Config saved to ${CONFIG_PATH}`)
}

function cmdLogout() {
  if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH)
  console.log('Logged out.')
}

async function cmdWhoami() {
  const cfg = requireConfig()
  const me = await apiFetch(cfg, '/me')
  console.log(`@${me.username} (${me.nickname})`)
  console.log(`Snippets: ${me.counts.snippets} total, ${me.counts.public} public`)
  console.log(`Followers: ${me.counts.followers} · Following: ${me.counts.following}`)
}

async function cmdLs(args) {
  const cfg = requireConfig()
  const includePrivate = !!(args.private || args.all || args.a)
  const data = await apiFetch(cfg, `/snippets${includePrivate ? '?private=1' : ''}`)
  if (!data.snippets.length) { console.log('No snippets yet. Push one with: codery push <file>'); return }
  for (const s of data.snippets) {
    const vis = s.isPublic ? 'public ' : 'private'
    console.log(`${s.shortId}  [${vis}]  ${(s.language || 'text').padEnd(10)}  \u2665${s.likes} views:${s.views}  ${s.title}`)
    console.log(`   ${cfg.server}/code?id=${s.shortId}`)
  }
}

async function cmdPush(args) {
  const cfg = requireConfig()
  const file = args._[0]
  if (!file) fail('Usage: codery push <file> [--title "..."] [--private] [--tags a,b] [--desc "..."] [--lang js]')
  if (!fs.existsSync(file)) fail(`File not found: ${file}`)

  const content = fs.readFileSync(file, 'utf-8')
  const filename = args.filename || path.basename(file)
  const language = args.lang || guessLanguage(filename)
  const body = {
    title: args.title || filename,
    filename,
    language,
    content,
    description: args.desc || '',
    tags: args.tags || '',
    isPublic: !args.private
  }
  const snippet = await apiFetch(cfg, '/snippets', { method: 'POST', body: JSON.stringify(body) })
  console.log(`Uploaded (${snippet.isPublic ? 'public' : 'private'}, ${language}):`)
  console.log(`${cfg.server}/code?id=${snippet.shortId}`)
}

async function cmdPull(args) {
  const shortId = args._[0]
  if (!shortId) fail('Usage: codery pull <shortId> [-o outfile] [--server https://...]')

  const cfg = readConfig()
  let snippet = null

  // If logged in, check our own snippets first so private ones resolve too.
  if (cfg) {
    try {
      const mine = await apiFetch(cfg, '/snippets?private=1')
      snippet = mine.snippets.find(s => s.shortId === shortId) || null
    } catch { /* fall through to public lookup */ }
  }

  const server = (cfg?.server || args.server || '').replace(/\/+$/, '')
  if (!snippet) {
    if (!server) fail('Not logged in and no --server given — cannot resolve snippet.')
    const res = await fetch(`${server}/api/public/snippet/${encodeURIComponent(shortId)}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) fail((data && data.error) || 'Snippet not found, private, or expired')
    snippet = data
  }
  if (!snippet.rawUrl) fail('No raw content available for this snippet.')

  const raw = await fetch(snippet.rawUrl)
  if (!raw.ok) fail(`Could not download raw content (${raw.status})`)
  const content = await raw.text()

  const out = args.o || args.output || snippet.filename || `${shortId}.txt`
  fs.writeFileSync(out, content)
  console.log(`Saved to ${out}`)
}

async function cmdRm(args) {
  const cfg = requireConfig()
  const shortId = args._[0]
  if (!shortId) fail('Usage: codery rm <shortId>')
  await apiFetch(cfg, `/snippets/${encodeURIComponent(shortId)}`, { method: 'DELETE' })
  console.log(`Deleted ${shortId}`)
}

function cmdConfig(args) {
  const sub = args._[0]
  if (sub === 'set-server') {
    const url = args._[1]
    if (!url) fail('Usage: codery config set-server <url>')
    const cfg = readConfig() || {}
    cfg.server = url.replace(/\/+$/, '')
    writeConfig(cfg)
    console.log(`Server set to ${cfg.server}`)
    return
  }
  if (sub === 'show' || !sub) {
    const cfg = readConfig()
    if (!cfg) { console.log('No config yet. Run: codery login <api-key> --server <url>'); return }
    console.log(`Server: ${cfg.server}`)
    console.log(`API key: ${cfg.apiKey ? cfg.apiKey.slice(0, 8) + '…' : '(none)'}`)
    console.log(`Config file: ${CONFIG_PATH}`)
    return
  }
  fail(`Unknown config subcommand: ${sub}`)
}

function printHelp() {
  console.log(`Codery CLI — push, pull and manage code snippets from your terminal.

Usage:
  codery login <api-key> [--server <url>]   Save your API key (get one at <server>/api-docs)
  codery logout                             Remove saved login
  codery whoami                             Show the logged-in account
  codery ls [--private]                     List your snippets (add --private to include private ones)
  codery push <file> [options]              Upload a file as a new snippet
    --title "..."      Snippet title (default: filename)
    --desc "..."       Description
    --tags a,b,c        Comma-separated tags (max 5)
    --lang js           Language override (auto-detected from extension by default)
    --filename name     Filename to store (default: basename of <file>)
    --private            Upload as private (default: public)
  codery pull <shortId> [-o outfile]        Download a snippet's raw content
  codery rm <shortId>                       Delete one of your snippets
  codery config show                        Show current config
  codery config set-server <url>            Set the default server URL

Examples:
  codery login abcd1234 --server https://codery.example.com
  codery push ./script.py --title "Backup script" --tags devops,backup
  codery pull aB3xQ1 -o script.py
`)
}

// ---- main ---------------------------------------------------------------

async function main() {
  const [, , cmd, ...rest] = process.argv
  const args = parseArgs(rest)

  switch (cmd) {
    case 'login': return cmdLogin(args)
    case 'logout': return cmdLogout()
    case 'whoami': return cmdWhoami()
    case 'ls':
    case 'list': return cmdLs(args)
    case 'push':
    case 'up': return cmdPush(args)
    case 'pull':
    case 'get': return cmdPull(args)
    case 'rm':
    case 'delete': return cmdRm(args)
    case 'config': return cmdConfig(args)
    case undefined:
    case 'help':
    case '-h':
    case '--help': return printHelp()
    default:
      console.error(`Unknown command: ${cmd}\n`)
      printHelp()
      process.exit(1)
  }
}

main().catch(e => fail(e.message || String(e)))
