'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { readGames } = require('./manifests')

// Enumerate games backed up on the NAS by reading each library subfolder's
// steamapps/appmanifest_*.acf (the same manifests the sync copies over). This is
// how Restore finds games even when they're no longer installed locally.
// Returns [{ label, steamapps, games: [{ appid, name, installdir, sizeOnDisk,
//   nasCommon, nasManifest, manifestName }] }].
function scanNasBackups(nasRoot) {
  if (!nasRoot || !fs.existsSync(nasRoot)) return []
  const out = []
  let entries
  try { entries = fs.readdirSync(nasRoot, { withFileTypes: true }) } catch { return [] }
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const steamapps = path.win32.join(nasRoot, e.name, 'steamapps')
    if (!fs.existsSync(steamapps)) continue
    const games = readGames(steamapps).map((g) => ({
      appid: g.appid, name: g.name, installdir: g.installdir, sizeOnDisk: g.sizeOnDisk,
      nasCommon: g.installedPath, nasManifest: g.manifestPath, manifestName: g.manifestName
    }))
    if (games.length) out.push({ label: e.name, steamapps, games })
  }
  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

module.exports = { scanNasBackups }
