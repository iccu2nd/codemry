// Scraper-first JS runner:
// - Local VM with network (fetch) + axios-compatible shim + optional cheerio
// - Top-level await supported
// - Other languages via Piston
// Never require() broken/incomplete axios installs — shim uses fetch.

import vm from 'node:vm'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { ensureModules, resolveModule, ALLOWED_PACKAGES } from './modules.js'

const require = createRequire(import.meta.url)
const PISTON_URL = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston/execute'
const MAX_CODE_CHARS = 120_000
const MAX_OUTPUT_CHARS = 50_000
const RUN_TIMEOUT_MS = 25_000

const LANG_MAP = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  php: 'php',
  bash: 'bash',
  shell: 'bash',
  sh: 'bash',
  c: 'c',
  cpp: 'c++',
  'c++': 'c++',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  kotlin: 'kotlin',
  swift: 'swift',
  csharp: 'csharp',
  'c#': 'csharp'
}

export function isRunnableLanguage(lang) {
  return !!LANG_MAP[String(lang || '').toLowerCase()]
}

function truncate(s, max = MAX_OUTPUT_CHARS) {
  const str = String(s ?? '')
  if (str.length <= max) return str
  return str.slice(0, max) + '\n… (output truncated)'
}

function normalizeLang(lang) {
  return LANG_MAP[String(lang || 'text').toLowerCase()] || null
}

function formatArg(v) {
  if (typeof v === 'string') return v
  if (v instanceof Error) return v.stack || v.message
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

/** Minimal axios-compatible client on top of fetch — enough for most scrapers */
function createAxiosShim() {
  async function request(config = {}) {
    const cfg = typeof config === 'string' ? { url: config, method: 'GET' } : { ...config }
    const method = String(cfg.method || 'GET').toUpperCase()
    let url = cfg.url || ''
    if (cfg.baseURL) url = new URL(url, cfg.baseURL).toString()
    if (cfg.params) {
      const u = new URL(url)
      for (const [k, v] of Object.entries(cfg.params)) {
        if (v != null) u.searchParams.set(k, String(v))
      }
      url = u.toString()
    }
    const headers = { ...(cfg.headers || {}) }
    let body = cfg.data
    if (body != null && typeof body === 'object' && !(body instanceof Buffer) && !(typeof FormData !== 'undefined' && body instanceof FormData)) {
      if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json'
      body = JSON.stringify(body)
    }
    const ctrl = new AbortController()
    const ms = cfg.timeout || 20000
    const timer = setTimeout(() => ctrl.abort(), ms)
    try {
      const res = await fetch(url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : body, signal: ctrl.signal })
      const ct = res.headers.get('content-type') || ''
      let data
      if (ct.includes('application/json')) {
        data = await res.json().catch(() => null)
      } else {
        data = await res.text()
      }
      const response = {
        status: res.status,
        statusText: res.statusText,
        headers: Object.fromEntries(res.headers.entries()),
        data,
        config: cfg
      }
      if (!res.ok && cfg.validateStatus ? !cfg.validateStatus(res.status) : res.status >= 400) {
        const err = new Error(`Request failed with status ${res.status}`)
        err.response = response
        err.isAxiosError = true
        throw err
      }
      return response
    } finally {
      clearTimeout(timer)
    }
  }
  const api = {
    request,
    get: (url, config) => request({ ...config, url, method: 'GET' }),
    delete: (url, config) => request({ ...config, url, method: 'DELETE' }),
    head: (url, config) => request({ ...config, url, method: 'HEAD' }),
    options: (url, config) => request({ ...config, url, method: 'OPTIONS' }),
    post: (url, data, config) => request({ ...config, url, data, method: 'POST' }),
    put: (url, data, config) => request({ ...config, url, data, method: 'PUT' }),
    patch: (url, data, config) => request({ ...config, url, data, method: 'PATCH' }),
    create: (defaults = {}) => {
      const child = createAxiosShim()
      const wrap = (fn) => (url, data, config) => {
        if (typeof data === 'object' && data && !config && (url && typeof url === 'object')) {
          return fn({ ...defaults, ...url })
        }
        const cfg = { ...defaults, ...(config || {}), url: typeof url === 'string' ? url : url?.url }
        if (data !== undefined && !(typeof url === 'string' && (fn === child.get))) cfg.data = data
        return child.request({ ...cfg, method: cfg.method || 'GET' })
      }
      return {
        ...child,
        defaults,
        get: (url, config) => child.request({ ...defaults, ...config, url, method: 'GET' }),
        post: (url, data, config) => child.request({ ...defaults, ...config, url, data, method: 'POST' }),
        request: (config) => child.request({ ...defaults, ...config })
      }
    },
    isAxiosError: (e) => !!(e && e.isAxiosError)
  }
  return api
}


function rewriteImports(code) {
  let c = String(code)
  c = c.replace(/^\s*import\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm, (_, name, mod) => `const ${name} = require('${mod}');`)
  c = c.replace(/^\s*import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm, (_, name, mod) => `const ${name} = require('${mod}');`)
  c = c.replace(/^\s*import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm, (_, names, mod) => {
    const clean = names.split(',').map(s => s.trim()).filter(Boolean).join(', ').replace(/\s+as\s+/g, ': ')
    return `const { ${clean} } = require('${mod}');`
  })
  c = c.replace(/^\s*export\s+default\s+/gm, '')
  c = c.replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, '')
  c = c.replace(/^\s*export\s+(const|let|var|function|class)\s+/gm, '$1 ')
  return c
}

