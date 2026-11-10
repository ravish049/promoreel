// Unit tests for the per-format canvas layout.   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutFor } from './layout'
import { SAFE } from '../reel/theme'

test('1080×1920 is tall and its safe area is the reel SAFE zone', () => {
  const L = layoutFor(1080, 1920)
  assert.equal(L.kind, 'tall')
  assert.equal(L.wide, false)
  assert.deepEqual(L.safe, { top: 269, bottom: 1248, left: 65, right: 1015 })
  assert.deepEqual(L.safe, { ...SAFE })
  assert.deepEqual(L.fromCenter, { top: 269 - 960, bottom: 1248 - 960, left: 65 - 540, right: 1015 - 540 })
  assert.ok(Math.abs(L.t - 0.86) < 1e-9)
})

test('1920×1080 is wide with 5 % title-safe margins and full-size text', () => {
  const L = layoutFor(1920, 1080)
  assert.equal(L.kind, 'wide')
  assert.equal(L.wide, true)
  assert.deepEqual(L.safe, { top: 54, bottom: 1026, left: 96, right: 1824 })
  assert.deepEqual(L.fromCenter, { top: -486, bottom: 486, left: -864, right: 864 })
  assert.equal(L.t, 1)
})

test('1080×1080 is square with 6 % margins', () => {
  const L = layoutFor(1080, 1080)
  assert.equal(L.kind, 'square')
  assert.deepEqual(L.safe, { top: 65, bottom: 1015, left: 65, right: 1015 })
  assert.deepEqual(L.fromCenter, { top: -475, bottom: 475, left: -475, right: 475 })
  assert.ok(Math.abs(L.t - 0.86) < 1e-9)
})

test('other sizes scale: 720×1280 keeps the tall zones in proportion', () => {
  const L = layoutFor(720, 1280)
  assert.equal(L.kind, 'tall')
  assert.deepEqual(L.safe, { top: Math.round(269 * (2 / 3)), bottom: Math.round(1248 * (2 / 3)), left: Math.round(65 * (2 / 3)), right: Math.round(1015 * (2 / 3)) })
  assert.ok(Math.abs(L.t - 0.86 * (2 / 3)) < 1e-9)
})
