// Unit tests for the launch layout's framing: the click's push-in keeps the card on the canvas and its text in the safe
// area on tall and square canvases (wide keeps its 1.3× close-up), the logo's first row fits its width with the mark in
// proportion, and the pushed-in logo stack stays inside the safe area. The screens are the CrewDash launch film's.
//   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screenTarget } from '../screens/Screen'
import { DW, PAD } from '../screens/parts'
import type { LaunchSpec, ScreenSpec } from '../reel/spec'
import { LOGO_DRIFT, LOGO_PUSH, PUSH_MAX, fitLogoRow, launchLayout, screenBox, screenPush, type LaunchLayout } from './layout'

const crewdash = JSON.parse(readFileSync(join(__dirname, '../../examples/crewdash/reels/launch.json'), 'utf8')) as LaunchSpec
const screens = crewdash.scenes.flatMap((s) => (s.kind === 'screen' ? [{ spec: s.screen, words: !!s.words?.length }] : []))
const FORMATS: [string, number, number][] = [
  ['16:9', 1920, 1080],
  ['9:16', 1080, 1920],
  ['1:1', 1080, 1080],
]
const MICRO = 1.02

/** The box and click target a screen scene draws, with the counter (a 300 px card) in its corner. */
const framing = (lay: LaunchLayout, spec: ScreenSpec, words: boolean) => {
  const box = screenBox(spec, lay.stage({ words, hud: 300 }), lay.L.wide ? 1180 : Infinity)
  const t = screenTarget(spec, box.w, box.h)
  return { box, target: t ? ([box.cx - box.w / 2 + t[0], box.cy - box.h / 2 + t[1]] as [number, number]) : null }
}

/** The card's and its content's edges on the canvas (from the centre) with the camera at (x, y) scaled by s. */
const onCanvas = (box: { w: number; h: number; cx: number; cy: number }, x: number, y: number, s: number) => {
  const pad = (box.w * PAD) / DW
  const at = (v: number, c: number) => (v - c) * s
  return {
    card: { left: at(box.cx - box.w / 2, x), right: at(box.cx + box.w / 2, x), top: at(box.cy - box.h / 2, y), bottom: at(box.cy + box.h / 2, y) },
    text: { left: at(box.cx - box.w / 2 + pad, x), right: at(box.cx + box.w / 2 - pad, x), top: at(box.cy - box.h / 2 + pad, y), bottom: at(box.cy + box.h / 2 - pad, y) },
  }
}

test('wide canvases keep the 1.3× close-up leaning toward the button', () => {
  const lay = launchLayout(1920, 1080)
  for (const { spec, words } of screens) {
    const { box, target } = framing(lay, spec, words)
    if (!target) continue
    assert.deepEqual(screenPush(lay, box, target, MICRO), { x: target[0] * 0.72, y: target[1] * 0.72, s: PUSH_MAX })
  }
})

test('tall and square: the push keeps the card on the canvas and its text in the safe area, all the way in', () => {
  let pushed = 0
  for (const [name, W, H] of FORMATS.slice(1)) {
    const lay = launchLayout(W, H)
    const S = lay.safe
    for (const { spec, words } of screens) {
      const { box, target } = framing(lay, spec, words)
      if (!target) continue
      const floor = words ? lay.stage({ words, hud: 300 }).bottom : Infinity
      const p = screenPush(lay, box, target, MICRO, floor)
      assert.ok(p.s >= 1 && p.s * MICRO <= PUSH_MAX + 1e-9, `${name}: scale ${p.s} within 1..${PUSH_MAX}`)
      if (p.s > 1.02) pushed++
      // along the camera's ease (x, y and s move together) and with the micro-push at its largest
      for (let i = 0; i <= 20; i++) {
        const t = i / 20
        for (const micro of [1, MICRO]) {
          const s = (1 + (p.s - 1) * t) * micro
          const { card, text } = onCanvas(box, p.x * t, p.y * t, s)
          const what = `${name} ${spec.kind} at t=${t} (s ${s.toFixed(3)})`
          assert.ok(card.left >= -W / 2 - 0.5 && card.right <= W / 2 + 0.5 && card.top >= -H / 2 - 0.5 && card.bottom <= H / 2 + 0.5, `${what}: the card is on the canvas`)
          assert.ok(card.bottom <= floor + 0.5, `${what}: the card stays above the kinetic words`)
          assert.ok(text.left >= S.left - 0.5 && text.right <= S.right + 0.5 && text.top >= S.top - 0.5 && text.bottom <= S.bottom + 0.5, `${what}: the text is in the safe area`)
        }
      }
      // centred toward the button: the camera moves toward it, never away
      if (p.s > 1) assert.ok(p.y * target[1] >= 0, `${name}: the push leans toward the button`)
    }
  }
  assert.ok(pushed > 0, 'the CrewDash screens still get a visible push on tall or square')
})

