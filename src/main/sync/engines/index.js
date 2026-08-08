'use strict'

const robocopy = require('./robocopy')
const nodecopy = require('./nodecopy')
const rclone = require('./rclone')

const ENGINES = { robocopy, node: nodecopy, rclone }
const ORDER = ['robocopy', 'node', 'rclone']

function get(engineId) {
  return ENGINES[engineId] || robocopy
}

// Diff/list is always done with robocopy /L on Windows (fast + authoritative),
// regardless of the chosen copy engine.
function scanner() { return robocopy }

async function detectAll(opts = {}) {
  const out = {}
  for (const key of ORDER) {
    try { out[key] = { id: key, label: ENGINES[key].label, ...(await ENGINES[key].detect(opts)) } }
    catch (e) { out[key] = { id: key, label: ENGINES[key].label, available: false, note: e.message } }
  }
  return out
}

module.exports = { get, detectAll, scanner, ORDER, ENGINES }
