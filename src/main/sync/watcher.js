'use strict'

const chokidar = require('chokidar')
const orchestrator = require('./orchestrator')
const log = require('../util/logger')

// Auto-sync driver. Two triggers (user's "Watch + safety re-scan" choice):
//   1. Live watch — Steam rewrites appmanifest_*.acf when an install/update
//      finishes, so watching those (cheap, top-level only) is a precise signal.
//      Folder-pair sources are watched recursively.
//   2. Safety re-scan — a periodic full sync so a missed event can't leave the
//      backup stale.
// After any trigger we debounce, then call orchestrator.start() if idle.

let watcher = null
let debounceTimer = null
let safetyTimer = null
let deps = { getSettings: () => ({}), getDetection: () => ({ libraries: [] }) }

function configure(d) { deps = { ...deps, ...d } }

function trigger(reason) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (orchestrator.isRunning()) { log.info(`Auto-sync deferred (${reason}); a run is already in progress.`); return }
    log.info(`Auto-sync triggered (${reason}).`)
    orchestrator.start({ verify: false }).catch((e) => log.error('Auto-sync error: ' + e.message))
  }, 5000)
}

function stop() {
  if (watcher) { watcher.close(); watcher = null }
  clearInterval(safetyTimer); safetyTimer = null
  clearTimeout(debounceTimer); debounceTimer = null
}

function start() {
  stop()
  const s = deps.getSettings()
  const det = deps.getDetection() || { libraries: [] }
  const manifestGlobs = (det.libraries || []).map((l) => l.steamapps.replace(/\\/g, '/') + '/appmanifest_*.acf')
  const folderSources = (s.folderPairs || []).map((p) => p.source).filter(Boolean)
  const paths = [...manifestGlobs, ...folderSources]
  if (!paths.length) { log.warn('Auto-sync on, but nothing to watch yet.'); return }

  watcher = chokidar.watch(paths, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
    depth: undefined
  })
  watcher.on('add', () => trigger('file added'))
  watcher.on('change', () => trigger('file changed'))
  // note: 'unlink' is intentionally ignored — deletions never propagate to the NAS.

  const mins = Math.max(5, s.safetyRescanMinutes || 30)
  safetyTimer = setInterval(() => trigger('safety re-scan'), mins * 60 * 1000)
  log.ok(`Auto-sync watching ${paths.length} location(s); safety re-scan every ${mins} min.`)
}

// Re-evaluate on settings changes: run only when autoSync is enabled.
function apply() {
  const s = deps.getSettings()
  if (s.autoSync) start()
  else stop()
}

module.exports = { configure, start, stop, apply }
