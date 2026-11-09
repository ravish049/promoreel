// Unit tests for the walk plan's default screen actions: click and done wait for the screen to settle.   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ScreenSpec, WalkSpec } from '../reel/spec'
import { countFrames, fillFrames } from '../screens/timing'
import { buildWalkTimeline } from './timeline'
import { buildWalkPlan } from './plan'

const FORM: ScreenSpec = {
  kind: 'form',
  title: 'New invoice',
  fields: [
    { label: 'Client', value: 'Northwind' },
    { label: 'Week', value: 'Oct 12 – Oct 18' },
    { label: 'Terms', value: 'Net 15' },
  ],
  items: [
    { label: 'Loader', amount: '$2,418.00' },
    { label: 'Driver', amount: '$2,542.00' },
  ],
  total: { label: 'Total', value: '$4,960.00' },
  button: { label: 'Send', busy: 'Sending…', done: 'Sent' },
}

const STAT: ScreenSpec = { kind: 'stat', value: 38, label: 'hours matched' }

/** One step (no hook) speaking one line of `lineMs`, then the logo. */
function plan(screen: ScreenSpec, fps: number, lineMs: number, minMs?: number) {
  const spec: WalkSpec = {
    id: 'demo',
    style: 'walk',
    fps,
    voice: { use: 'af_heart' },
    lines: [
      { id: 'l', say: 'l' },
      { id: 'c', say: 'c' },
    ],
    steps: [{ id: 's', label: 'Step', icon: 'file-text', screen }],
    cuts: { long: { steps: [{ step: 's', lines: ['l'], minMs }], logo: { lines: ['c'] } } },
  }
  const tl = buildWalkTimeline(spec, 'long', { l: lineMs, c: 1000 })
  return buildWalkPlan(spec, tl)
}

for (const fps of [60, 30]) {
  test(`stat (${fps} fps): a short line still lets the number land before done`, () => {
    const p = plan(STAT, fps, 1200, 4000)
    const s = p.steps[0].progress
    assert.ok(s.count !== undefined && s.done !== undefined)
    assert.ok(s.done >= s.count + countFrames(STAT, fps), `done ${s.done} before the count ends ${s.count + countFrames(STAT, fps)}`)
    assert.deepEqual(p.warnings, [])
  })

  test(`form (${fps} fps): click and done come after the fields, items and total are in`, () => {
    const p = plan(FORM, fps, 2000, 6000)
    const s = p.steps[0].progress
    assert.ok(s.fill !== undefined && s.count !== undefined && s.click !== undefined && s.done !== undefined)
    const settled = Math.max(s.fill + fillFrames(FORM, fps), s.count + countFrames(FORM, fps))
    assert.ok(s.count >= s.fill + Math.round(0.5 * fps), 'the total rolls after the fill starts')
    assert.ok(s.click >= settled, `click ${s.click} before the form settles at ${settled}`)
    assert.ok(s.done > s.click, 'done after click')
    assert.deepEqual(p.warnings, [])
  })

  test(`form (${fps} fps): a step too short for its screen is a warning`, () => {
    const p = plan(FORM, fps, 1500)
    assert.equal(p.warnings.length, 1)
    assert.match(p.warnings[0], /step "s": its screen is still filling or counting/)
  })
}
