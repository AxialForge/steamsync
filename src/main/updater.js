'use strict'

const log = require('./util/logger')

// Auto-update against GitHub Releases via electron-updater. electron-updater is
// required lazily (it reads app.getVersion() at import, so it must load inside
// Electron — keeps this file harmless to require in plain node tests).
// autoDownload stays true here (this is a sync tool, not the offline-only JDot),
// but install still waits for the user to click "Restart & install".

let autoUpdater = null
let emit = () => {}
let win = null

function isActive() {
  try { const { app } = require('electron'); return app.isPackaged } catch { return false }
}

function configure(browserWindow, emitFn) {
  win = browserWindow
  if (emitFn) emit = emitFn
  if (!isActive()) return
  ;({ autoUpdater } = require('electron-updater'))
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.on('checking-for-update', () => emit({ state: 'checking' }))
  autoUpdater.on('update-available', (i) => { emit({ state: 'available', version: i.version }); log.info(`Update available: v${i.version}`) })
  autoUpdater.on('update-not-available', () => emit({ state: 'up-to-date' }))
  autoUpdater.on('download-progress', (p) => emit({ state: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (i) => { emit({ state: 'downloaded', version: i.version }); log.ok(`Update v${i.version} downloaded — restart to install.`) })
  autoUpdater.on('error', (e) => { emit({ state: 'error', message: String(e && e.message || e) }); log.warn('Updater error: ' + (e && e.message)) })
}

async function check() {
  if (!isActive()) { emit({ state: 'dev', message: 'Updates are only checked in the installed app.' }); return }
  try { await autoUpdater.checkForUpdates() } catch (e) { emit({ state: 'error', message: String(e.message) }) }
}

function quitAndInstall() {
  if (autoUpdater) autoUpdater.quitAndInstall()
}

module.exports = { configure, check, quitAndInstall, isActive }
