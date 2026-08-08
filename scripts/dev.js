// Dev launcher: start the Vite dev server for the renderer, wait for its port,
// then launch Electron pointed at it. No extra deps (no concurrently/wait-on).
// Kills Vite when Electron exits.
const { spawn } = require('node:child_process')
const net = require('node:net')

const PORT = 5173
const HOST = '127.0.0.1'
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

function waitForPort(port, host, timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const sock = net.connect(port, host)
      sock.once('connect', () => { sock.destroy(); resolve() })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() - start > timeoutMs) reject(new Error('Vite dev server did not start in time'))
        else setTimeout(tick, 250)
      })
    }
    tick()
  })
}

const vite = spawn(npx, ['vite'], { stdio: 'inherit', shell: process.platform === 'win32' })

let electron
async function main() {
  await waitForPort(PORT, HOST)
  const env = { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${PORT}`, NODE_ENV: 'development' }
  electron = spawn(npx, ['electron', '.'], { stdio: 'inherit', shell: process.platform === 'win32', env })
  electron.on('exit', (code) => { vite.kill(); process.exit(code ?? 0) })
}

main().catch((err) => { console.error(err); vite.kill(); process.exit(1) })

process.on('SIGINT', () => { if (electron) electron.kill(); vite.kill(); process.exit(0) })
