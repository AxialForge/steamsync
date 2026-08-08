'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { app } = require('electron')

// Persisted to userData/settings.json (same pattern as JDot Utilities). Synchronous
// read at boot; debounced-free simple write on set.

const DEFAULTS = {
  theme: 'dark',                 // 'dark' | 'light'  (the two themes)
  nasRoot: '',                   // base NAS folder; each library maps to a subfolder under it
  engine: 'robocopy',            // 'robocopy' | 'node' | 'rclone'
  threads: 16,                   // /MT thread count (robocopy) / concurrency
  verify: false,                 // hash-verify after copy
  bandwidthKbps: null,           // optional throttle; null = full speed
  rclonePath: null,              // override path to rclone.exe

  autoSync: false,               // master/manual is the user's call
  safetyRescanMinutes: 30,       // periodic backstop when autoSync is on

  excludedAppids: [],            // per-game opt-out (default: back everything up)
  folderPairs: [],               // [{ id, label, source, dest }]

  minimizeToTray: true,          // close/minimize hides to tray instead of quitting
  launchOnLogin: false,          // start with Windows
  checkUpdatesOnLaunch: true,    // auto-check GitHub Releases at startup
  showArtwork: true              // title cards on the dashboard
}

let filePath = null
let cache = null

function load() {
  filePath = path.join(app.getPath('userData'), 'settings.json')
  try {
    cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) }
  } catch {
    cache = { ...DEFAULTS }
  }
  return cache
}

function all() { return cache || load() }

function save() {
  try { fs.writeFileSync(filePath, JSON.stringify(cache, null, 2)) } catch { /* best effort */ }
}

function set(patch) {
  if (!cache) load()
  cache = { ...cache, ...patch }
  save()
  return cache
}

module.exports = { DEFAULTS, load, all, set }
