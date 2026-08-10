'use strict'

const path = require('node:path')
const engines = require('./engines')
const { scanItems, verifyItems } = require('./scanner')
const { pathsOverlap, freeSpace } = require('../util/safety')
const { humanBytes } = require('../util/bytes')
const log = require('../util/logger')

const JUNK_APPIDS = new Set(['228980']) // Steamworks Common Redistributables
const JUNK_DIRS = ['_CommonRedist', 'CommonRedist']

// Coordinates the whole run: builds the concrete item list from settings +
// detected Steam libraries, scans for a diff, then copies with the chosen
// engine. One run at a time. Emits status/progress/scan/done via `emit`.

let deps = { getSettings: () => ({}), getDetection: () => ({ libraries: [] }), emit: () => {} }
let state = 'idle' // idle | scanning | syncing | verifying
let ac = null
let lastScan = null

function configure(d) { deps = { ...deps, ...d } }
function isRunning() { return state !== 'idle' }
function getState() { return { state, running: isRunning(), lastScan } }

function setState(s) { state = s; deps.emit({ type: 'status', state: s, running: isRunning() }) }

// Turn detected libraries + folder pairs + settings into concrete copy items.
function buildItems() {
  const s = deps.getSettings()
  const det = deps.getDetection() || { libraries: [] }
  const excluded = new Set(s.excludedAppids || [])
  const items = []

  if (s.nasRoot) {
    for (const lib of det.libraries || []) {
      const destLib = path.win32.join(s.nasRoot, lib.label)
      for (const g of lib.games) {
        if (excluded.has(String(g.appid))) continue
        if (s.excludeJunk && JUNK_APPIDS.has(String(g.appid))) continue
        const dest = path.win32.join(destLib, 'steamapps', 'common', g.installdir)
        items.push({
          type: 'game', id: `${lib.label}:${g.appid}`, appid: String(g.appid), name: g.name,
          source: g.installedPath, dest, sizeOnDisk: g.sizeOnDisk,
          extraFiles: [{ src: g.manifestPath, dest: path.win32.join(destLib, 'steamapps', g.manifestName) }]
        })
      }
    }
  }

  for (const p of s.folderPairs || []) {
    if (!p.source || !p.dest) continue
    items.push({ type: 'folder', id: `pair:${p.id}`, name: p.label || path.basename(p.source), source: p.source, dest: p.dest, extraFiles: [] })
  }
  return items
}

function excludeDirs() { return deps.getSettings().excludeJunk ? JUNK_DIRS : [] }

// Drop any item whose source and destination overlap — copying a folder into
// itself would recurse. Reported, never silently skipped.
function guard(items) {
  const safe = []
  for (const it of items) {
    if (pathsOverlap(it.source, it.dest)) {
      log.error(`Skipping "${it.name}": source and destination overlap — ${it.source} ↔ ${it.dest}`)
      deps.emit({ type: 'item-status', id: it.id, status: 'error' })
      continue
    }
    safe.push(it)
  }
  return safe
}

async function scan() {
  if (isRunning()) return lastScan
  ac = new AbortController()
  setState('scanning')
  log.info('Scanning for differences…')
  try {
    const items = guard(buildItems())
    if (!items.length) log.warn('Nothing to scan — set your NAS folder in Settings, or add a folder pair.')
    const result = await scanItems(items, {
      signal: ac.signal,
      excludeDirs: excludeDirs(),
      onItem: (r) => deps.emit({ type: 'scan-item', item: r })
    })
    lastScan = { ...result, at: Date.now() }
    deps.emit({ type: 'scan', result: lastScan })
    const { humanBytes } = require('../util/bytes')
    log.ok(`Scan complete: ${result.totals.filesToCopy} file(s) / ${humanBytes(result.totals.bytesToCopy)} to sync, ${result.totals.orphanCount} only on NAS.`)
    return lastScan
  } catch (e) {
    log.error('Scan failed: ' + e.message)
    throw e
  } finally {
    setState('idle')
  }
}

