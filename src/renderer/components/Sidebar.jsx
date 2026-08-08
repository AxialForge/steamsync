import React from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'games', label: 'Games', icon: 'games' },
  { id: 'sync', label: 'Sync', icon: 'sync' },
  { id: 'folders', label: 'Folders', icon: 'folder' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'about', label: 'About', icon: 'info' }
]

export function Sidebar() {
  const { view, actions, detection, settings } = useStore()
  const gameCount = (detection.libraries || []).reduce((s, l) => s + l.games.length, 0)
  return (
    <div className="sidebar">
      <div className="nav-head">Navigate</div>
      {NAV.map((n) => {
        const I = Icon[n.icon]
        return (
          <button key={n.id} className={'nav-item' + (view === n.id ? ' active' : '')} onClick={() => actions.setView(n.id)}>
            <I /> <span>{n.label}</span>
            {n.id === 'games' && gameCount > 0 && <span className="count">{gameCount}</span>}
            {n.id === 'folders' && (settings.folderPairs || []).length > 0 && <span className="count">{settings.folderPairs.length}</span>}
          </button>
        )
      })}
      <div className="nav-foot">
        <span className="pill"><Icon.shield size={13} /> NAS is never deleted</span>
      </div>
    </div>
  )
}
