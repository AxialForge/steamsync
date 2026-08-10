import React, { useState, useMemo } from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'
import { SyncProgress } from './Progress.jsx'
import { humanBytes } from '../format.js'

// Restore = reverse copy (NAS -> PC). Additive; never deletes on the PC.
export function RestoreView() {
  const { detection, settings, sync, actions } = useStore()
  const [nas, setNas] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [targetRoot, setTargetRoot] = useState('')
  const [confirming, setConfirming] = useState(false)

  const libs = detection.libraries || []
  const busy = sync.running || sync.state !== 'idle'
  const needsNas = !settings.nasRoot

  const doScan = async () => {
    setScanning(true)
    try {
      const res = await actions.restoreScan()
      setNas(res || [])
      // default target: a local library whose label matches a NAS label, else the first
      if (!targetRoot && libs.length) {
        const labels = new Set((res || []).map((g) => g.label))
        const match = libs.find((l) => labels.has(l.label)) || libs[0]
        setTargetRoot(match.root)
      }
    } finally { setScanning(false) }
  }

  const allGames = useMemo(() => (nas || []).flatMap((grp) => grp.games.map((g) => ({ ...g, groupLabel: grp.label }))), [nas])
  const keyOf = (g) => `${g.groupLabel}:${g.appid}`
  const toggle = (g) => setSelected((prev) => { const n = new Set(prev); const k = keyOf(g); n.has(k) ? n.delete(k) : n.add(k); return n })
  const selectedGames = allGames.filter((g) => selected.has(keyOf(g)))
  const selectedBytes = selectedGames.reduce((s, g) => s + (g.sizeOnDisk || 0), 0)
  const targetLabel = (libs.find((l) => l.root === targetRoot) || {}).label || targetRoot

  const doRestore = () => {
    actions.restoreStart({ games: selectedGames, targetRoot })
    setConfirming(false)
  }

  return (
    <div>
      <div className="page-head">
        <div className="grow">
          <h1>Restore</h1>
          <div className="sub">Copy games from the NAS back to your PC. Additive — nothing on your PC is deleted or overwritten with older files.</div>
        </div>
        <button className="btn" onClick={doScan} disabled={busy || scanning || needsNas}><Icon.search size={16} /> {scanning ? 'Scanning…' : 'Scan NAS'}</button>
      </div>

      {needsNas && <div className="banner accent"><Icon.folder size={18} /><div className="grow">Set your NAS folder in Settings first.</div><div className="acts"><button className="btn" onClick={() => actions.setView('settings')}>Settings</button></div></div>}

      {sync.progress && <div className="card"><h2>Restoring</h2><SyncProgress progress={sync.progress} /><div className="row" style={{ marginTop: 12 }}><button className="btn danger" onClick={actions.cancel}><Icon.x size={15} /> Cancel</button></div></div>}

      {sync.summary && !busy && <div className="banner accent"><Icon.check size={18} /><div className="grow">Last restore: {sync.summary.copiedItems} item(s), {humanBytes(sync.summary.bytesCopied)}{sync.summary.failedItems ? `, ${sync.summary.failedItems} failed` : ''}. In Steam, use “Verify integrity” if a game doesn’t appear installed.</div></div>}

      {nas && !busy && (
        <div className="card">
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <div className="grow">
              <label style={{ fontSize: 12, fontWeight: 650, marginRight: 8 }}>Restore into:</label>
              {libs.length
                ? <select className="input" style={{ width: 'auto' }} value={targetRoot} onChange={(e) => setTargetRoot(e.target.value)}>
                  {libs.map((l) => <option key={l.root} value={l.root}>{l.label} — {l.root}</option>)}
                </select>
                : <span className="muted">No local Steam library detected to restore into.</span>}
            </div>
            <button className="btn ghost" onClick={() => setSelected(new Set(allGames.map(keyOf)))}>Select all</button>
            <button className="btn ghost" onClick={() => setSelected(new Set())}>Clear</button>
          </div>

          {allGames.length === 0
            ? <div className="empty"><div className="big">No backups found on the NAS</div>Nothing at {settings.nasRoot} yet — run a sync first.</div>
            : <div className="list">
              {allGames.map((g) => {
                const k = keyOf(g); const on = selected.has(k)
                return (
                  <div className="list-row" key={k} style={{ cursor: 'pointer' }} onClick={() => toggle(g)}>
                    <div className={'check' + (on ? ' on' : '')} style={{ position: 'static', width: 20, height: 20, borderRadius: 5, background: on ? 'var(--accent)' : 'var(--panel-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}>{on && <Icon.check size={13} />}</div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="title">{g.name}</div>
                      <div className="path mono">{g.groupLabel} · {g.installdir}</div>
                    </div>
                    <span className="muted" style={{ whiteSpace: 'nowrap' }}>{humanBytes(g.sizeOnDisk)}</span>
                  </div>
                )
              })}
            </div>}

          {selectedGames.length > 0 && (
            <div className="row" style={{ marginTop: 14, alignItems: 'center' }}>
              <div className="grow muted" style={{ fontSize: 13 }}>{selectedGames.length} selected · {humanBytes(selectedBytes)} → <b>{targetLabel}</b></div>
              {confirming
                ? <>
                  <span className="pill warn">Restore {selectedGames.length} game(s) to {targetLabel}?</span>
                  <button className="btn primary" onClick={doRestore} disabled={!targetRoot}><Icon.check size={15} /> Confirm</button>
                  <button className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
                </>
                : <button className="btn primary" onClick={() => setConfirming(true)} disabled={!targetRoot}><Icon.download size={15} /> Restore selected</button>}
            </div>
          )}
        </div>
      )}

      {!nas && !busy && <div className="empty"><div className="big">Restore from your NAS backup</div>Click “Scan NAS” to list the games you’ve backed up, then pick which to copy back.</div>}
    </div>
  )
}
