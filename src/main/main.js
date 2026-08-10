'use strict'

const { app, BrowserWindow, Tray, Menu, protocol, nativeImage, Notification } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { humanBytes } = require('./util/bytes')

const settings = require('./settings')
const log = require('./util/logger')
const { detectSteam } = require('./steam/detect')
const artwork = require('./steam/artwork')
const orchestrator = require('./sync/orchestrator')
const watcher = require('./sync/watcher')
const updater = require('./updater')
const { registerIpc } = require('./ipc')

// Custom scheme for game cover art: <img src="ssart://<appid>"> resolves through
// artwork.ensure(). Registered privileged BEFORE app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'ssart', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }
])

let win = null
let tray = null
let detection = { steamPath: null, libraries: [] }
let isQuitting = false

const DEV_URL = process.env.VITE_DEV_SERVER_URL

function emitEvent(payload) {
  if (win && !win.isDestroyed()) win.webContents.send('event', payload)
  if (payload.type === 'done' && settings.all().notifications) notifyDone(payload.summary)
}

function notifyDone(sum) {
  try {
    if (!Notification.isSupported()) return
    const failed = sum && sum.failedItems
    const body = sum
      ? (sum.cancelled ? 'Sync cancelled.' : `${sum.copiedItems} synced${failed ? `, ${failed} failed` : ''} · ${humanBytes(sum.bytesCopied)}`)
      : 'Sync finished.'
    const n = new Notification({ title: failed ? 'SteamSync — completed with errors' : 'SteamSync — sync complete', body, icon: iconPath() })
    n.on('click', () => { if (win) { win.show(); win.focus() } })
    n.show()
  } catch { /* notifications are best-effort */ }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0b0d',
    title: 'SteamSync',
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.removeMenu()

  if (DEV_URL) { win.loadURL(DEV_URL); win.webContents.openDevTools({ mode: 'detach' }) }
  else win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))

  // Close-to-tray (when enabled): hide instead of quitting. Only when a tray
  // actually exists, so the window can never be stranded with no way back.
  win.on('close', (e) => {
    if (!isQuitting && settings.all().minimizeToTray && tray) { e.preventDefault(); win.hide() }
  })
}

function iconPath() {
  const p = path.join(__dirname, '../../build/icon.ico')
  return fs.existsSync(p) ? p : undefined
}

function buildTray() {
  const icon = iconPath()
  if (!icon) { log.warn('No tray icon (build/icon.ico missing) — running without a tray.'); return }
  tray = new Tray(nativeImage.createFromPath(icon))
  const menu = Menu.buildFromTemplate([
    { label: 'Open SteamSync', click: () => { win.show(); win.focus() } },
    { label: 'Sync now', click: () => orchestrator.start({ verify: settings.all().verify }).catch((e) => log.error(e.message)) },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit() } }
  ])
  tray.setToolTip('SteamSync')
  tray.setContextMenu(menu)
  tray.on('double-click', () => { win.show(); win.focus() })
}

async function refreshDetection() {
  detection = await detectSteam()
  artwork.configure({ steamPath: detection.steamPath })
  return detection
}

function applyLaunchOnLogin() {
  if (process.platform !== 'win32') return
  app.setLoginItemSettings({ openAtLogin: !!settings.all().launchOnLogin })
}

async function boot() {
  settings.load()
  artwork.configure({ cacheDir: path.join(app.getPath('userData'), 'artwork') })

  // Serve cover art.
  protocol.handle('ssart', async (req) => {
    try {
      // The appid is in the PATH (ssart://img/<appid>), NOT the host: on a
      // standard scheme Chromium parses a numeric host (e.g. 1091500) as an
      // IPv4 address, so a host-based appid never resolves.
      const appid = new URL(req.url).pathname.replace(/^\/+/, '')
      const allowNetwork = settings.all().showArtwork !== false
      const file = await artwork.ensure(appid, { allowNetwork })
      if (!file) return new Response('', { status: 404 })
      const bytes = new Uint8Array(fs.readFileSync(file)) // fresh, exact-length copy
      return new Response(bytes, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=86400' } })
    } catch (e) {
      log.warn(`artwork ${req.url}: ${e.message}`)
      return new Response('', { status: 404 })
    }
  })

  log.setSink((entry) => { if (win && !win.isDestroyed()) win.webContents.send('log', entry) })

  createWindow()
  buildTray()
  applyLaunchOnLogin()

  orchestrator.configure({ getSettings: settings.all, getDetection: () => detection, emit: emitEvent })
  watcher.configure({ getSettings: settings.all, getDetection: () => detection })
  updater.configure(win, (s) => { if (win && !win.isDestroyed()) win.webContents.send('updater', s) })

  registerIpc({
    getWindow: () => win,
    getDetection: () => detection,
    refreshDetection,
    onSettingsChanged: () => { applyLaunchOnLogin(); watcher.apply() }
  })

  await refreshDetection()
  win.webContents.send('event', { type: 'detection', detection })

  if (settings.all().autoSync) watcher.apply()
  if (settings.all().checkUpdatesOnLaunch) setTimeout(() => updater.check(), 4000)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus() } })
  app.whenReady().then(boot)
  app.on('window-all-closed', () => { /* stay alive in tray */ })
  app.on('before-quit', () => { isQuitting = true })
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
}
