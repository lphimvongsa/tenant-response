// Loaded via --require before any module imports run.
// Sets env vars from .env.local so module-level initializers (e.g. deepseek.ts) can read them.
const fs = require('fs')
try {
  const lines = fs.readFileSync('.env.local', 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
} catch {
  // .env.local absent — env vars must already be set in the shell
}
