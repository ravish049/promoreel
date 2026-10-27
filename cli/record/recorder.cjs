// A phone-size screen recorder for any web app (promoreel record runs it from a flow file; a .flow.mjs can use it directly).
//
// It drives Playwright's Chromium at an iPhone viewport (390×844 CSS px, deviceScaleFactor 3) and records each step as
// its own clip from a DevTools capture loop at DEVICE pixels (1170×2532, ~30 frames a second), much sharper than
// Playwright's recordVideo and than the headless screencast (which stops at 390×844). Frames are timed by when they were
// taken and assembled with ffmpeg into a constant-frame-rate H.264 clip.
//
// Beside each clip it writes <clip>.json: its size, length, and every tap / focus the flow made, with the element's box
// in CSS px and the time in ms from the start of the clip. The Remotion template reads that file to draw tap ripples,
// zoom onto controls and glow rows, so nothing is placed by hand.
'use strict'
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { findChromium } = require('./chromium.cjs')

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** A human-ish pause: the base, give or take 15 %. */
const human = (ms) => sleep(Math.round(ms * (0.85 + Math.random() * 0.3)))

/**
 * @param {object} o
 * @param {string} o.base        the app's base URL; relative paths in go() resolve against it
 * @param {string} o.outDir      where <clip>.mp4 and <clip>.json go
 * @param {object} [o.localStorage]  keys to set before every page load (e.g. a theme or a dismissed cookie banner)
 * @param {(msg: string) => void} [o.log]
 */
