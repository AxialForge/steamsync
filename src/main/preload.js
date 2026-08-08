'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// The one bridge to main. Keep this the ONLY global the renderer sees.
function sub(channel) {
  return (cb) => {
    const listener = (_e, payload) => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('api', {
  getInfo: () => ipcRenderer.invoke('app:getInfo'),

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },

  engines: { detect: () => ipcRenderer.invoke('engines:detect') },

  steam: {
    get: () => ipcRenderer.invoke('steam:get'),
    detect: () => ipcRenderer.invoke('steam:detect')
  },

  sync: {
    scan: () => ipcRenderer.invoke('sync:scan'),
    start: (opts) => ipcRenderer.invoke('sync:start', opts),
    cancel: () => ipcRenderer.invoke('sync:cancel'),
    state: () => ipcRenderer.invoke('sync:state')
  },

  folders: { choose: (kind) => ipcRenderer.invoke('folders:choose', kind) },

  openPath: (p) => ipcRenderer.invoke('path:open', p),
  reveal: (p) => ipcRenderer.invoke('path:reveal', p),

  log: { recent: () => ipcRenderer.invoke('log:recent') },

  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install')
  },

  // cover-art URL for a Steam appid
  artworkUrl: (appid) => `ssart://${appid}`,

  onEvent: sub('event'),
  onLog: sub('log'),
  onUpdater: sub('updater')
})
