// Unit tests for the screen kit's pure helpers: counting text, typing, diffs, timing, the derived palette.   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countText, diffText, lift, numberIn, paletteOf, sec, stagger, typed } from './look'
import type { Theme } from '../reel/theme'
import template from '../../templates/project/brand.json'

test('countText rolls every number, keeping decimals and commas', () => {
  assert.equal(countText('$4,960.00', 0.5), '$2,480.00')
  assert.equal(countText('$4,960.00', 0), '$0.00')
  assert.equal(countText('$4,960.00', 1), '$4,960.00')
  assert.equal(countText('8.0 h', 0.5), '4.0 h')
  assert.equal(countText('12 of 40', 0.5), '6 of 20')
  assert.equal(countText('Paid', 0.3), 'Paid')
})

test('typed reveals whole characters', () => {
  assert.equal(typed('Harbor', 0), '')
  assert.equal(typed('Harbor', 0.5), 'Har')
  assert.equal(typed('Harbor', 1), 'Harbor')
  assert.equal(typed('Harbor', 2), 'Harbor')
})

test('diffText signs the difference with the larger precision', () => {
  assert.equal(diffText('8.0 h', '6.5 h'), '−1.5')
  assert.equal(diffText('38', '40.0'), '+2.0')
  assert.equal(diffText('$1,000', '$1,000'), '0')
  assert.equal(diffText('yes', 'no'), null)
  assert.deepEqual(numberIn('−2.0 h'), { value: -2, decimals: 1 })
})

test('timing is in seconds at any fps', () => {
  assert.equal(sec(1, 30), 30)
  assert.equal(sec(1, 60), 60)
  assert.equal(sec(0, 30), 1)
  assert.equal(stagger(3, 30), 9)
  assert.equal(stagger(3, 60), 18)
  // a long cascade tightens to fit ~1.8 s
  assert.equal(stagger(12, 30) * 12 <= 1.8 * 30 + 12, true)
})

test('the palette is derived from the theme only', () => {
  // the project template's colours (no colour literals in src/screens/)
  const c = template.colors
  assert.equal(lift(c.ink, 1), lift(c.paper, 1))
  assert.notEqual(lift(c.ink, 0.5), c.ink)
  const t = { ...c, success: c.highlight, font: 'Inter', mono: 'mono' } as unknown as Theme
  const p = paletteOf(t)
  assert.equal(p.label, t.ink)
  assert.equal(p.tint, t.highlight)
  assert.match(p.card, /^#[0-9a-f]{6}$/)
  assert.equal(p.diff, 'accent')
  // an accent too close to success falls back to the highlight for diff pills
  assert.equal(paletteOf({ ...t, accent: t.success }).diff, 'highlight')
  assert.equal(p.avatar('AB'), p.avatar('AB'))
})
