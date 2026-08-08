# SteamSync

A one-way backup app for your Steam library (and any folder) to a NAS.

**Your PC is the master. The NAS is a mirror that SteamSync never deletes from.**
When Steam installs or updates a game, SteamSync copies the changes to the NAS.
If you delete a game locally, the NAS copy stays put — deletions on the NAS are
always your decision, made by you, never by this app.

Built with Electron + React. Windows-first (uses Robocopy for maximum speed).

## Features

- **Auto-detects Steam** and every library folder (registry + `libraryfolders.vdf`).
  Each library mirrors to its own subfolder on the NAS (e.g. `…\C-Steam`, `…\F-SteamLibrary`).
- **Scan first, then sync** — see exactly what differs (and what's *only* on the
  NAS) before anything copies.
- **Never deletes on the destination.** No `/MIR`, no `/PURGE`, no delete code path.
- **Fast.** Robocopy multithreaded (`/MT`) by default; Node streams and rclone are
  selectable alternatives.
- **Change detection** by size + modified time, with an optional **checksum verify** pass.
- **Per-game include / exclude** with cover-art title cards (Steam cache → CDN fallback).
- **Manual or automatic** — press *Sync Now*, or turn on auto (watches for Steam
  updates + a periodic safety re-scan).
- **Arbitrary folder pairs** — back up any `source → NAS` folder with the same rules.
- **Dashboard** with live speed/ETA, two themes (Dark / Light), tray, and a GitHub-based auto-updater.

## Requirements

- Windows 10/11 (Robocopy engine). The Node engine works cross-platform.
- Node 20+ to build.

## Develop

```bash
npm install
npm run dev
```

`npm run dev` starts Vite (renderer) and launches Electron against it.

## Build

```bash
npm run build:win        # NSIS installer + portable .exe -> release/
npm run build:portable   # single-file portable .exe
```

## Release

Bump the version in `package.json`, update `CHANGELOG.md`, commit, then:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

GitHub Actions builds the Windows artifacts and attaches them (plus `latest.yml`
for the updater) to a Release.

> Add `build/icon.ico` before your first public release — until then the default
> Electron icon is used.

## License

MIT © AxialForge
