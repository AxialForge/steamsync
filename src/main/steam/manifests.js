'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { parse } = require('./vdf')

// Read every appmanifest_*.acf in a steamapps folder and return the installed
// games. A game is "installed" (and thus backup-worthy) only if its
// common/<installdir> folder actually exists on disk.
function readGames(steamappsDir) {
  let entries = []
  try {
    entries = fs.readdirSync(steamappsDir).filter((f) => /^appmanifest_\d+\.acf$/i.test(f))
  } catch {
    return []
  }

  const games = []
  for (const file of entries) {
    const manifestPath = path.win32.join(steamappsDir, file)
    let acf
    try {
      acf = parse(fs.readFileSync(manifestPath, 'utf8'))
    } catch {
      continue
    }
    const state = acf.AppState || acf.appstate || {}
    const appid = state.appid || (file.match(/appmanifest_(\d+)\.acf/i) || [])[1]
    const name = state.name || `App ${appid}`
    const installdir = state.installdir
    if (!appid || !installdir) continue

    const installedPath = path.win32.join(steamappsDir, 'common', installdir)
    if (!fs.existsSync(installedPath)) continue // not actually installed here

    games.push({
      appid: String(appid),
      name,
      installdir,
      installedPath,
      manifestPath,
      manifestName: file,
      sizeOnDisk: Number(state.SizeOnDisk || state.sizeondisk || 0) || 0,
      lastUpdated: Number(state.LastUpdated || state.lastupdated || 0) || 0
    })
  }
  games.sort((a, b) => a.name.localeCompare(b.name))
  return games
}

module.exports = { readGames }
