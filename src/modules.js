// Safe, isolated module ensure for the code runner.
// - Detects import/require names from source
// - Installs ONLY allowlisted packages into os.tmpdir() (never touches project package.json)
// - Skips install if the module already resolves from project or sandbox dir

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const require = createRequire(import.meta.url)

export const SANDBOX_DIR = path.join(os.tmpdir(), 'codery-run-modules')

// Only packages safe enough for scraper/snippets. No native build tools, no shell helpers.
export const ALLOWED_PACKAGES = new Set([
  'axios',
  'cheerio',
  'node-fetch',
  'lodash',
  'qs',
  'form-data',
  'tough-cookie',
  'dayjs',
  'uuid',
  'querystring',
  'underscore',
  'ramda',
  'htmlparser2',
  'css-select',
  'domhandler',
  'domutils',
  'entities',
  'parse5',
  'whatwg-url',
  'node-html-parser',
  'got',
  'phin',
  'superagent'
])

const BUILTIN_OR_SHIM = new Set(['fetch', 'fs', 'path', 'http', 'https', 'url', 'util', 'crypto', 'buffer', 'stream', 'events', 'os', 'querystring'])

export function detectRequiredModules(code) {
  const found = new Set()
  const src = String(code || '')
  const reImportFrom = /(?:import|export)\s+[\s\S]*?\sfrom\s+['"]([^'"]+)['"]/g
  const reImportSide = /import\s+['"]([^'"]+)['"]/g
  const reRequire = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let m
  while ((m = reImportFrom.exec(src))) found.add(m[1])
  while ((m = reImportSide.exec(src))) found.add(m[1])
  while ((m = reRequire.exec(src))) found.add(m[1])
  return [...found]
    .map(id => String(id || '').trim())
    .filter(Boolean)
    .map(id => id.replace(/^node:/, ''))
    .filter(id => !id.startsWith('.') && !id.startsWith('/'))
    .map(id => id.split('/')[0].startsWith('@') ? id.split('/').slice(0, 2).join('/') : id.split('/')[0])
}

function moduleResolvable(name, fromPaths = []) {
  // Project node_modules
  try {
    require.resolve(name)
    return { ok: true, where: 'project' }
  } catch { /* continue */ }

  // Sandbox dir
  const sandboxReq = createRequire(path.join(SANDBOX_DIR, 'package.json'))
  try {
    if (fs.existsSync(path.join(SANDBOX_DIR, 'node_modules', name))) {
      sandboxReq.resolve(name)
      return { ok: true, where: 'sandbox' }
    }
  } catch { /* continue */ }

  // Explicit paths
  for (const base of fromPaths) {
    try {
      const r = createRequire(path.join(base, 'package.json'))
      r.resolve(name)
      return { ok: true, where: base }
    } catch { /* continue */ }
  }
  return { ok: false }
}

function ensureSandboxDir() {
  if (!fs.existsSync(SANDBOX_DIR)) {
    fs.mkdirSync(SANDBOX_DIR, { recursive: true })
  }
  const pkg = path.join(SANDBOX_DIR, 'package.json')
  if (!fs.existsSync(pkg)) {
    fs.writeFileSync(pkg, JSON.stringify({ name: 'codery-run-sandbox', private: true, type: 'commonjs' }, null, 2))
  }
}

function npmInstall(name) {
  return new Promise((resolve, reject) => {
    ensureSandboxDir()
    // --no-save: do not modify package.json beyond what npm needs in prefix
    // --prefix: isolate under tmp
    // --omit=dev: smaller
    const args = [
      'install',
      `${name}@latest`,
      '--prefix', SANDBOX_DIR,
      '--no-save',
      '--omit=dev',
      '--no-fund',
      '--no-audit',
      '--loglevel', 'error'
    ]
    const child = spawn('npm', args, {
      cwd: SANDBOX_DIR,
      env: { ...process.env, npm_config_update_notifier: 'false' },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stderr = ''
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch {}
      reject(new Error(`Install timed out: ${name}`))
    }, 60_000)
    child.stderr.on('data', d => { stderr += d.toString() })
    child.on('error', err => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `npm install failed for ${name}`))
    })
  })
}

/**
 * Ensure allowlisted modules exist. Returns status for UI.
 * Never writes to the app package.json.
 */
export async function ensureModules(code, { onProgress } = {}) {
  const detected = detectRequiredModules(code)
  const report = {
    detected,
    alreadyHad: [],
    installed: [],
    skipped: [],
    failed: []
  }

  for (const name of detected) {
    if (BUILTIN_OR_SHIM.has(name)) {
      report.skipped.push({ name, reason: 'builtin-or-shim' })
      continue
    }
    if (!ALLOWED_PACKAGES.has(name)) {
      report.skipped.push({ name, reason: 'not-allowlisted' })
      continue
    }
    const resolved = moduleResolvable(name)
    if (resolved.ok) {
      report.alreadyHad.push(name)
      continue
    }
    try {
      onProgress?.(`Installing ${name}…`)
      await npmInstall(name)
      report.installed.push(name)
    } catch (e) {
      report.failed.push({ name, error: e.message })
    }
  }
  return report
}

/** Resolve a module from project first, then sandbox */
export function resolveModule(name) {
  try {
    return require(name)
  } catch { /* fall through */ }
  try {
    const sandboxReq = createRequire(path.join(SANDBOX_DIR, 'package.json'))
    return sandboxReq(name)
  } catch {
    return null
  }
}
