// Where a Chromium for recording lives: CHROMIUM_PATH, else the newest Playwright-cached Chromium on this machine
// (macOS, Linux or Windows). Install one with: npx playwright-core install chromium
'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')

function cacheDirs() {
  const home = os.homedir()
  const dirs = []
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) dirs.push(process.env.PLAYWRIGHT_BROWSERS_PATH)
  if (process.platform === 'darwin') dirs.push(path.join(home, 'Library/Caches/ms-playwright'))
  else if (process.platform === 'win32') dirs.push(path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'ms-playwright'))
  else dirs.push(path.join(process.env.XDG_CACHE_HOME || path.join(home, '.cache'), 'ms-playwright'))
  return dirs
}

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  const names = /^(Chromium|Google Chrome for Testing|chrome|chrome\.exe)$/
  const walk = (dir, depth = 0) => {
    if (depth > 7 || !fs.existsSync(dir)) return null
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isFile() && names.test(e.name)) return p
      if (e.isDirectory()) {
        const f = walk(p, depth + 1)
        if (f) return f
      }
    }
    return null
  }
  for (const cache of cacheDirs()) {
    if (!fs.existsSync(cache)) continue
    const dirs = fs
      .readdirSync(cache)
      .filter((d) => /^chromium-\d+$/.test(d))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    for (const d of dirs) {
      const f = walk(path.join(cache, d))
      if (f) return f
    }
  }
  return null
}

module.exports = { findChromium }
