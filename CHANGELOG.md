# Changelog

All notable changes to SteamSync are documented here.

## [0.1.1] — 2026-08-08

- Fixed cover art (it never loaded): the `ssart://` scheme put the numeric appid
  in the host, which Chromium parsed as an IPv4 address (`1091500` → `0.16.167.172`).
  The appid now goes in the path (`ssart://img/<appid>`) and bytes are served with
  an explicit image content-type. Also handles the newer nested Steam cache layout
  (`librarycache/<appid>/<hash>/library_capsule.jpg`).
- Live per-item sync status: items now show Syncing… → In sync (or Failed) as the
  run progresses, and the "to sync" total ticks down. Previously the status was a
  stale scan snapshot.
- Added a dedicated About page (links, safety promise, system info, updates).

## [0.1.0] — 2026-08-08

Initial version.

- Auto-detect Steam and all library folders (registry + `libraryfolders.vdf`),
  each mirrored to its own subfolder on the NAS.
- One-way, master-is-local sync (PC → NAS) that **never deletes on the NAS**.
- Scan-first diff preview (files/bytes to copy, and "only on NAS" orphans) via
  `robocopy /L`.
- Three selectable transfer engines: Robocopy (default), Node streams, rclone.
- Change detection by size + modified time, with an optional checksum verify pass.
- Per-game include/exclude with Steam cover-art title cards.
- Manual (Sync Now) or automatic (watch + safety re-scan) modes.
- Arbitrary folder→NAS pairs with the same rules.
- Dashboard with live speed/ETA, Dark/Light themes, tray, and GitHub auto-updater.
