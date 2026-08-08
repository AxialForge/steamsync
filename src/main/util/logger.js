'use strict'

// Ring-buffered logger. Keeps the last N lines in memory so the renderer can
// pull recent activity, and forwards each line to any registered sink (the
// window, so the live log updates in real time).
const MAX = 500
const buffer = []
let sink = null

function setSink(fn) { sink = fn }

function push(level, message) {
  const entry = { t: Date.now(), level, message: String(message) }
  buffer.push(entry)
  if (buffer.length > MAX) buffer.shift()
  if (sink) { try { sink(entry) } catch { /* renderer gone */ } }
  return entry
}

const log = {
  info: (m) => push('info', m),
  ok: (m) => push('ok', m),
  warn: (m) => push('warn', m),
  error: (m) => push('error', m),
  recent: () => buffer.slice(),
  setSink
}

module.exports = log
