'use strict'

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const robocopy = require('./engines/robocopy')

// Diff preview: what would be copied, and what exists only on the NAS (orphans).
// Uses robocopy /L (fast, authoritative on Windows). Never copies anything.
async function scanItems(items, { signal, onItem } = {}) {
  const results = []
  let bytesToCopy = 0
  let filesToCopy = 0
  let orphanCount = 0
  const orphansByItem = []

  for (const item of items) {
    if (signal && signal.aborted) break
    const d = await robocopy.listDiff(item.source, item.dest, { signal })
    // manifests / extra files also count toward "to copy"
    for (const ex of item.extraFiles || []) {
      try {
        const ss = fs.statSync(ex.src)
        let need = true
        try { const ds = fs.statSync(ex.dest); need = ds.size !== ss.size || ss.mtimeMs - ds.mtimeMs > 2000 } catch {}
        if (need) { d.filesToCopy += 1; d.bytesToCopy += ss.size }
      } catch {}
    }
    const r = {
      id: item.id, name: item.name, type: item.type,
      source: item.source, dest: item.dest,
      bytesToCopy: d.bytesToCopy, filesToCopy: d.filesToCopy,
      orphanCount: d.orphanCount, sizeOnDisk: item.sizeOnDisk || 0,
      status: d.filesToCopy > 0 ? 'needs-sync' : (fs.existsSync(item.dest) ? 'in-sync' : 'not-backed-up')
    }
    results.push(r)
    bytesToCopy += d.bytesToCopy
    filesToCopy += d.filesToCopy
    orphanCount += d.orphanCount
    if (d.orphans && d.orphans.length) orphansByItem.push({ id: item.id, name: item.name, dest: item.dest, orphans: d.orphans })
    if (onItem) onItem(r)
  }

  return { items: results, totals: { bytesToCopy, filesToCopy, orphanCount, itemCount: items.length }, orphansByItem }
}

function sha1(file, signal) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha1')
    const s = fs.createReadStream(file)
    if (signal) signal.addEventListener('abort', () => s.destroy(new Error('aborted')), { once: true })
    s.on('data', (c) => h.update(c))
    s.on('error', reject)
    s.on('end', () => resolve(h.digest('hex')))
  })
}

async function* walk(dir, rel = '') {
  let entries
  try { entries = await fsp.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    const r = rel ? path.join(rel, e.name) : e.name
    if (e.isDirectory()) yield* walk(abs, r)
    else if (e.isFile()) yield { abs, rel: r }
  }
}

// Optional deep verification: hash every source file and compare to its NAS
// counterpart. Slow — only runs when the user turns on "Verify with checksums".
async function verifyItems(items, { signal, onProgress } = {}) {
  const mismatches = []
  let checked = 0
  for (const item of items) {
    for await (const f of walk(item.source)) {
      if (signal && signal.aborted) return { mismatches, checked, aborted: true }
      const dest = path.join(item.dest, f.rel)
      if (!fs.existsSync(dest)) { mismatches.push({ item: item.name, file: f.rel, reason: 'missing on NAS' }); continue }
      try {
        const [a, b] = await Promise.all([sha1(f.abs, signal), sha1(dest, signal)])
        if (a !== b) mismatches.push({ item: item.name, file: f.rel, reason: 'checksum differs' })
      } catch (e) { mismatches.push({ item: item.name, file: f.rel, reason: e.message }) }
      checked++
      if (onProgress && checked % 25 === 0) onProgress({ checked, currentItem: item.name })
    }
  }
  return { mismatches, checked, aborted: false }
}

module.exports = { scanItems, verifyItems }
