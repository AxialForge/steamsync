'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { parse } = require('./vdf')
const { readGames } = require('./manifests')
const log = require('../util/logger')

function regQuery(root, value) {
  return new Promise((resolve) => {
    execFile('reg', ['query', root, '/v', value], { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve(null)
      // line looks like:  SteamPath    REG_SZ    C:\Program Files (x86)\Steam
      const m = stdout.match(new RegExp(value + '\\s+REG_\\w+\\s+(.+)', 'i'))
      resolve(m ? m[1].trim() : null)
    })
  })
}

async function findSteamPath() {
  let p = await regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath')
  if (!p) p = await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath')
  if (!p) p = await regQuery('HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath')
  if (!p) {
    const guess = 'C:\\Program Files (x86)\\Steam'
    if (fs.existsSync(guess)) p = guess
  }
  return p ? path.win32.normalize(p) : null
}

// A human, collision-safe subfolder name for the NAS: drive letter + last
// meaningful segment. C:\Program Files (x86)\Steam -> "C-Steam";
// F:\SteamLibrary -> "F-SteamLibrary".
function labelForLibrary(libRoot) {
  const drive = (libRoot.match(/^([A-Za-z]):/) || [])[1]
  const base = path.win32.basename(libRoot.replace(/[\\/]+$/, '')) || 'Steam'
  const safeBase = base.replace(/[^A-Za-z0-9._-]+/g, '-')
  return drive ? `${drive.toUpperCase()}-${safeBase}` : safeBase
}

// Returns { steamPath, libraries: [{ root, steamapps, label, games:[...] }] }.
async function detectSteam() {
  const steamPath = await findSteamPath()
  if (!steamPath) {
    log.warn('Steam install not found in the registry or the default location.')
    return { steamPath: null, libraries: [] }
  }

  const vdfPath = path.win32.join(steamPath, 'steamapps', 'libraryfolders.vdf')

  // Windows paths are case-insensitive, but the registry SteamPath and the VDF
  // often disagree on casing (e.g. "c:/program files.../steam" vs
  // "C:\Program Files...\Steam"). Dedupe by canonical, lowercased path so a
  // library is never counted — or synced — twice.
  const canonical = (p) => { try { return fs.realpathSync.native(p) } catch { return path.win32.normalize(p) } }
  const rootsMap = new Map()
  const addRoot = (p) => { const c = canonical(p); rootsMap.set(c.toLowerCase(), c) }
  addRoot(steamPath) // the Steam install itself is always a library

  if (fs.existsSync(vdfPath)) {
    try {
      const data = parse(fs.readFileSync(vdfPath, 'utf8'))
      const lf = data.libraryfolders || data.LibraryFolders || {}
      for (const key of Object.keys(lf)) {
        const entry = lf[key]
        const p = typeof entry === 'string' ? entry : entry && entry.path
        if (p) addRoot(p)
      }
    } catch (e) {
      log.warn('Could not parse libraryfolders.vdf: ' + e.message)
    }
  }

  const libraries = []
  for (const root of rootsMap.values()) {
    const steamapps = path.win32.join(root, 'steamapps')
    if (!fs.existsSync(steamapps)) continue
    const games = readGames(steamapps)
    libraries.push({ root, steamapps, label: labelForLibrary(root), games })
  }
  libraries.sort((a, b) => a.label.localeCompare(b.label))

  const total = libraries.reduce((s, l) => s + l.games.length, 0)
  log.info(`Steam detected at ${steamPath}: ${libraries.length} librar${libraries.length === 1 ? 'y' : 'ies'}, ${total} installed games.`)
  return { steamPath, libraries }
}

module.exports = { detectSteam, findSteamPath, labelForLibrary }
