import React from 'react'
import { useStore } from '../state/store.jsx'
import { Icon } from './Icons.jsx'

function Toggle({ checked, onChange }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  )
}

function Row({ title, desc, children }) {
  return (
    <div className="setting-row">
      <div className="txt"><div className="t">{title}</div>{desc && <div className="d">{desc}</div>}</div>
      {children}
    </div>
  )
}

export function SettingsView() {
  const { settings, engines, detection, info, updater, actions } = useStore()
  const s = settings
  const set = actions.updateSettings

  const chooseNas = async () => { const p = await actions.chooseFolder('nas'); if (p) set({ nasRoot: p }) }
  const engineList = engines ? Object.values(engines) : []
  const rcloneAvail = engines && engines.rclone && engines.rclone.available

  return (
    <div>
      <div className="page-head"><div className="grow"><h1>Settings</h1><div className="sub">Everything is saved automatically.</div></div></div>

      {/* NAS & backup */}
      <div className="card">
        <h2>NAS backup folder</h2>
        <div className="field">
          <div className="desc">The base folder on your NAS. Each Steam library is mirrored into its own subfolder here.</div>
          <div className="inline"><input className="input path" placeholder="\\NAS\Backups\Steam" value={s.nasRoot} readOnly /><button className="btn" onClick={chooseNas}>Browse</button></div>
        </div>
        {s.nasRoot && detection.libraries && detection.libraries.length > 0 && (
          <div className="list" style={{ marginTop: 4 }}>
            {detection.libraries.map((l) => (
              <div className="list-row" key={l.label}>
                <Icon.drive size={16} />
                <div className="grow"><div className="title">{l.label} <span className="muted">· {l.games.length} games</span></div>
                  <div className="path mono">{l.steamapps} → {s.nasRoot}\{l.label}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transfer engine */}
      <div className="card">
        <h2>Transfer engine & speed</h2>
        <div className="field">
          <label>Engine</label>
          <div className="desc">How files are copied. Robocopy is fastest on Windows and needs no install.</div>
          <select className="input" value={s.engine} onChange={(e) => set({ engine: e.target.value })}>
            {engineList.map((e) => <option key={e.id} value={e.id} disabled={e.available === false}>{e.label}{e.available === false ? ' — not detected' : ''}</option>)}
          </select>
          {engines && engines[s.engine] && <div className="d muted" style={{ fontSize: 12, marginTop: 6 }}>{engines[s.engine].note}</div>}
          {s.engine === 'rclone' && !rcloneAvail && (
            <div className="inline" style={{ marginTop: 8 }}>
              <input className="input path" placeholder="Path to rclone.exe" value={s.rclonePath || ''} onChange={(e) => set({ rclonePath: e.target.value || null })} />
              <button className="btn" onClick={() => actions.detectEngines()}>Re-check</button>
            </div>
          )}
        </div>
        <Row title={`Parallel threads: ${s.threads}`} desc="More threads = faster on many small files. Robocopy /MT.">
          <input type="range" min="1" max="64" value={s.threads} style={{ width: 200 }} onChange={(e) => set({ threads: +e.target.value })} />
        </Row>
        <Row title="Verify with checksums" desc="After copying, hash every file on both sides to confirm. Thorough but slow.">
          <Toggle checked={s.verify} onChange={(v) => set({ verify: v })} />
        </Row>
        <Row title="Limit speed" desc="Throttle transfers so gaming/streaming isn't affected. Off = full speed.">
          <div className="inline">
            {s.bandwidthKbps != null && <input className="input" type="number" min="1" style={{ width: 90 }} value={Math.max(1, Math.round(s.bandwidthKbps / 1024))} onChange={(e) => set({ bandwidthKbps: Math.max(1, +e.target.value) * 1024 })} />}
            {s.bandwidthKbps != null && <span className="muted" style={{ fontSize: 12 }}>MB/s</span>}
            <Toggle checked={s.bandwidthKbps != null} onChange={(v) => set({ bandwidthKbps: v ? 50 * 1024 : null })} />
          </div>
        </Row>
      </div>

      {/* Automation */}
      <div className="card">
        <h2>Automation</h2>
        <Row title="Auto-sync" desc="Watch for Steam updates and sync automatically, with a periodic safety re-scan. Off = you press Sync Now.">
          <Toggle checked={s.autoSync} onChange={(v) => set({ autoSync: v })} />
        </Row>
        {s.autoSync && (
          <Row title={`Safety re-scan: every ${s.safetyRescanMinutes} min`} desc="A full sync on a timer as a backstop, in case a live change is missed.">
            <input type="range" min="5" max="180" step="5" value={s.safetyRescanMinutes} style={{ width: 200 }} onChange={(e) => set({ safetyRescanMinutes: +e.target.value })} />
          </Row>
        )}
      </div>

      {/* App */}
      <div className="card">
        <h2>Application</h2>
        <Row title="Theme" desc="Dark or Light.">
          <div className="row">
            <button className={'btn' + (s.theme !== 'light' ? ' primary' : '')} onClick={() => set({ theme: 'dark' })}>Dark</button>
            <button className={'btn' + (s.theme === 'light' ? ' primary' : '')} onClick={() => set({ theme: 'light' })}>Light</button>
          </div>
        </Row>
        <Row title="Show game artwork" desc="Title cards from Steam's cache (falls back to the CDN).">
          <Toggle checked={s.showArtwork} onChange={(v) => set({ showArtwork: v })} />
        </Row>
        <Row title="Minimize to tray" desc="Closing the window keeps SteamSync running in the tray (needed for auto-sync).">
          <Toggle checked={s.minimizeToTray} onChange={(v) => set({ minimizeToTray: v })} />
        </Row>
        <Row title="Launch on Windows startup" desc="Start SteamSync automatically when you log in.">
          <Toggle checked={s.launchOnLogin} onChange={(v) => set({ launchOnLogin: v })} />
        </Row>
      </div>

      {/* Updates */}
      <div className="card">
        <h2>Updates</h2>
        <Row title="Check for updates on launch" desc="From GitHub Releases (AxialForge/steamsync).">
          <Toggle checked={s.checkUpdatesOnLaunch} onChange={(v) => set({ checkUpdatesOnLaunch: v })} />
        </Row>
        <div className="row" style={{ alignItems: 'center', marginTop: 12 }}>
          <button className="btn" onClick={actions.checkUpdate}><Icon.download size={15} /> Check now</button>
          <UpdaterStatus updater={updater} info={info} onInstall={actions.installUpdate} />
        </div>
      </div>

    </div>
  )
}

function UpdaterStatus({ updater, info, onInstall }) {
  if (!info.updaterActive) return <span className="muted" style={{ fontSize: 12.5 }}>Updates apply to the installed app only.</span>
  if (!updater) return <span className="muted" style={{ fontSize: 12.5 }}>Idle.</span>
  const st = updater.state
  if (st === 'checking') return <span className="pill accent">Checking…</span>
  if (st === 'up-to-date') return <span className="pill ok">Up to date</span>
  if (st === 'available') return <span className="pill accent">Downloading v{updater.version}…</span>
  if (st === 'downloading') return <span className="pill accent">Downloading {updater.percent}%…</span>
  if (st === 'downloaded') return <button className="btn primary" onClick={onInstall}><Icon.download size={15} /> Restart & install v{updater.version}</button>
  if (st === 'error') return <span className="pill err">{updater.message || 'Update error'}</span>
  if (st === 'dev') return <span className="muted" style={{ fontSize: 12.5 }}>{updater.message}</span>
  return null
}
