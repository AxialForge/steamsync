import React, { useMemo } from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'
import { SyncProgress } from './Progress.jsx'
import { humanBytes, humanDuration, timeAgo } from '../format.js'

export function Dashboard() {
  const { detection, settings, scan, sync, engines, actions } = useStore()

  const libraries = detection.libraries || []
  const games = useMemo(() => libraries.flatMap((l) => l.games), [libraries])
  const totalSize = useMemo(() => games.reduce((s, g) => s + (g.sizeOnDisk || 0), 0), [games])
  const excluded = new Set(settings.excludedAppids || [])
  const includedCount = games.filter((g) => !excluded.has(String(g.appid))).length

  const busy = sync.running || sync.state !== 'idle'
  const needsNas = !settings.nasRoot
  const engine = engines && engines[settings.engine]

  const doScan = () => actions.scanNow()
  const doSync = () => actions.startSync({ verify: settings.verify })

  return (
    <div>
      <div className="page-head">
        <div className="grow">
          <h1>Dashboard</h1>
          <div className="sub">One-way backup · your PC is the master · the NAS is never deleted by SteamSync</div>
        </div>
        <button className="btn" onClick={doScan} disabled={busy}><Icon.search size={16} /> Scan</button>
        <button className="btn primary big" onClick={doSync} disabled={busy || needsNas}><Icon.play size={16} /> Sync Now</button>
      </div>

      {needsNas && (
        <div className="banner accent">
          <Icon.folder size={18} />
          <div className="grow">Choose your NAS backup folder to get started. Each Steam library gets its own subfolder there.</div>
          <div className="acts"><button className="btn" onClick={() => actions.setView('settings')}>Open Settings</button></div>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat"><div className="num">{includedCount}<span className="muted" style={{ fontSize: 14 }}>/{games.length}</span></div><div className="label">Games to back up</div></div>
        <div className="stat"><div className="num">{humanBytes(totalSize)}</div><div className="label">Library size</div></div>
        <div className="stat"><div className="num">{libraries.length}</div><div className="label">Libraries</div><div className="hint">{libraries.map((l) => l.label).join(' · ') || '—'}</div></div>
        <div className="stat"><div className="num accent">{scan ? humanBytes(scan.totals.bytesToCopy) : '—'}</div><div className="label">To sync</div><div className="hint">{scan ? `${scan.totals.filesToCopy} files` : 'Run a scan'}</div></div>
        <div className="stat"><div className="num" style={{ fontSize: 16, marginTop: 6 }}>{sync.summary ? timeAgo(sync.summary.at) : 'never'}</div><div className="label">Last sync</div>{sync.summary && <div className="hint">{humanBytes(sync.summary.bytesCopied)} in {humanDuration(sync.summary.durationMs)}</div>}</div>
        <div className="stat"><div className="num" style={{ fontSize: 16, marginTop: 6 }}>{settings.autoSync ? 'Auto' : 'Manual'}</div><div className="label">Mode</div><div className="hint">{engine ? engine.label.split(' ')[0] : settings.engine}</div></div>
      </div>

      {busy && (
        <div className="card">
          <h2>{sync.state === 'verifying' ? 'Verifying' : sync.state === 'scanning' ? 'Scanning' : 'Syncing'}</h2>
          {sync.progress ? <SyncProgress progress={sync.progress} compact />
            : <div className="bar indef"><i /></div>}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => actions.setView('sync')}>Open Sync view</button>
            <button className="btn danger" onClick={actions.cancel}><Icon.x size={15} /> Cancel</button>
          </div>
        </div>
      )}

      {!busy && scan && (
        <div className="card">
          <h2>Last scan</h2>
          <div className="row wrap">
            <div className="stat grow"><div className="num accent">{humanBytes(scan.totals.bytesToCopy)}</div><div className="label">{scan.totals.filesToCopy} files to copy</div></div>
            <div className="stat grow"><div className="num">{scan.totals.orphanCount}</div><div className="label">Only on NAS (kept, never deleted)</div></div>
            <div className="stat grow"><div className="num">{scan.totals.itemCount}</div><div className="label">Items checked</div></div>
          </div>
          {scan.totals.bytesToCopy > 0 && <div style={{ marginTop: 12 }}><button className="btn primary" onClick={doSync} disabled={needsNas}><Icon.play size={15} /> Sync {humanBytes(scan.totals.bytesToCopy)} now</button></div>}
        </div>
      )}

      <RecentActivity />
    </div>
  )
}

function RecentActivity() {
  const { log } = useStore()
  const tail = log.slice(-7).reverse()
  return (
    <div className="card">
      <h2>Recent activity</h2>
      {tail.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Nothing yet. Scan or sync to see activity here.</div>}
      {tail.map((e, i) => (
        <div key={i} className={'log-line ' + (e.level || '')} style={{ padding: '3px 0' }}>
          <span className="ts">{new Date(e.t).toLocaleTimeString()}</span>{e.message}
        </div>
      ))}
    </div>
  )
}
