import React, { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'
import { humanBytes } from '../format.js'

const STATUS = {
  'in-sync': { cls: 'ok', label: 'In sync' },
  'needs-sync': { cls: 'warn', label: 'Needs sync' },
  'not-backed-up': { cls: 'err', label: 'Not backed up' },
  'syncing': { cls: 'accent', label: 'Syncing…' },
  'error': { cls: 'err', label: 'Failed' }
}

export function GameCard({ game, libLabel, status }) {
  const { settings, actions } = useStore()
  const [failed, setFailed] = useState(false)
  const appid = String(game.appid)
  const excluded = (settings.excludedAppids || []).includes(appid)
  const showArt = settings.showArtwork !== false
  const st = status && STATUS[status]

  return (
    <div className={'game-card' + (excluded ? ' excluded' : '')} onClick={() => actions.toggleExcluded(appid)} title={game.name}>
      <div className="cover">
        {showArt && !failed
          ? <img src={actions.artworkUrl(appid)} alt="" onError={() => setFailed(true)} loading="lazy" />
          : <div className="initial">{(game.name || '?').charAt(0).toUpperCase()}</div>}
        <div className={'check' + (excluded ? '' : ' on')}>{!excluded && <Icon.check size={14} />}</div>
        {st && <span className="status pill" style={{ padding: '2px 8px' }}><span className={'dot ' + st.cls} />{st.label}</span>}
      </div>
      <div className="game-meta">
        <div className="name">{game.name}</div>
        <div className="sub"><span>{libLabel}</span><span>{humanBytes(game.sizeOnDisk)}</span></div>
      </div>
    </div>
  )
}
