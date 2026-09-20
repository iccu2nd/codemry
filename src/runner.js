// Run user snippets via Piston (multi-language). JS also has a local vm fallback
// so Run still works if the public API is slow/down.
// Limits are intentional: short timeout, capped output, no custom packages.

import vm from 'node:vm'

const PISTON_URL = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston/execute'
const MAX_CODE_CHARS = 120_000
const MAX_OUTPUT_CHARS = 40_000
const RUN_TIMEOUT_MS = 8_000

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
  'c#': 'csharp',
  text: null,
  html: null,
  css: null,
  json: null,
  markdown: null
}

export function isRunnableLanguage(lang) {
  const key = String(lang || '').toLowerCase()
  return !!LANG_MAP[key]
}

function truncate(s, max = MAX_OUTPUT_CHARS) {
  const str = String(s ?? '')
  if (str.length <= max) return str
  return str.slice(0, max) + '\n… (output truncated)'
}

function normalizeLang(lang) {
  const key = String(lang || 'text').toLowerCase()
  return LANG_MAP[key] || null
}

function formatArg(v) {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) } catch { return String(v) }
}

async function runOnPiston(language, code) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), RUN_TIMEOUT_MS + 5000)
  try {
    const res = await fetch(PISTON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        language,
        version: '*',
        files: [{ content: code }],
        run_timeout: RUN_TIMEOUT_MS
      }),
      signal: ctrl.signal
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Run service HTTP ${res.status}`)
    }
    const data = await res.json()
    const run = data?.run || {}
    const compile = data?.compile || null
    let stdout = run.stdout || ''
    let stderr = run.stderr || ''
    if (compile?.stderr) stderr = `${compile.stderr}\n${stderr}`.trim()
    const signal = run.signal || null
    const codeExit = typeof run.code === 'number' ? run.code : null
    return {
      engine: 'piston',
      language,
      stdout: truncate(stdout),
      stderr: truncate(stderr),
      exitCode: codeExit,
      signal,
      timedOut: signal === 'SIGKILL' || /time/i.test(stderr || '')
    }
  } finally {
    clearTimeout(timer)
  }
}

function runJsLocal(code) {
  const logs = []
  const errors = []
  const sandbox = {
    console: {
      log: (...args) => logs.push(args.map(formatArg).join(' ')),
      info: (...args) => logs.push(args.map(formatArg).join(' ')),
      warn: (...args) => logs.push(args.map(formatArg).join(' ')),
      error: (...args) => errors.push(args.map(formatArg).join(' '))
    }
  }
  const context = vm.createContext(sandbox)
  let timedOut = false
  try {
    const script = new vm.Script(code, { filename: 'snippet.js' })
    script.runInContext(context, { timeout: RUN_TIMEOUT_MS, displayErrors: true })
  } catch (e) {
    if (e && (e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT' || /timed out/i.test(String(e.message)))) {
      timedOut = true
      errors.push('Execution timed out')
    } else {
      errors.push(String(e && e.stack ? e.stack : e))
    }
  }
  return {
    engine: 'local-vm',
    language: 'javascript',
    stdout: truncate(logs.join('\n')),
    stderr: truncate(errors.join('\n')),
    exitCode: errors.length ? 1 : 0,
    signal: null,
    timedOut
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
  const pistonLang = normalizeLang(language)
  if (!pistonLang) {
    const err = new Error('This language cannot be run (supported: JS, TS, Python, Java, PHP, Bash, C, C++, Go, Rust, Ruby, …)')
    err.status = 400
    throw err
  }

  try {
    return await runOnPiston(pistonLang, code)
  } catch (e) {
    if (pistonLang === 'javascript') {
      return runJsLocal(code)
    }
    const err = new Error(e.name === 'AbortError' ? 'Run timed out' : (e.message || 'Run service unavailable, try again'))
    err.status = 502
    throw err
  }
}
