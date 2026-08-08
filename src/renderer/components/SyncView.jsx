import React from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'
import { SyncProgress } from './Progress.jsx'
import { LogPanel } from './LogPanel.jsx'
import { humanBytes, humanDuration } from '../format.js'

const STATUS_CLS = { 'in-sync': 'ok', 'needs-sync': 'warn', 'not-backed-up': 'err' }

export function SyncView() {
  const { scan, sync, settings, actions } = useStore()
  const busy = sync.running || sync.state !== 'idle'
  const needsNas = !settings.nasRoot
  const items = (scan && scan.items) || []
  const toCopy = items.filter((i) => i.bytesToCopy > 0)
  const orphans = (scan && scan.orphansByItem) || []

  return (
    <div>
      <div className="page-head">
        <div className="grow">
          <h1>Sync</h1>
          <div className="sub">Local → NAS. Newer/changed files copy; nothing on the NAS is ever removed.</div>
        </div>
        <button className="btn" onClick={() => actions.scanNow()} disabled={busy}><Icon.search size={16} /> Scan</button>
        {busy
          ? <button className="btn danger" onClick={actions.cancel}><Icon.x size={16} /> Cancel</button>
          : <button className="btn primary" onClick={() => actions.startSync({ verify: settings.verify })} disabled={needsNas}><Icon.play size={16} /> Sync Now</button>}
      </div>

      {needsNas && <div className="banner accent"><Icon.folder size={18} /><div className="grow">Set your NAS folder in Settings before syncing.</div><div className="acts"><button className="btn" onClick={() => actions.setView('settings')}>Settings</button></div></div>}

      {sync.progress && <div className="card"><h2>In progress</h2><SyncProgress progress={sync.progress} /></div>}

      {sync.verify && sync.state === 'verifying' && (
        <div className="card"><h2>Verifying checksums</h2><div className="bar indef"><i /></div><div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>{sync.verify.checked} files checked · {sync.verify.currentItem}</div></div>
      )}

      {sync.summary && !busy && (
        <div className="banner accent">
          <Icon.check size={18} />
          <div className="grow">Last sync: {sync.summary.copiedItems} item(s) copied{sync.summary.failedItems ? `, ${sync.summary.failedItems} failed` : ''} · {humanBytes(sync.summary.bytesCopied)} in {humanDuration(sync.summary.durationMs)}{sync.summary.verify ? ` · verified ${sync.summary.verify.checked} files (${sync.summary.verify.mismatches} mismatch)` : ''}{sync.summary.cancelled ? ' · cancelled' : ''}.</div>
        </div>
      )}

      <div className="card">
        <h2>Items {scan ? `· ${toCopy.length} need syncing of ${items.length}` : ''}</h2>
        {items.length === 0
          ? <div className="muted" style={{ fontSize: 13 }}>Run a scan to see what differs between your PC and the NAS.</div>
          : <div className="list">
            {items.slice().sort((a, b) => b.bytesToCopy - a.bytesToCopy).map((it) => (
              <div className="list-row" key={it.id}>
                <span className={'dot ' + (STATUS_CLS[it.status] || '')} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="title">{it.name}</div>
                  <div className="path mono">{it.dest}</div>
                </div>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {it.bytesToCopy > 0
                    ? <span className="pill warn">{humanBytes(it.bytesToCopy)} · {it.filesToCopy} files</span>
                    : <span className="pill ok">in sync</span>}
                  {it.orphanCount > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{it.orphanCount} only on NAS</div>}
                </div>
              </div>
            ))}
          </div>}
      </div>

      {orphans.length > 0 && (
        <div className="card">
          <h2>Only on the NAS ({orphans.reduce((s, o) => s + o.orphans.length, 0)}+) — kept, never deleted</h2>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>These exist on the NAS but not on your PC (e.g. games you removed locally). SteamSync will never touch them — prune them yourself if you want.</div>
          <div className="list">
            {orphans.map((o) => (
              <div className="list-row" key={o.id}>
                <Icon.folder size={16} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="title">{o.name} <span className="muted">· {o.orphans.length} file(s)</span></div>
                  <div className="path mono">{o.dest}</div>
                </div>
                <button className="btn ghost" onClick={() => actions.reveal(o.dest)}><Icon.folderOpen size={15} /> Open</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card"><h2>Live log</h2><LogPanel height={260} /></div>
    </div>
  )
}