async function createRecorder({ base, outDir, width = 390, height = 844, dpr = 3, fps = 30, colorScheme = 'light', timezoneId, locale = 'en-US', geolocation = null, localStorage: storage = null, headless = true, log = () => {} }) {
  const { chromium } = require('playwright-core')
  const executablePath = findChromium()
  if (!executablePath) throw new Error('No Playwright Chromium found. Set CHROMIUM_PATH, or run: npx playwright-core install chromium')
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch({ headless, executablePath })
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE_UA,
    colorScheme,
    ...(timezoneId ? { timezoneId } : {}),
    locale,
    // a phone standing at a place: { latitude, longitude, accuracy } — the browser's location answers with it, permission granted
    ...(geolocation ? { geolocation, permissions: ['geolocation'] } : {}),
  })
  if (storage && Object.keys(storage).length) {
    await ctx.addInitScript((kv) => {
      try {
        for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, String(v))
      } catch {
        /* storage blocked */
      }
    }, storage)
  }
  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)
  const cdp = await ctx.newCDPSession(page)
  const B = base.replace(/\/$/, '')

  const rec = {
    page,
    browser,
    base: B,
    sleep,
    human,
    async go(url, settle = 1200) {
      await page.goto(url.startsWith('http') ? url : B + url, { waitUntil: 'load', timeout: 90000 })
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await sleep(settle)
    },
    /** Hide parts of the screen while recording (CSS selectors), e.g. a floating button that covers the step's own button. */
    async hide(selectors) {
      if (!selectors.length) return
      const css = selectors.map((s) => `${s}{visibility:hidden!important}`).join('\n')
      await ctx.addInitScript((c) => {
        const add = () => { const st = document.createElement('style'); st.dataset.recorder = 'hide'; st.textContent = c; document.head.appendChild(st) }
        if (document.head) add(); else document.addEventListener('DOMContentLoaded', add)
      }, css)
      await page.addStyleTag({ content: css }).catch(() => {})
    },
    async shot(name) {
      await page.screenshot({ path: path.join(outDir, `${name}.png`) })
    },
    /**
     * Record one clip. `fn(c)` drives the page; use c.tap / c.type / c.focus / c.scrollTo / c.pause so the clip's JSON knows
     * where each action happened. Returns the clip's manifest.
     */
    async clip(name, fn, { leadMs = 500, tailMs = 900 } = {}) {
      const frames = []
      const events = []
      // The headless screencast only hands over CSS-size frames (390×844), so frames are taken by a capture loop instead:
      // Page.captureScreenshot with clip.scale = dpr renders at device pixels (1170×2532), ~30 frames a second. The clip is
      // in document coordinates, so each frame first reads where the visual viewport is.
      let recording = true
      const t0 = Date.now()
      const loop = (async () => {
        while (recording) {
          const t = Date.now()
          const m = await cdp.send('Page.getLayoutMetrics').catch(() => null)
          const vv = m && m.cssVisualViewport
          const shot = await cdp
            .send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, clip: { x: vv ? vv.pageX : 0, y: vv ? vv.pageY : 0, width, height, scale: dpr } })
            .catch(() => null)
          if (shot) frames.push({ t: (t + Date.now()) / 2, data: shot.data })
        }
      })()
      const at = () => Date.now() - t0
      // labels are how a reel spec finds a moment, so each is unique within a clip: a repeat becomes "label-2", "label-3"
      const seen = new Map()
      const uniq = (label) => {
        const n = (seen.get(label) || 0) + 1
        seen.set(label, n)
        return n === 1 ? label : `${label}-${n}`
      }
      const push = (ev) => events.push({ ...ev, label: ev.kind === 'type' ? ev.label : uniq(ev.label) })
      const box = async (loc) => {
        await loc.waitFor({ state: 'visible' })
        const b = await loc.boundingBox()
        return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null
      }
      const c = {
        page,
        at,
        pause: human,
        /** Note where something is, for a zoom or a glow, without touching it. */
        async focus(loc, label, extra = {}) {
          push({ kind: 'focus', label, t: at(), box: await box(loc), ...extra })
        },
        /** Note the box of the nearest ancestor of `loc` at least `minHeight` CSS px tall (a whole row or card). */
        async focusCard(loc, label, { minHeight = 120 } = {}) {
          const b = await loc.evaluate((el, mh) => {
            let e = el
            while (e && e.getBoundingClientRect().height < mh) e = e.parentElement
            const r = (e || el).getBoundingClientRect()
            return { x: r.x, y: r.y, w: r.width, h: r.height }
          }, minHeight)
          push({ kind: 'focus', label, t: at(), box: b })
        },
        /** A named moment with no place (a page finished loading, say): clips are trimmed on these. */
        mark(label) {
          push({ kind: 'mark', label, t: at() })
        },
        async tap(loc, label, { before = 450, after = 700 } = {}) {
          await loc.scrollIntoViewIfNeeded().catch(() => {})
          const b = await box(loc)
          await human(before)
          push({ kind: 'tap', label, t: at(), box: b })
          await loc.tap()
          await human(after)
        },
        /** Tap something that opens the file picker, and hand it the files. */
        async tapForFiles(loc, label, files, opts = {}) {
          const chooser = page.waitForEvent('filechooser')
          await c.tap(loc, label, { ...opts, after: 0 })
          await (await chooser).setFiles(files)
          await human(opts.after ?? 900)
        },
        /** Tap a native <select> and choose an option (the phone's picker itself is not drawn by a headless browser). */
        async choose(loc, label, option, opts = {}) {
          await c.tap(loc, label, { ...opts, after: 500 })
          await loc.selectOption(option)
          await human(opts.after ?? 800)
        },
        async type(loc, label, text, { before = 400, perKey = 140, after = 700 } = {}) {
          await c.tap(loc, label, { before, after: 300 })
          push({ kind: 'type', label, t: at(), box: await box(loc), text })
          for (const ch of text) {
            await page.keyboard.type(ch)
            await human(perKey)
          }
          await human(after)
        },
        /** Press a key (Enter, Escape, Tab…) on whatever has focus. */
        async press(key, { after = 600, label } = {}) {
          push({ kind: 'mark', label: label || `press-${key.toLowerCase()}`, t: at() })
          await page.keyboard.press(key)
          await human(after)
        },
        /** Scroll the page by a number of CSS px, smoothly. */
        async scrollBy(dy, label = 'scroll', { after = 700 } = {}) {
          push({ kind: 'scroll', label, t: at() })
          await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), dy)
          await human(after)
        },
        /** Scroll an element to the middle of the screen, smoothly, like a thumb. */
        async scrollTo(loc, label, { block = 'center', after = 700 } = {}) {
          push({ kind: 'scroll', label, t: at() })
          await loc.evaluate((el, blk) => el.scrollIntoView({ behavior: 'smooth', block: blk }), block)
          await human(after)
        },
      }
      await sleep(leadMs)
      await fn(c)
      await sleep(tailMs)
      const durationMs = at()
      recording = false
      await loop
      return rec.encode(name, frames, t0, durationMs, events)
    },
    encode(name, frames, t0, durationMs, events) {
      if (frames.length === 0) throw new Error(`clip ${name}: no frames`)
      const dir = path.join(outDir, `.frames-${name}`)
      fs.rmSync(dir, { recursive: true, force: true })
      fs.mkdirSync(dir, { recursive: true })
      // frame k shows from its timestamp until the next one; the first frame is pulled back to the start of the clip
      const list = []
      frames.sort((a, b) => a.t - b.t)
      const rel = frames.map((f) => Math.max(0, f.t - t0))
      rel[0] = 0
      frames.forEach((f, k) => {
        const file = path.join(dir, `${String(k).padStart(5, '0')}.png`)
        fs.writeFileSync(file, Buffer.from(f.data, 'base64'))
        const next = k + 1 < frames.length ? rel[k + 1] : durationMs
        list.push(`file '${file}'`, `duration ${Math.max(0.001, (next - rel[k]) / 1000).toFixed(4)}`)
      })
      list.push(`file '${path.join(dir, `${String(frames.length - 1).padStart(5, '0')}.png`)}'`)
      const listFile = path.join(dir, 'list.txt')
      fs.writeFileSync(listFile, list.join('\n') + '\n')
      const mp4 = path.join(outDir, `${name}.mp4`)
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `fps=${fps},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-tune', 'stillimage', '-movflags', '+faststart', mp4])
      const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', mp4], { encoding: 'utf8' }).trim().split(',')
      fs.rmSync(dir, { recursive: true, force: true })
      const manifest = {
        name,
        file: `${name}.mp4`,
        cssWidth: width,
        cssHeight: height,
        pixelWidth: Number(probe[0]),
        pixelHeight: Number(probe[1]),
        fps,
        durationMs,
        frames: frames.length,
        events,
      }
      fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(manifest, null, 2) + '\n')
      log(`clip ${name}: ${(durationMs / 1000).toFixed(1)} s · ${frames.length} frames · ${manifest.pixelWidth}×${manifest.pixelHeight} · ${events.length} events`)
      return manifest
    },
    async close() {
      await browser.close()
    },
  }
  return rec
}

module.exports = { createRecorder, sleep, human }
