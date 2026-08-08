import React, { useMemo, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'
import { GameCard } from './GameCard.jsx'

export function GamesView() {
  const { detection, settings, scan, sync, actions } = useStore()
  const [q, setQ] = useState('')
  const [lib, setLib] = useState('all')

  const libraries = detection.libraries || []
  const statusById = useMemo(() => {
    const m = {}
    if (scan && scan.items) for (const it of scan.items) m[it.id] = it.status
    return m
  }, [scan])

  const rows = useMemo(() => {
    const out = []
    for (const l of libraries) {
      if (lib !== 'all' && l.label !== lib) continue
      for (const g of l.games) {
        if (q && !g.name.toLowerCase().includes(q.toLowerCase())) continue
        out.push({ game: g, libLabel: l.label, status: statusById[`${l.label}:${g.appid}`] })
      }
    }
    return out
  }, [libraries, lib, q, statusById])

  const allAppids = rows.map((r) => String(r.game.appid))
  const excluded = new Set(settings.excludedAppids || [])
  const includedShown = allAppids.filter((a) => !excluded.has(a)).length

  return (
    <div>
      <div className="page-head">
        <div className="grow">
          <h1>Games</h1>
          <div className="sub">Click a card to include / exclude it from backups. {includedShown} of {allAppids.length} shown are included.</div>
        </div>
        <button className="btn" onClick={() => actions.detectSteam()} disabled={sync.running}><Icon.refresh size={16} /> Rescan Steam</button>
        <button className="btn" onClick={() => actions.scanNow()} disabled={sync.running}><Icon.search size={16} /> Check status</button>
      </div>

      <div className="toolbar">
        <div className="search"><Icon.search size={15} /><input placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input" style={{ width: 'auto' }} value={lib} onChange={(e) => setLib(e.target.value)}>
          <option value="all">All libraries</option>
          {libraries.map((l) => <option key={l.label} value={l.label}>{l.label} ({l.games.length})</option>)}
        </select>
        <button className="btn ghost" onClick={() => actions.setManyExcluded(allAppids, false)}>Include all</button>
        <button className="btn ghost" onClick={() => actions.setManyExcluded(allAppids, true)}>Exclude all</button>
      </div>

      {rows.length === 0
        ? <div className="empty"><div className="big">No games found</div>{libraries.length === 0 ? 'Steam was not detected. Try “Rescan Steam”.' : 'Try a different search or library filter.'}</div>
        : <div className="games-grid">{rows.map((r) => <GameCard key={`${r.libLabel}:${r.game.appid}`} game={r.game} libLabel={r.libLabel} status={r.status} />)}</div>}
    </div>
  )
}
