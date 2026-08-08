import React from 'react'
import { humanBytes, humanRate, eta } from '../format.js'

export function ProgressBar({ value, indeterminate }) {
  const pct = Math.max(0, Math.min(100, Math.round((value || 0) * 100)))
  return (
    <div className={'bar' + (indeterminate ? ' indef' : '')}>
      <i style={{ width: indeterminate ? undefined : pct + '%' }} />
    </div>
  )
}

// Live sync progress block, shared by the Dashboard and the Sync view.
export function SyncProgress({ progress, compact }) {
  if (!progress) return null
  const { bytesDone = 0, bytesTotal = 0, speedBps = 0, currentItem, currentFile, itemIndex = 0, itemsTotal = 0 } = progress
  const frac = bytesTotal > 0 ? bytesDone / bytesTotal : 0
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="title" style={{ minWidth: 0 }}>
          <span className="mono" style={{ color: 'var(--accent)' }}>{currentItem || '…'}</span>
          {currentFile && !compact && <span className="muted" style={{ marginLeft: 8, fontSize: 11.5 }}>{currentFile}</span>}
        </div>
        <div className="muted mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{itemIndex + 1}/{itemsTotal}</div>
      </div>
      <ProgressBar value={frac} indeterminate={bytesTotal === 0} />
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, fontSize: 12.5 }}>
        <span className="muted">{humanBytes(bytesDone)} / {humanBytes(bytesTotal)}</span>
        <span className="muted">{humanRate(speedBps)} · ETA {eta(bytesDone, bytesTotal, speedBps)}</span>
      </div>
    </div>
  )
}
