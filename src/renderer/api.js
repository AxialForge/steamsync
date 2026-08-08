// Thin access to the preload bridge (window.api). Falls back to a small stub so
// the UI still renders when opened in a plain browser (design/preview only) —
// no real syncing happens there.
const real = typeof window !== 'undefined' ? window.api : null
export const hasApi = !!real

const noop = () => () => {}
const demoGames = [
  { appid: '1091500', name: 'Cyberpunk 2077', installdir: 'Cyberpunk 2077', sizeOnDisk: 75 * 2 ** 30 },
  { appid: '1245620', name: 'ELDEN RING', installdir: 'ELDEN RING', sizeOnDisk: 60 * 2 ** 30 },
  { appid: '427520', name: 'Factorio', installdir: 'Factorio', sizeOnDisk: 3 * 2 ** 30 }
]

const stub = {
  getInfo: async () => ({ version: '0.1.0-preview', platform: 'browser', updaterActive: false }),
  settings: {
    get: async () => ({
      theme: 'dark', nasRoot: '', engine: 'robocopy', threads: 16, verify: false,
      bandwidthKbps: null, rclonePath: null, autoSync: false, safetyRescanMinutes: 30,
      excludedAppids: [], folderPairs: [], minimizeToTray: true, launchOnLogin: false,
      checkUpdatesOnLaunch: true, showArtwork: true
    }),
    set: async (p) => ({ ...(await stub.settings.get()), ...p })
  },
  engines: {
    detect: async () => ({
      robocopy: { id: 'robocopy', label: 'Robocopy (Windows, multithreaded)', available: true, note: 'Built into Windows.' },
      node: { id: 'node', label: 'Node.js streams (built-in)', available: true, note: 'Always available.' },
      rclone: { id: 'rclone', label: 'rclone (advanced, if installed)', available: false, note: 'Not found.' }
    })
  },
  steam: {
    get: async () => ({ steamPath: 'C:/Program Files (x86)/Steam', libraries: [{ root: 'C:/…/Steam', steamapps: 'C:/…/steamapps', label: 'C-Steam', games: demoGames }] }),
    detect: async () => stub.steam.get()
  },
  sync: { scan: async () => ({ items: [], totals: { bytesToCopy: 0, filesToCopy: 0, orphanCount: 0, itemCount: 0 } }), start: async () => ({ started: true }), cancel: async () => true, state: async () => ({ state: 'idle', running: false, lastScan: null }) },
  folders: { choose: async () => null },
  openPath: async () => {}, reveal: async () => {},
  log: { recent: async () => [] },
  updater: { check: async () => {}, install: async () => {} },
  artworkUrl: (appid) => `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900.jpg`,
  onEvent: noop, onLog: noop, onUpdater: noop
}

export const api = real || stub
