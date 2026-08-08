import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../api.js'

const Ctx = createContext(null)
export function useStore() { return useContext(Ctx) }

function upsert(items, item) {
  if (!items) return [item]
  const i = items.findIndex((x) => x.id === item.id)
  if (i === -1) return [...items, item]
  const copy = items.slice(); copy[i] = item; return copy
}

function applyTheme(t) {
  document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark'
}

export function StoreProvider({ children }) {
  const [info, setInfo] = useState({ version: '', platform: '', updaterActive: false })
  const [settings, setSettings] = useState(null)
  const [detection, setDetection] = useState({ steamPath: null, libraries: [] })
  const [engines, setEngines] = useState(null)
  const [scan, setScan] = useState(null)
  const [sync, setSync] = useState({ state: 'idle', running: false, progress: null, summary: null, verify: null })
  const [log, setLog] = useState([])
  const [updater, setUpdater] = useState(null)
  const [view, setView] = useState('dashboard')

  useEffect(() => {
    (async () => {
      setInfo(await api.getInfo())
      const s = await api.settings.get(); setSettings(s); applyTheme(s.theme)
      setDetection(await api.steam.get())
      setEngines(await api.engines.detect())
      setLog(await api.log.recent())
      const st = await api.sync.state()
      setSync((v) => ({ ...v, state: st.state, running: st.running }))
      if (st.lastScan) setScan(st.lastScan)
    })()
  }, [])

  useEffect(() => {
    const offs = []
    offs.push(api.onEvent((ev) => {
      if (ev.type === 'detection') setDetection(ev.detection)
      else if (ev.type === 'scan') setScan(ev.result)
      else if (ev.type === 'scan-item') setScan((p) => (p ? { ...p, items: upsert(p.items, ev.item) } : p))
      else if (ev.type === 'status') setSync((v) => ({ ...v, state: ev.state, running: ev.running }))
      else if (ev.type === 'progress') setSync((v) => ({ ...v, state: 'syncing', running: true, progress: ev }))
      else if (ev.type === 'done') setSync((v) => ({ ...v, state: 'idle', running: false, progress: null, summary: ev.summary }))
      else if (ev.type === 'verify-progress') setSync((v) => ({ ...v, verify: ev }))
    }))
    offs.push(api.onLog((entry) => setLog((l) => [...l.slice(-499), entry])))
    offs.push(api.onUpdater((s) => setUpdater(s)))
    return () => offs.forEach((f) => f && f())
  }, [])

  const updateSettings = useCallback(async (patch) => {
    const next = await api.settings.set(patch)
    setSettings(next)
    if ('theme' in patch) applyTheme(next.theme)
    return next
  }, [])

  const toggleExcluded = useCallback(async (appid) => {
    setSettings((cur) => {
      const set = new Set(cur.excludedAppids || [])
      set.has(appid) ? set.delete(appid) : set.add(appid)
      const excludedAppids = [...set]
      api.settings.set({ excludedAppids })
      return { ...cur, excludedAppids }
    })
  }, [])

  const setManyExcluded = useCallback(async (appids, excluded) => {
    setSettings((cur) => {
      const set = new Set(cur.excludedAppids || [])
      for (const a of appids) excluded ? set.add(a) : set.delete(a)
      const excludedAppids = [...set]
      api.settings.set({ excludedAppids })
      return { ...cur, excludedAppids }
    })
  }, [])

  const actions = {
    setView,
    updateSettings,
    toggleExcluded,
    setManyExcluded,
    detectSteam: async () => { const d = await api.steam.detect(); setDetection(d); return d },
    detectEngines: async () => { const e = await api.engines.detect(); setEngines(e); return e },
    scanNow: () => api.sync.scan(),
    startSync: (opts) => api.sync.start(opts),
    cancel: () => api.sync.cancel(),
    chooseFolder: (kind) => api.folders.choose(kind),
    openPath: (p) => api.openPath(p),
    reveal: (p) => api.reveal(p),
    checkUpdate: () => api.updater.check(),
    installUpdate: () => api.updater.install(),
    artworkUrl: (appid) => api.artworkUrl(appid)
  }

  const value = { info, settings, detection, engines, scan, sync, log, updater, view, actions }
  return <Ctx.Provider value={value}>{settings ? children : <div className="splash">Loading SteamSync…</div>}</Ctx.Provider>
}
