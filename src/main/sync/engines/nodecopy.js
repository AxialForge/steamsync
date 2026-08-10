'use strict'

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')

// Pure-JS engine: always available, cross-platform, precise byte-level progress.
// Slower than robocopy on large trees but a solid fallback. Never deletes on the
// destination. Preserves source mtime on copied files so the size+time diff
// stays stable across runs (mirrors robocopy's /XO behaviour).

const id = 'node'
const label = 'Node.js streams (built-in)'
const MTIME_TOLERANCE_MS = 2000 // match FAT/robocopy 2-second granularity

function detect() { return Promise.resolve({ available: true, note: 'Always available.' }) }

async function needsCopy(src, dest) {
  let ds
  try { ds = await fsp.stat(dest) } catch { return true } // dest missing
  const ss = await fsp.stat(src)
  if (ss.size !== ds.size) return true
  if (ss.mtimeMs - ds.mtimeMs > MTIME_TOLERANCE_MS) return true // source is newer
  return false
}

async function* walkFiles(dir, rel = '', exclude = new Set()) {
  let entries
  try { entries = await fsp.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    const r = rel ? path.join(rel, e.name) : e.name
    if (e.isDirectory()) {
      if (exclude.has(e.name.toLowerCase())) continue // skip _CommonRedist etc.
      yield* walkFiles(abs, r, exclude)
    } else if (e.isFile()) yield { abs, rel: r }
  }
}

function throttledCopy(src, dest, bytesPerSec, onChunk, signal) {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(src, { highWaterMark: 64 * 1024 })
    const ws = fs.createWriteStream(dest)
    const onAbort = () => { rs.destroy(); ws.destroy(); reject(new Error('aborted')) }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    rs.on('data', (chunk) => {
      onChunk(chunk.length)
      if (bytesPerSec > 0) {
        rs.pause()
        setTimeout(() => rs.resume(), (chunk.length / bytesPerSec) * 1000)
      }
    })
    rs.on('error', reject)
    ws.on('error', reject)
    ws.on('finish', () => { if (signal) signal.removeEventListener('abort', onAbort); resolve() })
    rs.pipe(ws)
  })
}

async function copyOne(src, dest, opts, onProgress, signal) {
  await fsp.mkdir(path.dirname(dest), { recursive: true })
  const bps = opts.bandwidthKbps ? opts.bandwidthKbps * 1024 : 0 // bandwidthKbps is KB/s
  if (bps > 0) {
    await throttledCopy(src, dest, bps, (n) => onProgress && onProgress({ bytesDelta: n }), signal)
  } else {
    await fsp.copyFile(src, dest)
    const st = await fsp.stat(src)
    if (onProgress) onProgress({ bytesDelta: st.size })
  }
  // preserve timestamps so future diffs see the files as identical
  const st = await fsp.stat(src)
  await fsp.utimes(dest, st.atime, st.mtime)
}

async function copy(item, opts, { onProgress, onLog, signal } = {}) {
  const concurrency = Math.min(32, Math.max(1, opts.threads || 8))
  const exclude = new Set((opts.excludeDirs || []).map((d) => d.toLowerCase()))
  const queue = []
  for await (const f of walkFiles(item.source, '', exclude)) queue.push(f)

  let index = 0
  let filesCopied = 0
  async function worker() {
    while (index < queue.length) {
      if (signal && signal.aborted) return
      const { abs, rel } = queue[index++]
      const dest = path.join(item.dest, rel)
      if (await needsCopy(abs, dest)) {
        await copyOne(abs, dest, opts, (p) => onProgress && onProgress({ ...p, file: rel }), signal)
        filesCopied++
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))

  for (const ex of item.extraFiles || []) {
    if (signal && signal.aborted) break
    if (await needsCopy(ex.src, ex.dest)) {
      await copyOne(ex.src, ex.dest, opts, null, signal)
      if (onLog) onLog(`manifest: ${path.basename(ex.src)}`)
    }
  }
  return { filesCopied, bytesCopied: null }
}

module.exports = { id, label, detect, copy }
