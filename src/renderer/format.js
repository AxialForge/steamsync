// Small formatting helpers for the renderer (mirrors src/main/util/bytes.js).
export function humanBytes(n) {
  if (n == null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0, v = abs
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  const d = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2
  return `${(n < 0 ? -v : v).toFixed(d)} ${units[i]}`
}

export function humanRate(bps) {
  if (!bps || bps <= 0) return '—'
  return `${humanBytes(bps)}/s`
}

export function humanDuration(ms) {
  if (ms == null || ms < 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function eta(bytesDone, bytesTotal, bps) {
  if (!bps || bps <= 0 || !bytesTotal) return '—'
  return humanDuration(((bytesTotal - bytesDone) / bps) * 1000)
}

export function timeAgo(ts) {
  if (!ts) return 'never'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
