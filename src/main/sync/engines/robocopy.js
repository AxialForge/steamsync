'use strict'

const { spawn } = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')

// The default engine. Robocopy is built into Windows, multithreaded (/MT), and
// resumable. CRITICAL: we NEVER pass /MIR or /PURGE, so it physically cannot
// delete on the destination. /XO keeps the local master authoritative (a file
// is copied only when the source is newer or a different size).

const id = 'robocopy'
const label = 'Robocopy (Windows, multithreaded)'

function detect() {
  // Robocopy ships with Windows Vista+; assume present on win32.
  const exe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'Robocopy.exe')
  const available = process.platform === 'win32' && fs.existsSync(exe)
  return Promise.resolve({ available, note: available ? 'Built into Windows.' : 'Windows only.' })
}

// Parse robocopy's English summary block for exact per-run byte/file counts.
// Falls back to null if the labels aren't found (non-English Windows) — callers
// then rely on the pre-scan estimate instead.
function parseSummary(text) {
  const files = text.match(/^\s*Files\s*:\s*(\d+)\s+(\d+)/m)
  const bytes = text.match(/^\s*Bytes\s*:\s*(\d+)\s+(\d+)/m)
  const out = {}
  if (files) { out.filesTotal = +files[1]; out.filesCopied = +files[2] }
  if (bytes) { out.bytesTotal = +bytes[1]; out.bytesCopied = +bytes[2] }
  return Object.keys(out).length ? out : null
}

function baseArgs(opts) {
  const threads = Math.min(128, Math.max(1, opts.threads || 16))
  const args = ['/E', '/XO', '/R:1', '/W:1', `/MT:${threads}`, '/NP', '/NDL', '/NJH', '/BYTES']
  // Coarse throttle: inter-packet gap in ms between 64 KB packets.
  // bandwidthKbps is KB/s, so ms/packet ≈ 64000 / (KB/s).
  if (opts.bandwidthKbps && opts.bandwidthKbps > 0) {
    const ipg = Math.max(1, Math.round(64000 / opts.bandwidthKbps))
    if (Number.isFinite(ipg) && ipg > 0) args.push(`/IPG:${ipg}`)
  }
  if (opts.excludeDirs && opts.excludeDirs.length) args.push('/XD', ...opts.excludeDirs)
  return args
}

function run(args, { onLine, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('robocopy', args, { windowsHide: true })
    let out = ''
    let leftover = ''
    const onAbort = () => { try { child.kill() } catch {} }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })

    child.stdout.on('data', (d) => {
      out += d
      leftover += d
      const lines = leftover.split(/\r?\n/)
      leftover = lines.pop()
      if (onLine) for (const ln of lines) onLine(ln)
    })
    child.stderr.on('data', (d) => { out += d })
    child.on('error', reject)
    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      if (onLine && leftover) onLine(leftover)
      // Robocopy: <8 is success (0 none,1 copied,2 extras,3 both,...). >=8 error.
      resolve({ code, out, ok: code != null && code < 8 })
    })
  })
}

// Copy one item (a directory tree) plus any extra single files (Steam manifests).
// onProgress({ bytesDelta, file }) is called as files complete.
async function copy(item, opts, { onProgress, onLog, signal } = {}) {
  fs.mkdirSync(item.dest, { recursive: true })
  const args = [item.source, item.dest, ...baseArgs(opts)]

  const fileLine = /\t(\d+)\t(.+?)\s*$/ // "\t<bytes>\t<path>" with /BYTES /NP
  const res = await run(args, {
    signal,
    onLine: (ln) => {
      const m = ln.match(fileLine)
      if (m) {
        const bytes = +m[1]
        if (onProgress) onProgress({ bytesDelta: bytes, file: path.basename(m[2]) })
      }
    }
  })
  if (!res.ok) throw new Error(`robocopy exited ${res.code} for ${item.name || item.source}`)

  // Extra files (e.g. appmanifest_*.acf) live in the parent, copied by name.
  for (const ex of item.extraFiles || []) {
    if (signal && signal.aborted) break
    fs.mkdirSync(path.dirname(ex.dest), { recursive: true })
    const exArgs = [path.dirname(ex.src), path.dirname(ex.dest), path.basename(ex.src),
      '/XO', '/R:1', '/W:1', '/NP', '/NDL', '/NJH', '/NJS', '/BYTES']
    await run(exArgs, { signal })
    if (onLog) onLog(`manifest: ${path.basename(ex.src)}`)
  }

  const summary = parseSummary(res.out)
  return { bytesCopied: summary ? summary.bytesCopied : null, filesCopied: summary ? summary.filesCopied : null }
}

// List-only diff (fast, no copy). /L = list, /X = also report EXTRA (dest-only)
// files. Returns { bytesToCopy, filesToCopy, orphans:[{path,bytes}], orphanCount }.
async function listDiff(source, dest, opts = {}) {
  if (!fs.existsSync(source)) return { bytesToCopy: 0, filesToCopy: 0, orphans: [], orphanCount: 0 }
  const args = [source, dest, '/E', '/XO', '/L', '/X', '/R:0', '/W:0', '/NP', '/NDL', '/NJH', '/BYTES']
  if (opts.excludeDirs && opts.excludeDirs.length) args.push('/XD', ...opts.excludeDirs)
  const orphans = []
  const res = await run(args, {
    signal: opts.signal,
    onLine: (ln) => {
      if (/\*EXTRA File/i.test(ln)) {
        const m = ln.match(/\t(\d+)\t(.+?)\s*$/)
        if (m && orphans.length < 5000) orphans.push({ path: m[2].trim(), bytes: +m[1] })
      }
    }
  })
  const summary = parseSummary(res.out) || {}
  // In /L mode, "Copied" column = would-be-copied.
  const extras = res.out.match(/^\s*Files\s*:\s*\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/m)
  return {
    bytesToCopy: summary.bytesCopied || 0,
    filesToCopy: summary.filesCopied || 0,
    orphanCount: extras ? +extras[1] : orphans.length,
    orphans
  }
}

module.exports = { id, label, detect, copy, listDiff }
