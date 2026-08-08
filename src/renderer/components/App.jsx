import React from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'
import { Sidebar } from './Sidebar.jsx'
import { Dashboard } from './Dashboard.jsx'
import { GamesView } from './GamesView.jsx'
import { SyncView } from './SyncView.jsx'
import { FoldersView } from './FoldersView.jsx'
import { SettingsView } from './SettingsView.jsx'
import { AboutView } from './AboutView.jsx'

function SyncPill() {
  const { sync } = useStore()
  if (sync.running || sync.state === 'syncing') return <span className="pill accent"><span className="dot accent" />Syncing…</span>
  if (sync.state === 'scanning') return <span className="pill accent"><span className="dot accent" />Scanning…</span>
  if (sync.state === 'verifying') return <span className="pill accent"><span className="dot accent" />Verifying…</span>
  return <span className="pill ok"><span className="dot ok" />Idle</span>
}

export function App() {
  const { view, info } = useStore()
  return (
    <div className="app">
      <div className="topbar">
        <div className="brand"><Icon.logo size={24} /> SteamSync</div>
        <span className="verchip">v{info.version || '0.1.0'}</span>
        <div className="spacer" />
        <SyncPill />
      </div>
      <div className="shell">
        <Sidebar />
        <div className="content">
          {view === 'dashboard' && <Dashboard />}
          {view === 'games' && <GamesView />}
          {view === 'sync' && <SyncView />}
          {view === 'folders' && <FoldersView />}
          {view === 'settings' && <SettingsView />}
          {view === 'about' && <AboutView />}
        </div>
      </div>
    </div>
  )
}
