import React from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'

const REPO = 'https://github.com/AxialForge/steamsync'

export function AboutView() {
  const { info, detection, engines, updater, actions } = useStore()
  const engineList = engines ? Object.values(engines) : []
  const libs = detection.libraries || []
  const totalGames = libs.reduce((s, l) => s + l.games.length, 0)
  const link = (u) => (e) => { e.preventDefault(); actions.openExternal(u) }

  return (
    <div>
      <div className="page-head"><div className="grow"><h1>About</h1><div className="sub">What SteamSync is, and how it keeps your backup safe.</div></div></div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ flex: '0 0 auto', filter: 'drop-shadow(0 6px 16px rgba(0,0,0,.4))' }}><Icon.logo size={72} /></div>
        <div className="grow">
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '.01em' }}>SteamSync</div>
          <div className="muted" style={{ margin: '4px 0 10px' }}>v{info.version} · one-way backup for your Steam library and any folder</div>
          <div className="row">
            <button className="btn" onClick={link(REPO)}><Icon.github size={15} /> GitHub</button>
            <button className="btn" onClick={link(REPO + '/releases')}><Icon.download size={15} /> Releases</button>
            <button className="btn" onClick={link(REPO + '/issues/new')}><Icon.external size={15} /> Report an issue</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>The promise</h2>
        <div className="banner accent" style={{ marginBottom: 0 }}>
          <Icon.shield size={20} />
          <div className="grow">
            <b>Your PC is the master; the NAS is never deleted by this app.</b><br />
            <span className="muted" style={{ fontSize: 12.5 }}>Files copy one way (PC → NAS) when they're new or changed. There is no code path that removes files on the NAS — orphaned files are only ever reported, so a deletion on your PC can never wipe your backup.</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>On this system</h2>
        <div className="setting-row"><div className="txt"><div className="t">Steam</div><div className="d mono">{detection.steamPath || 'not detected'}</div></div></div>
        <div className="setting-row"><div className="txt"><div className="t">Libraries</div><div className="d">{libs.length ? libs.map((l) => `${l.label} (${l.games.length})`).join(' · ') : '—'} — {totalGames} games</div></div></div>
        <div className="setting-row"><div className="txt"><div className="t">Transfer engines</div><div className="d">{engineList.map((e) => `${e.label.split(' ')[0]}: ${e.available ? 'available' : 'not found'}`).join(' · ')}</div></div></div>
        <div className="setting-row">
          <div className="txt"><div className="t">Updates</div><div className="d">{updater ? updaterText(updater) : (info.updaterActive ? 'Idle' : 'Installed app only')}</div></div>
          <button className="btn" onClick={actions.checkUpdate}><Icon.refresh size={15} /> Check now</button>
        </div>
      </div>

      <div className="card">
        <h2>Credits</h2>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>
          Built by <b>AxialForge</b> with Electron + React. Fast transfers courtesy of Windows Robocopy.
          Game artwork © their respective publishers, served from Steam's cache/CDN. Released under the MIT license.
        </div>
      </div>
    </div>
  )
}

function updaterText(u) {
  switch (u.state) {
    case 'checking': return 'Checking…'
    case 'up-to-date': return 'Up to date'
    case 'available': return `Downloading v${u.version}…`
    case 'downloading': return `Downloading ${u.percent}%…`
    case 'downloaded': return `v${u.version} ready — restart to install`
    case 'error': return u.message || 'Update error'
    case 'dev': return u.message
    default: return 'Idle'
  }
}
