'use strict'

const path = require('node:path')
const fsp = require('node:fs/promises')

// Guardrails that run before a sync.

// Normalize a path for comparison: absolute, lowercased (Windows is
// case-insensitive), forward/back-slashes unified, with a trailing separator so
// "C:\a\b" never prefix-matches "C:\a\bc".
function norm(p) {
  return path.win32.resolve(p).toLowerCase().replace(/[\\/]+$/, '') + '\\'
}

// True if either path contains the other (or they're equal). Syncing overlapping
// source/dest would recurse the copy into itself.
function pathsOverlap(a, b) {
  if (!a || !b) return false
  const A = norm(a)
  const B = norm(b)
  return A === B || A.startsWith(B) || B.startsWith(A)
}

// Free bytes on the volume holding `p`, or null if it can't be determined
// (common over some SMB mounts — callers must treat null as "unknown").
async function freeSpace(p) {
  try {
    const s = await fsp.statfs(p)
    return s.bavail * s.bsize
  } catch {
    return null
  }
}

module.exports = { pathsOverlap, freeSpace, norm }
