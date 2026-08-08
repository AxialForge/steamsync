'use strict'

const { spawn, execFile } = require('node:child_process')
const path = require('node:path')

// Optional engine. Uses `rclone copy` (NOT `rclone sync`) so it is incremental
// by size+modtime and NEVER deletes on the destination. Detected on PATH or via
// a user-set path in Settings; the UI greys the option out when unavailable.

const id = 'rclone'
const label = 'rclone (advanced, if installed)'

function detect(opts = {}) {
  const exe = opts.rclonePath || 'rclone'
  return new Promise((resolve) => {
    execFile(exe, ['version'], { windowsHide: true }, (err, stdout) => {
      if (err) return resolve({ available: false, note: 'Not found. Install rclone or set its path in Settings.' })
      const v = (stdout.match(/rclone\s+v([\d.]+)/i) || [])[1]
      resolve({ available: true, version: v, note: `rclone v${v || '?'} detected.` })
    })
  })
}

async function copy(item, opts, { onProgress, onLog, signal } = {}) {
  const exe = opts.rclonePath || 'rclone'
  const transfers = Math.min(64, Math.max(1, opts.threads || 8))
  const args = ['copy', item.source, item.dest,
    '--transfers', String(transfers), '--checkers', String(transfers),
    '--use-json-log', '--stats', '1s', '--stats-unit', 'bytes', '-v']
  if (opts.bandwidthKbps && opts.bandwidthKbps > 0) args.push('--bwlimit', `${opts.bandwidthKbps}k`)

  await new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true })
    let last = 0
    let leftover = ''
    const onAbort = () => { try { child.kill() } catch {} }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
    const handle = (buf) => {
      leftover += buf
      const lines = leftover.split(/\r?\n/)
      leftover = lines.pop()
      for (const ln of lines) {
        const s = ln.trim()
        if (!s.startsWith('{')) continue
        try {
          const j = JSON.parse(s)
          const bytes = j.stats && j.stats.bytes
          if (typeof bytes === 'number' && bytes >= last) {
            if (onProgress) onProgress({ bytesDelta: bytes - last })
            last = bytes
          }
        } catch { /* not a stats line */ }
      }
    }
    child.stderr.on('data', handle) // rclone logs to stderr
    child.stdout.on('data', handle)
    child.on('error', reject)
    child.on('close', (code) => {
      if (signal) signal.removeEventListener('abort', onAbort)
      code === 0 ? resolve() : reject(new Error(`rclone exited ${code}`))
    })
  })

  for (const ex of item.extraFiles || []) {
    if (signal && signal.aborted) break
    await new Promise((resolve, reject) => {
      const child = spawn(exe, ['copyto', ex.src, ex.dest], { windowsHide: true })
      child.on('error', reject)
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`rclone copyto exited ${code}`))))
    })
    if (onLog) onLog(`manifest: ${path.basename(ex.src)}`)
  }
  return { filesCopied: null, bytesCopied: last }
}

module.exports = { id, label, detect, copy }