async function start({ verify } = {}) {
  if (isRunning()) return
  const s = deps.getSettings()
  const items = guard(buildItems())
  if (!items.length) { log.warn('Nothing to sync. Set a NAS folder or add a folder pair in Settings.'); return }

  ac = new AbortController()
  const engine = engines.get(s.engine)
  const opts = { threads: s.threads || 16, bandwidthKbps: s.bandwidthKbps || null, rclonePath: s.rclonePath || null, excludeDirs: excludeDirs() }

  // Pre-scan for accurate progress totals.
  setState('scanning')
  log.info(`Preparing sync with ${engine.label}…`)
  const scanResult = await scanItems(items, { signal: ac.signal, excludeDirs: opts.excludeDirs })
  lastScan = { ...scanResult, at: Date.now() }
  deps.emit({ type: 'scan', result: lastScan })
  const byId = new Map(scanResult.items.map((r) => [r.id, r]))
  const bytesTotal = scanResult.totals.bytesToCopy
  const filesTotal = scanResult.totals.filesToCopy

  // Free-space guard (non-blocking — statfs can be unreliable over SMB, so a
  // null reading is treated as "unknown", never as "full").
  if (s.nasRoot) {
    const free = await freeSpace(s.nasRoot)
    if (free != null && bytesTotal > free) {
      log.warn(`Low space: need ${humanBytes(bytesTotal)} but the NAS reports only ${humanBytes(free)} free — the sync may fail partway.`)
    }
  }

  setState('syncing')
  const startedAt = Date.now()
  let bytesDone = 0
  let completedBytes = 0
  let itemIndex = 0
  let lastEmit = 0
  let copiedItems = 0
  let failedItems = 0

  const emitProgress = (currentFile) => {
    const now = Date.now()
    if (now - lastEmit < 150) return
    lastEmit = now
    const elapsed = (now - startedAt) / 1000
    deps.emit({
      type: 'progress',
      state: 'syncing',
      itemIndex, itemsTotal: items.length,
      bytesDone, bytesTotal, filesTotal,
      speedBps: elapsed > 0 ? bytesDone / elapsed : 0,
      currentItem: items[itemIndex] ? items[itemIndex].name : null,
      currentFile: currentFile || null
    })
  }

  log.ok(`Syncing ${items.length} item(s), ${filesTotal} file(s) / ${require('../util/bytes').humanBytes(bytesTotal)}.`)

  for (let i = 0; i < items.length; i++) {
    if (ac.signal.aborted) { log.warn('Sync cancelled.'); break }
    itemIndex = i
    const item = items[i]
    const plan = byId.get(item.id)
    if (plan && plan.filesToCopy === 0) {
      deps.emit({ type: 'item-status', id: item.id, status: 'in-sync' }) // already up to date
      continue
    }
    deps.emit({ type: 'item-status', id: item.id, status: 'syncing' })
    log.info(`→ ${item.name}`)
    emitProgress()
    try {
      await engine.copy(item, opts, {
        signal: ac.signal,
        onProgress: ({ bytesDelta, file }) => { if (bytesDelta) bytesDone += bytesDelta; emitProgress(file) },
        onLog: (m) => log.info(`   ${m}`)
      })
      completedBytes += plan ? plan.bytesToCopy : 0
      bytesDone = Math.max(bytesDone, completedBytes) // reconcile drift from output parsing
      copiedItems++
      deps.emit({ type: 'item-status', id: item.id, status: 'in-sync', bytesToCopy: 0, filesToCopy: 0 })
    } catch (e) {
      if (ac.signal.aborted) { log.warn('Sync cancelled.'); break }
      failedItems++
      log.error(`   failed: ${item.name} — ${e.message}`)
      deps.emit({ type: 'item-status', id: item.id, status: 'error' })
    }
    emitProgress()
  }

  let verifyResult = null
  if (verify && !ac.signal.aborted) {
    setState('verifying')
    log.info('Verifying with checksums…')
    verifyResult = await verifyItems(items, {
      signal: ac.signal,
      onProgress: ({ checked, currentItem }) => deps.emit({ type: 'verify-progress', checked, currentItem })
    })
    if (verifyResult.mismatches.length) log.warn(`Verify found ${verifyResult.mismatches.length} mismatch(es).`)
    else log.ok(`Verify passed (${verifyResult.checked} files checked).`)
  }

  const summary = {
    at: Date.now(),
    durationMs: Date.now() - startedAt,
    bytesCopied: bytesDone,
    copiedItems, failedItems,
    cancelled: ac.signal.aborted,
    verify: verifyResult ? { checked: verifyResult.checked, mismatches: verifyResult.mismatches.length } : null
  }
  deps.emit({ type: 'done', summary })
  log.ok(`Sync finished in ${require('../util/bytes').humanDuration(summary.durationMs)} — ${copiedItems} synced, ${failedItems} failed.`)
  setState('idle')
  return summary
}

function cancel() {
  if (ac) { ac.abort(); log.warn('Cancelling…') }
}

module.exports = { configure, scan, start, cancel, isRunning, getState, buildItems }