test('with kinetic words under the stage, the pushed card never reaches them', () => {
  for (const [name, W, H] of FORMATS.slice(1)) {
    const lay = launchLayout(W, H)
    const stage = lay.stage({ words: true, hud: 0 })
    // a table with a button near its top: the push leans up, then must not drag the card's bottom into the words
    const box = { w: stage.right - stage.left - 40, h: (stage.bottom - stage.top) * 0.6, cx: 0, cy: stage.bottom - (stage.bottom - stage.top) * 0.3 }
    const p = screenPush(lay, box, [0, box.cy - box.h * 0.4], MICRO, stage.bottom)
    for (const micro of [1, MICRO]) {
      const { card } = onCanvas(box, p.x, p.y, p.s * micro)
      assert.ok(card.bottom <= stage.bottom + 0.5, `${name}: the card's bottom (${card.bottom.toFixed(1)}) stays above the words (${stage.bottom.toFixed(1)})`)
    }
  }
})

test('a card that already fills the canvas is not pushed', () => {
  const lay = launchLayout(1080, 1920)
  assert.deepEqual(screenPush(lay, { w: 1080, h: 1500, cx: 0, cy: 0 }, [200, 500], MICRO), { x: 0, y: 0, s: 1 })
})

// in node, text is measured as chars × size × (0.5 + tracking), as textWidth falls back to
const measure = (name: string) => (size: number) => [...name].length * size * (0.5 - 0.035)

test('the logo row fits its width; a long name shrinks the mark with it', () => {
  for (const [fmt, W, H] of FORMATS) {
    const lay = launchLayout(W, H)
    const L = lay.logo
    const short = fitLogoRow(measure('Ace'), L.maxW, L.mark, L.name)
    assert.equal(short.mark, L.mark, `${fmt}: a short name keeps the full mark`)
    assert.equal(short.nameSize, L.name, `${fmt}: a short name keeps its full size`)
    for (const name of ['CrewDash', 'Brindlebook', 'Northwind Workforce Logistics Cloud']) {
      const r = fitLogoRow(measure(name), L.maxW, L.mark, L.name)
      assert.ok(r.width <= L.maxW + 0.5, `${fmt} ${name}: the row (${r.width.toFixed(1)}) fits ${L.maxW.toFixed(1)}`)
      assert.ok(r.mark <= Math.max(L.mark * 0.4, r.nameSize * 1.15) + 1, `${fmt} ${name}: the mark (${r.mark}) is in proportion to the name (${r.nameSize.toFixed(1)})`)
      // centred and pushed in about the canvas centre, the row ends inside the safe area
      assert.ok((r.width / 2) * LOGO_PUSH <= lay.safe.right + 0.5, `${fmt} ${name}: the pushed-in row ends inside the safe area`)
    }
    const long = fitLogoRow(measure('Northwind Workforce Logistics Cloud'), L.maxW, L.mark, L.name)
    assert.ok(long.mark < L.mark, `${fmt}: a long name shrinks the mark`)
  }
})

test("the logo's layout area, pushed in and drifting, stays inside the safe area", () => {
  for (const [fmt, W, H] of FORMATS) {
    const lay = launchLayout(W, H)
    const A = lay.logo.safe
    const S = lay.safe
    assert.ok(A.left * LOGO_PUSH >= S.left - 1e-9 && A.right * LOGO_PUSH <= S.right + 1e-9, `${fmt}: across`)
    assert.ok((A.top - LOGO_DRIFT) * LOGO_PUSH >= S.top - 1e-9 && (A.bottom + LOGO_DRIFT) * LOGO_PUSH <= S.bottom + 1e-9, `${fmt}: up and down`)
    assert.ok(Math.abs(lay.logo.maxW - (A.right - A.left)) < 1e-9, `${fmt}: rows take the area's width`)
  }
})
