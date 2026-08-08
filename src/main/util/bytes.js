'use strict'

// Human-readable byte formatting, shared by main + surfaced to the renderer.
function humanBytes(n) {
  if (n == null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  let v = abs
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  const decimals = v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2
  return `${(n < 0 ? -v : v).toFixed(decimals)} ${units[i]}`
}

function humanRate(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '—'
  return `${humanBytes(bytesPerSec)}/s`
}

function humanDuration(ms) {
  if (ms == null || ms < 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m}m ${rem}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

module.exports = { humanBytes, humanRate, humanDuration }
