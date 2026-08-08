# SteamSync — project guide for Claude Code

SteamSync is a **one-way, master-is-local backup** app (Electron + React). It
mirrors your Steam library (and any folder) from this PC to a NAS. The PC is
authoritative; the NAS is a mirror the app **never deletes from**. Windows-first:
the default transfer engine is **Robocopy**.

## Non-negotiables (don't regress these)
- **The app must never delete or remove files on the destination (NAS).** There
  is no delete code path, by design. Robocopy runs **without `/MIR` or `/PURGE`**.
  Files that exist only on the NAS ("orphans") are reported, never touched. This
  is the entire safety promise — do not add any destination-pruning behaviour
  without an explicit, separately-guarded, user-confirmed mode.
- **Local is the master; sync is one-way (PC → NAS).** `/XO` keeps the newer
  local file authoritative. Never sync NAS → PC.
- **No native Node modules.** This machine hits a Node 24 / ClangCL native-build
  trap, so every dependency must be pure-JS or a prebuilt binary. Robocopy (a
  Windows system binary) and `chokidar`/`electron-updater` (pure JS) satisfy this.
  Don't add anything that compiles on `npm install`.
- **Ships as a Windows `.exe`** via electron-builder (NSIS + portable).

## Commands
```bash
npm install
npm run dev            # Vite (renderer) + Electron (scripts/dev.js waits for the port)
npm run build:win      # NSIS installer + portable .exe -> release/
npm run build:portable # single-file portable .exe
npm test               # node --test (unit tests for vdf/diff parsing) — when present
```

## Architecture
Two layers, JDot-style:
- **Main process** (`src/main/`, CommonJS): Electron entry, IPC, Steam detection,
  the sync engines, the watcher, settings, updater. All the real work.
- **Renderer** (`src/renderer/`, React built by Vite): the UI. Talks to main only
  through the `window.api` bridge in `preload.js`. Bundled to `dist/renderer/`.

### Directory map
```
src/
  main/
    main.js              Electron entry: window, tray, ssart:// art protocol, wiring
    preload.js           contextBridge -> window.api (the ONLY renderer global)
    ipc.js               All ipcMain handlers
    settings.js          userData/settings.json (defaults + get/set)
    updater.js           electron-updater (GitHub Releases); lazy-required
    util/bytes.js        humanBytes / humanRate / humanDuration
    util/logger.js       ring buffer + live sink to the renderer
    steam/
      vdf.js             Tiny Valve KeyValues parser (libraryfolders.vdf, *.acf)
      detect.js          Registry SteamPath + libraryfolders.vdf -> libraries
      manifests.js       appmanifest_*.acf -> installed games
      artwork.js         Cover art: our cache -> Steam cache -> CDN (served via ssart://)
    sync/
      scanner.js         Diff preview (robocopy /L) + optional checksum verify
      orchestrator.js    Builds items from settings+detection; scan/start/cancel; emits events
      watcher.js         Auto mode: watch appmanifest_*.acf + folder sources; debounce; safety timer
      engines/
        index.js         Engine registry + detectAll()
        robocopy.js      DEFAULT. /MT copy, /L diff. Never /MIR /PURGE.
        nodecopy.js      Pure-JS streamed copy, precise progress, preserves mtime
        rclone.js        Optional. `rclone copy` (NOT sync) so it never deletes.
  renderer/
    index.html main.jsx theme.css format.js api.js
    state/store.jsx      React context: settings/detection/scan/sync/log/updater + actions
    components/          App, Sidebar, Dashboard, Games(+GameCard), Sync, Folders, Settings, Progress, LogPanel, Icons
build/icon.ico           App icon (add before release; default Electron icon until then)
.github/workflows/build.yml  Windows CI: tag v* -> build .exe -> attach to Release
```

### How a sync works
1. `orchestrator.buildItems()` turns detected libraries + `settings.folderPairs`
   into concrete `{ source, dest, extraFiles }` items. Each included game →
   `steamapps/common/<installdir>` **plus** its `appmanifest_<appid>.acf` (so the
   backup is restorable). Excluded appids are skipped. Steam items require
   `settings.nasRoot`; folder pairs carry their own dest.
