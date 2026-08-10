'use strict'
// Headless smoke test — runs the main-process logic without Electron.
//   node test/smoke.js
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert')

const { detectSteam } = require('../src/main/steam/detect')
const robocopy = require('../src/main/sync/engines/robocopy')
const { scanItems } = require('../src/main/sync/scanner')
const orchestrator = require('../src/main/sync/orchestrator')
const { pathsOverlap } = require('../src/main/util/safety')

async function main() {
  let pass = 0, fail = 0
  const ok = (name, cond) => { if (cond) { pass++; console.log('  PASS', name) } else { fail++; console.log('  FAIL', name) } }

  console.log('\n[1] Steam detection')
  const det = await detectSteam()
  ok('steam path found', !!det.steamPath)
  ok('at least one library', det.libraries.length >= 1)
  const total = det.libraries.reduce((s, l) => s + l.games.length, 0)
  console.log(`      steam: ${det.steamPath}`)
  for (const l of det.libraries) console.log(`      library ${l.label}: ${l.games.length} games  (${l.steamapps})`)
  ok('games detected', total > 0)
  const sample = det.libraries.flatMap((l) => l.games).slice(0, 3)
  for (const g of sample) {
    ok(`game "${g.name}" has installed path`, fs.existsSync(g.installedPath))
    ok(`game "${g.name}" has manifest`, fs.existsSync(g.manifestPath))
  }

  console.log('\n[2] Robocopy engine (temp dirs)')
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'steamsync-'))
  const src = path.join(base, 'src'); const dst = path.join(base, 'dst')
  fs.mkdirSync(path.join(src, 'sub'), { recursive: true })
  fs.writeFileSync(path.join(src, 'a.txt'), 'hello world')
  fs.writeFileSync(path.join(src, 'sub', 'b.bin'), Buffer.alloc(4096, 7))

  const d1 = await robocopy.listDiff(src, dst)
  ok('diff finds files to copy', d1.filesToCopy >= 2)
  ok('diff counts bytes', d1.bytesToCopy > 0)

  await robocopy.copy({ source: src, dest: dst, name: 'test', extraFiles: [] }, { threads: 4 }, {})
  ok('copied a.txt', fs.existsSync(path.join(dst, 'a.txt')))
  ok('copied sub/b.bin', fs.existsSync(path.join(dst, 'sub', 'b.bin')))

  const d2 = await robocopy.listDiff(src, dst)
  ok('after copy, nothing to copy', d2.filesToCopy === 0)

  // orphan: a file on dest not in src must be reported, never deleted
  fs.writeFileSync(path.join(dst, 'orphan.txt'), 'only on nas')
  const d3 = await robocopy.listDiff(src, dst)
  ok('orphan reported', d3.orphanCount >= 1)
  await robocopy.copy({ source: src, dest: dst, name: 'test', extraFiles: [] }, { threads: 4 }, {})
  ok('orphan NOT deleted after another sync', fs.existsSync(path.join(dst, 'orphan.txt')))

  console.log('\n[3] Scanner over a folder-pair item')
  const scan = await scanItems([{ id: 'pair:test', name: 'test', type: 'folder', source: src, dest: dst, extraFiles: [] }])
  ok('scan returns totals', scan.totals && typeof scan.totals.bytesToCopy === 'number')
  ok('item in sync now', scan.items[0].status === 'in-sync')

  fs.rmSync(base, { recursive: true, force: true })

  console.log('\n[4] Orchestrator emits live per-item status')
  const baseB = fs.mkdtempSync(path.join(os.tmpdir(), 'steamsync-orch-'))
  const srcB = path.join(baseB, 's'); const dstB = path.join(baseB, 'd')
  fs.mkdirSync(srcB, { recursive: true })
  fs.writeFileSync(path.join(srcB, 'f.bin'), Buffer.alloc(4096, 3))
  const events = []
  orchestrator.configure({
    getSettings: () => ({ engine: 'robocopy', threads: 4, nasRoot: '', folderPairs: [{ id: 't', source: srcB, dest: dstB }] }),
    getDetection: () => ({ libraries: [] }),
    emit: (e) => events.push(e)
  })
  await orchestrator.start({ verify: false })
  const statuses = events.filter((e) => e.type === 'item-status' && e.id === 'pair:t').map((e) => e.status)
  ok('emits "syncing" status', statuses.includes('syncing'))
  ok('emits "in-sync" status', statuses.includes('in-sync'))
  ok('emits a "done" summary', events.some((e) => e.type === 'done'))
  ok('orchestrator copied the file', fs.existsSync(path.join(dstB, 'f.bin')))
  fs.rmSync(baseB, { recursive: true, force: true })

  console.log('\n[5] Safety guards + junk exclusion')
  ok('overlap: dest inside source', pathsOverlap('C:\\Games\\Steam', 'C:\\Games\\Steam\\backup'))
  ok('overlap: equal paths', pathsOverlap('C:\\a', 'c:\\a\\'))
  ok('no overlap: siblings', !pathsOverlap('C:\\Games', 'D:\\Backup'))
  ok('no false prefix (a\\b vs a\\bc)', !pathsOverlap('C:\\a\\b', 'C:\\a\\bc'))
  const baseC = fs.mkdtempSync(path.join(os.tmpdir(), 'steamsync-junk-'))
  const srcC = path.join(baseC, 's'); const dstC = path.join(baseC, 'd')
  fs.mkdirSync(path.join(srcC, '_CommonRedist', 'vc'), { recursive: true })
  fs.writeFileSync(path.join(srcC, 'game.exe'), 'x')
  fs.writeFileSync(path.join(srcC, '_CommonRedist', 'vc', 'setup.exe'), 'y')
  await robocopy.copy({ source: srcC, dest: dstC, name: 'j', extraFiles: [] }, { threads: 2, excludeDirs: ['_CommonRedist'] }, {})
  ok('junk: game.exe copied', fs.existsSync(path.join(dstC, 'game.exe')))
  ok('junk: _CommonRedist excluded', !fs.existsSync(path.join(dstC, '_CommonRedist')))
  fs.rmSync(baseC, { recursive: true, force: true })

  console.log(`\n=== ${pass} passed, ${fail} failed ===`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
