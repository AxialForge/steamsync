'use strict'
// Generates build/icon.ico (PNG-in-ICO) and build/icon.png — no image libs.
// Design: accent-blue rounded square + white sync ring + white "electron" dot,
// echoing the in-app logo. Supersampled 4x for anti-aliasing.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const SIZE = 256
const SS = 4
const W = SIZE * SS

const ACCENT = [59, 116, 240]
const WHITE = [255, 255, 255]

function sdfRoundRect(x, y, w, h, r) {
  const dx = Math.max(r - x, x - (w - 1 - r), 0)
  const dy = Math.max(r - y, y - (h - 1 - r), 0)
  return Math.sqrt(dx * dx + dy * dy) - r // <=0 inside
}

// Render supersampled RGBA
const big = Buffer.alloc(W * W * 4)
const cx = W / 2, cy = W / 2
const outer = W * 0.30, inner = W * 0.205
const dotR = W * 0.085, dotX = W * 0.685, dotY = W * 0.325
for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    let r = 0, g = 0, b = 0, a = 0
    if (sdfRoundRect(x, y, W, W, W * 0.20) <= 0) { r = ACCENT[0]; g = ACCENT[1]; b = ACCENT[2]; a = 255 }
    const d = Math.hypot(x - cx, y - cy)
    const ring = d <= outer && d >= inner
    // leave a wedge gap in the ring (top-right) so it reads like a sync arrow
    const ang = Math.atan2(y - cy, x - cx)
    const inGap = ang > -0.9 && ang < -0.15
    if (ring && !inGap) { r = WHITE[0]; g = WHITE[1]; b = WHITE[2]; a = 255 }
    if (Math.hypot(x - dotX, y - dotY) <= dotR) { r = WHITE[0]; g = WHITE[1]; b = WHITE[2]; a = 255 }
    big[i] = r; big[i + 1] = g; big[i + 2] = b; big[i + 3] = a
  }
}

// Downsample SSxSS box average -> SIZE
const small = Buffer.alloc(SIZE * SIZE * 4)
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const j = (((y * SS + sy) * W) + (x * SS + sx)) * 4
      r += big[j]; g += big[j + 1]; b += big[j + 2]; a += big[j + 3]
    }
    const n = SS * SS
    const o = (y * SIZE + x) * 4
    small[o] = Math.round(r / n); small[o + 1] = Math.round(g / n); small[o + 2] = Math.round(b / n); small[o + 3] = Math.round(a / n)
  }
}

// --- PNG encode ---
function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function encodePng(rgba, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const png = encodePng(small, SIZE)
const buildDir = path.join(__dirname, '..', 'build')
fs.mkdirSync(buildDir, { recursive: true })
fs.writeFileSync(path.join(buildDir, 'icon.png'), png)

// --- ICO wrap (single PNG frame) ---
const dir = Buffer.alloc(6)
dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4)
const entry = Buffer.alloc(16)
entry[0] = SIZE >= 256 ? 0 : SIZE // width (0 = 256)
entry[1] = SIZE >= 256 ? 0 : SIZE // height
entry[2] = 0; entry[3] = 0
entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(6 + 16, 12)
fs.writeFileSync(path.join(buildDir, 'icon.ico'), Buffer.concat([dir, entry, png]))

console.log('wrote build/icon.png and build/icon.ico (' + png.length + ' bytes PNG)')
