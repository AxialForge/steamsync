'use strict'
// Electron-hosted test for the ssart:// cover-art path (can't run in plain node).
// Tests BOTH layers: (1) artwork.ensure() resolving/downloading in Electron main,
// and (2) an actual <img> in a renderer loading ssart://<appid> — the real path
// the Games grid uses.
//   npx electron test/electron-artwork.js
const { app, protocol, net, BrowserWindow } = require('electron')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')
const artwork = require('../src/main/steam/artwork')

protocol.registerSchemesAsPrivileged([
  { scheme: 'ssart', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } }
])
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'ss-ud-')))

app.whenReady().then(async () => {
  let code = 0
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-art-'))
  artwork.configure({ steamPath: 'C:\\Program Files (x86)\\Steam', cacheDir })
  protocol.handle('ssart', async (req) => {
    try {
      const appid = new URL(req.url).pathname.replace(/^\/+/, '')
      console.log('   [handler] req.url=' + req.url + ' appid=' + appid)
      const file = await artwork.ensure(appid, { allowNetwork: true })
      if (!file) { console.log('   [handler] 404 (no file)'); return new Response('', { status: 404 }) }
      const bytes = new Uint8Array(fs.readFileSync(file))
      console.log('   [handler] 200 bytes=' + bytes.length)
      return new Response(bytes, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=86400' } })
    } catch (e) { console.log('   [handler] error: ' + e.message); return new Response('', { status: 404 }) }
  })

  // Layer 1: ensure() in Electron main
  for (const id of ['1091500', '427520']) {
    const file = await artwork.ensure(id, { allowNetwork: true })
    const okFile = file && fs.existsSync(file) && fs.statSync(file).size > 1000
    console.log(`  ${okFile ? 'PASS' : 'FAIL'}  ensure(${id}) -> ${file ? path.basename(file) + ' (' + fs.statSync(file).size + 'b)' : 'null'}`)
    if (!okFile) code = 1
  }

  // Layer 2: an <img> in a real renderer (the actual Games-grid path).
  // Load from file:// to match the packaged app's origin (a data: URL has an
  // opaque origin that can't fetch a secure custom scheme).
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } })
  const tmpHtml = path.join(cacheDir, 'test.html')
  fs.writeFileSync(tmpHtml, '<!doctype html><meta charset="utf8"><body>ok</body>')
  await win.loadFile(tmpHtml)
  const result = await win.webContents.executeJavaScript(`(async () => {
    const out = {}
    try {
      const res = await fetch('ssart://img/1091500')
      out.fetch = { ok: res.ok, status: res.status, type: res.type, ct: res.headers.get('content-type') }
      const b = await res.blob(); out.blobSize = b.size; out.blobType = b.type
    } catch (e) { out.fetchErr = String(e) }
    out.img = await new Promise((r) => {
      const i = new Image()
      i.onload = () => r({ ok: true, w: i.naturalWidth })
      i.onerror = () => r({ ok: false })
      i.src = 'ssart://img/1091500'
      setTimeout(() => r({ ok: false, t: 1 }), 8000)
    })
    return out
  })()`)
  console.log('  [renderer] ' + JSON.stringify(result))
  const imgOk = result.img && result.img.ok && result.img.w > 0
  console.log(`  ${imgOk ? 'PASS' : 'FAIL'}  <img src=ssart://img/1091500>`)
  if (!imgOk) code = 1

  console.log(code === 0 ? '\n=== artwork OK ===' : '\n=== artwork FAILED ===')
  app.exit(code)
})
