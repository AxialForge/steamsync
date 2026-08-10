'use strict'

const { ipcMain, dialog, shell, app } = require('electron')
const settings = require('./settings')
const orchestrator = require('./sync/orchestrator')
const engines = require('./sync/engines')
const { scanNasBackups } = require('./steam/nasscan')
const updater = require('./updater')
const log = require('./util/logger')

// One place that wires the renderer's window.api to main-process work.
function registerIpc(ctx) {
  const handle = (channel, fn) => ipcMain.handle(channel, (_e, ...args) => fn(...args))

  handle('app:getInfo', () => ({
    version: app.getVersion(),
    platform: process.platform,
    updaterActive: updater.isActive()
  }))

  handle('settings:get', () => settings.all())
  handle('settings:set', (patch) => {
    const next = settings.set(patch || {})
    if (ctx.onSettingsChanged) ctx.onSettingsChanged()
    return next
  })

  handle('engines:detect', () => engines.detectAll({ rclonePath: settings.all().rclonePath }))

  handle('steam:get', () => ctx.getDetection())
  handle('steam:detect', async () => {
    const d = await ctx.refreshDetection()
    const w = ctx.getWindow()
    if (w) w.webContents.send('event', { type: 'detection', detection: d })
    return d
  })

  handle('sync:scan', () => orchestrator.scan())
  handle('sync:start', (opts) => {
    if (orchestrator.isRunning()) return { started: false, reason: 'busy' }
    orchestrator.start(opts || {}).catch((e) => log.error('Sync error: ' + e.message))
    return { started: true }
  })
  handle('sync:cancel', () => { orchestrator.cancel(); return true })
  handle('sync:state', () => orchestrator.getState())

  // Restore (NAS -> PC)
  handle('restore:scan', () => scanNasBackups(settings.all().nasRoot))
  handle('restore:start', (payload) => {
    if (orchestrator.isRunning()) return { started: false, reason: 'busy' }
    orchestrator.restore(payload || {}).catch((e) => log.error('Restore error: ' + e.message))
    return { started: true }
  })

  handle('folders:choose', async (kind) => {
    const w = ctx.getWindow()
    const res = await dialog.showOpenDialog(w, {
      title: kind === 'nas' ? 'Choose the NAS backup folder' : 'Choose a folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return res.canceled ? null : res.filePaths[0]
  })

  handle('path:open', (p) => shell.openPath(p))
  handle('path:reveal', (p) => { shell.showItemInFolder(p); return true })
  handle('url:open', (u) => { if (/^https?:\/\//i.test(u)) shell.openExternal(u); return true })

  handle('log:recent', () => log.recent())

  handle('updater:check', () => updater.check())
  handle('updater:install', () => updater.quitAndInstall())
}

module.exports = { registerIpc }