2. `scanner.scanItems()` runs **`robocopy /L /X`** per item to compute, fast and
   authoritatively: bytes/files to copy, and orphan (dest-only) counts/paths.
3. The chosen engine copies each item (progress events → renderer). Robocopy
   parses per-file size lines for live progress and reconciles to the scan total
   at each item boundary.
4. If `verify` is on, `scanner.verifyItems()` hashes every file on both sides.

## Settings (`userData/settings.json`)
`theme` (dark|light), `nasRoot`, `engine` (robocopy|node|rclone), `threads`,
`verify`, `bandwidthKbps` (**KB/s**, null = unlimited), `rclonePath`, `autoSync`,
`safetyRescanMinutes`, `excludedAppids[]`, `folderPairs[]`, `minimizeToTray`,
`launchOnLogin`, `checkUpdatesOnLaunch`, `showArtwork`.

## Themes
Two: **dark** (default) and **light**, driven by CSS custom properties in
`[data-theme="…"]` at the top of `theme.css`. Accent is the AxialForge royal blue
(`#3b74f0` dark / `#1e50e5` light), same tokens as JDot Utilities.

## Gotchas / constraints
- **`bandwidthKbps` is kilobytes per second, not kilobits.** All three engines
  interpret it as KB/s (node `*1024`; robocopy `/IPG = 64000/KBps`; rclone
  `--bwlimit ${n}k`). Settings shows it as MB/s and stores `MB*1024`. Keep them aligned.
- **Robocopy summary parsing is English-label based** (`Files :` / `Bytes :`).
  On a non-English Windows the summary won't parse; the code falls back to the
  pre-scan estimate for progress. Diff/orphan *counts* also come from the summary,
  so localized systems degrade to estimates — acceptable, but know it.
- **Robocopy exit code < 8 is success** (0 none, 1 copied, 2 extras, 3 both…).
  `>= 8` is a real error. Never treat exit 1/2/3 as failure.
- **`robocopy /XO` requires timestamps to be preserved** or every run recopies
  everything. Robocopy preserves them natively; the **Node engine must call
  `fs.utimes`** after each copy (it does) so the next size+mtime diff sees files
  as identical.
- **rclone uses `copy`, never `sync`.** `rclone sync` deletes on the destination;
  `rclone copy` does not. Do not "upgrade" it to sync.
- **Cover art is served over a custom `ssart://` scheme**, registered privileged
  *before* `app.ready` and handled after. `<img src="ssart://<appid>">`. This
  avoids `file://`-origin blocking that would otherwise break images under the
  Vite dev origin. Don't switch images back to `file://`.
- **The preload bridge (`window.api`) is the only renderer global.** Don't add
  others; don't reach into Node from the renderer.
- **`electron-updater` is required lazily** inside `updater.configure()` — it reads
  `app.getVersion()` at import, so requiring it at module scope breaks plain-node
  tests. It also no-ops when the app isn't packaged (`app.isPackaged` guard).
- **artifactName is space-free** (`electron-builder.yml`). A space desyncs the
  on-disk file, the URL in `latest.yml`, and the uploaded asset, 404-ing the updater.
- **Watcher ignores `unlink` events on purpose.** A local deletion must never
  propagate to the NAS. It watches `appmanifest_*.acf` (cheap, precise Steam-update
  signal) + folder-pair sources, debounced 5s, plus a safety re-scan timer.
- **Auto-sync needs the app alive** — `minimizeToTray` keeps it running when the
  window is closed. Without tray, auto only runs while the window is open.

## Roadmap (unbuilt)
- Per-file (intra-file) robocopy progress by parsing the streamed `%`.
- A guarded, explicit "Prune orphans" screen (typed confirmation) for when the
  user *chooses* to clean the NAS — still never automatic.
- Restore flow (NAS → PC) as a deliberate, separate, confirmed action.
- `build/icon.ico` + `docs/` GitHub Pages landing page.
- Non-Steam launcher detection (Epic, GOG) reusing the folder-pair engine.