function buildRequire(axiosShim) {
  return function safeRequire(id) {
    const name = String(id || '').replace(/^node:/, '')
    if (name === 'fetch' || name === 'node-fetch') return globalThis.fetch.bind(globalThis)
    if (name === 'axios') {
      const real = resolveModule('axios')
      return real || axiosShim
    }
    const mod = resolveModule(name)
    if (mod) return mod
    throw new Error(`Module "${name}" is not available. Allowed packages can be auto-installed on Run.`)
  }
}

async function runJsScraper(code) {
  const logs = []
  const errors = []
  const progress = []

  // Auto-detect & install missing allowlisted modules (isolated tmp dir, no package.json change)
  let modReport = null
  try {
    modReport = await ensureModules(code, {
      onProgress: (msg) => progress.push(msg)
    })
    if (modReport.installed.length) {
      logs.push(`[modules] installed: ${modReport.installed.join(', ')}`)
    }
    if (modReport.alreadyHad.length) {
      logs.push(`[modules] already available: ${modReport.alreadyHad.join(', ')}`)
    }
    if (modReport.failed.length) {
      for (const f of modReport.failed) {
        errors.push(`[modules] failed ${f.name}: ${f.error}`)
      }
    }
    for (const s of modReport.skipped) {
      if (s.reason === 'not-allowlisted') {
        errors.push(`[modules] blocked (not allowed): ${s.name}`)
      }
    }
  } catch (e) {
    errors.push(`[modules] ${e.message}`)
  }

  const transformed = rewriteImports(code)
  const axiosShim = createAxiosShim()

  let resolveRun, rejectRun
  const done = new Promise((resolve, reject) => {
    resolveRun = resolve
    rejectRun = reject
  })

  const sandbox = {
    console: {
      log: (...a) => logs.push(a.map(formatArg).join(' ')),
      info: (...a) => logs.push(a.map(formatArg).join(' ')),
      warn: (...a) => logs.push(a.map(formatArg).join(' ')),
      error: (...a) => errors.push(a.map(formatArg).join(' ')),
      debug: (...a) => logs.push(a.map(formatArg).join(' '))
    },
    require: buildRequire(axiosShim),
    fetch: globalThis.fetch.bind(globalThis),
    axios: resolveModule('axios') || axiosShim,
    cheerio: resolveModule('cheerio'),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Buffer,
    JSON,
    Math,
    Date,
    Array,
    Object,
    Map,
    Set,
    Promise,
    Error,
    RegExp,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    isNaN,
    Number,
    String,
    Boolean,
    __resolveRun: resolveRun,
    __rejectRun: rejectRun
  }

  const context = vm.createContext(sandbox)
  const wrapped = `"use strict";
(async () => {
  try {
${transformed}
    __resolveRun();
  } catch (err) {
    __rejectRun(err);
  }
})();`

  let timedOut = false
  try {
    const script = new vm.Script(wrapped, { filename: 'snippet.js' })
    script.runInContext(context, { timeout: 8000, displayErrors: true })
    await Promise.race([
      done,
      new Promise((_, rej) => setTimeout(() => {
        timedOut = true
        rej(new Error('Execution timed out (max ~25s)'))
      }, RUN_TIMEOUT_MS))
    ])
  } catch (e) {
    if (timedOut || e?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || /timed out/i.test(String(e.message))) {
      timedOut = true
      errors.push('Execution timed out (max ~25s)')
    } else {
      errors.push(String(e && e.stack ? e.stack : e))
    }
  }

  const available = []
  if (sandbox.axios) available.push('axios')
  if (sandbox.cheerio) available.push('cheerio')
  available.push('fetch')

  return {
    engine: 'scraper-vm',
    language: 'javascript',
    stdout: truncate(logs.join('\n')),
    stderr: truncate(errors.join('\n')),
    exitCode: errors.length ? 1 : 0,
    signal: null,
    timedOut,
    modules: available,
    moduleReport: modReport,
    progress
  }
}

async function runOnPiston(language, code) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        language,
        version: '*',
        files: [{ content: code }],
        run_timeout: 10000
      }),
      signal: ctrl.signal
    })
    if (!res.ok) throw new Error(`Run service HTTP ${res.status}`)
    const data = await res.json()
    const run = data?.run || {}
    const compile = data?.compile || null
    let stdout = run.stdout || ''
    let stderr = run.stderr || ''
    if (compile?.stderr) stderr = `${compile.stderr}\n${stderr}`.trim()
    return {
      engine: 'piston',
      language,
      stdout: truncate(stdout),
      stderr: truncate(stderr),
      exitCode: typeof run.code === 'number' ? run.code : null,
      signal: run.signal || null,
      timedOut: run.signal === 'SIGKILL'
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function runCode({ language, content }) {
  const code = String(content || '')
  if (!code.trim()) {
    const err = new Error('No code to run')
    err.status = 400
    throw err
  }
  if (code.length > MAX_CODE_CHARS) {
    const err = new Error('Code is too long to run')
    err.status = 400
    throw err
  }
  const lang = normalizeLang(language)
  if (!lang) {
    const err = new Error('This language cannot be run')
    err.status = 400
    throw err
  }
  if (lang === 'javascript') return runJsScraper(code)
  try {
    return await runOnPiston(lang, code)
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? 'Run timed out' : (e.message || 'Run service unavailable'))
    err.status = 502
    throw err
  }
}
