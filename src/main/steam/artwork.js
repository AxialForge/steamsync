'use strict'

const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const https = require('node:https')
const log = require('../util/logger')

// Resolve a portrait "title card" for a game. Strategy (per user's choice):
//   1. our own cache (userData/artwork/<appid>.jpg)   — instant, offline
//   2. Steam's local library art cache                 — instant, offline
//   3. Steam CDN                                        — needs internet, cached after
// Returns an absolute file path, or null if nothing could be found.

let STEAM_PATH = null
let CACHE_DIR = null
const inflight = new Map()

function configure({ steamPath, cacheDir }) {
  STEAM_PATH = steamPath || STEAM_PATH
  CACHE_DIR = cacheDir || CACHE_DIR
  if (CACHE_DIR) fs.mkdirSync(CACHE_DIR, { recursive: true })
}

// Newer Steam clients store art as librarycache/<appid>/<hash>/library_capsule.jpg
// (nested), while older ones used librarycache/<appid>_library_600x900.jpg (flat).
// Search both, preferring the portrait capsule.
function findLocal(appid) {
  const candidates = []
  if (STEAM_PATH) {
    const base = path.win32.join(STEAM_PATH, 'appcache', 'librarycache')
    const dir = path.win32.join(base, appid)
    const priority = ['library_capsule.jpg', 'library_600x900.jpg', 'library_600x900_2x.jpg', 'library_header.jpg', 'header.jpg']
    const found = []
    const walk = (d, depth) => {
      if (depth > 2) return
      let ents
      try { ents = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
      for (const e of ents) {
        const ab = path.win32.join(d, e.name)
        if (e.isDirectory()) walk(ab, depth + 1)
        else found.push(ab)
      }
    }
    if (fs.existsSync(dir)) walk(dir, 0)
    for (const name of priority) {
      const hit = found.find((f) => path.basename(f).toLowerCase() === name)
      if (hit) candidates.push(hit)
    }
    // legacy flat names
    candidates.push(path.win32.join(base, `${appid}_library_600x900.jpg`))
    candidates.push(path.win32.join(base, `${appid}_header.jpg`))
  }
  return candidates.find((c) => fs.existsSync(c)) || null
}

function cdnCandidates(appid) {
  return [
    `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
  ]
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)) }
      const tmp = dest + '.part'
      const out = fs.createWriteStream(tmp)
      res.pipe(out)
      out.on('finish', () => out.close(() => fs.rename(tmp, dest, (e) => (e ? reject(e) : resolve(dest)))))
      out.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

async function ensure(appid, { allowNetwork = true } = {}) {
  appid = String(appid)
  if (!CACHE_DIR) return null
  const cached = path.win32.join(CACHE_DIR, `${appid}.jpg`)
  if (fs.existsSync(cached) && fs.statSync(cached).size > 0) return cached

  if (inflight.has(appid)) return inflight.get(appid)
  const task = (async () => {
    const local = findLocal(appid)
    if (local) {
      try { await fsp.copyFile(local, cached); return cached } catch { /* fall through to CDN */ }
    }
    if (allowNetwork) {
      for (const url of cdnCandidates(appid)) {
        try { await download(url, cached); return cached } catch { /* try next url */ }
      }
      log.warn(`No cover art found for app ${appid}.`)
    }
    return null
  })().finally(() => inflight.delete(appid))
  inflight.set(appid, task)
  return task
}

module.exports = { configure, ensure, findLocal }
