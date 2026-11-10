// Unit tests for the cross-out scribble's geometry and timing.   npx tsx --test src/replace/parts/scribblePath.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_STROKES, MIN_STROKES, scribbleDrawn, scribblePath, type Box } from './scribblePath'

const BOX: Box = { x: 80, y: 600, w: 920, h: 210 }

/** Every coordinate pair in an absolute M/C path. */
const coords = (d: string): [number, number][] => {
  assert.match(d, /^M[-\d. ]+(C[-\d. ]+)+$/, 'only absolute M and C commands')
  const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  assert.equal(nums.length % 2, 0)
  return Array.from({ length: nums.length / 2 }, (_, i) => [nums[2 * i], nums[2 * i + 1]])
}

test('the same box, seed and options give the same path; another seed gives another', () => {
  const a = scribblePath(BOX, 7)
  assert.deepEqual(scribblePath(BOX, 7), a)
  assert.deepEqual(scribblePath(BOX, 7, { strokes: 8, loops: 1 }), scribblePath(BOX, 7, { strokes: 8, loops: 1 }))
  assert.notEqual(scribblePath(BOX, 8).d, a.d)
})

test('the path stays within the box plus the overshoot, and runs past both ends', () => {
  for (let seed = 1; seed <= 60; seed++) {
    for (const box of [BOX, { x: 0, y: 0, w: 400, h: 60 }, { x: -50, y: 20, w: 700, h: 300 }]) {
      const over = box.h * 0.14
      const s = scribblePath(box, seed)
      assert.deepEqual(s.bounds, { x: box.x - over, y: box.y - over, w: box.w + over * 2, h: box.h + over * 2 })
      const pts = coords(s.d)
      const eps = 0.051 // the path is written to 0.1 px
      for (const [x, y] of pts) {
        assert.ok(x >= box.x - over - eps && x <= box.x + box.w + over + eps, `seed ${seed}: x ${x} outside`)
        assert.ok(y >= box.y - over - eps && y <= box.y + box.h + over + eps, `seed ${seed}: y ${y} outside`)
      }
      // it starts left of the box and ends past one of its sides
      const [x0] = pts[0]
      const [xn] = pts[pts.length - 1]
      assert.ok(x0 < box.x, `seed ${seed}: starts inside`)
      assert.ok(xn < box.x || xn > box.x + box.w, `seed ${seed}: ends inside`)
    }
  }
  const tight = scribblePath(BOX, 3, { overshoot: 4 })
  for (const [x, y] of coords(tight.d)) {
    assert.ok(x >= BOX.x - 4.05 && x <= BOX.x + BOX.w + 4.05 && y >= BOX.y - 4.05 && y <= BOX.y + BOX.h + 4.05)
  }
})

test(`the stroke count stays within ${MIN_STROKES}–${MAX_STROKES}, and the phases cover the path in order`, () => {
  const seen = new Set<number>()
  const boxes = [BOX, { x: 0, y: 0, w: 900, h: 150 }, { x: 0, y: 0, w: 1400, h: 120 }]
  for (let seed = 1; seed <= 300; seed++) {
    const s = scribblePath(boxes[seed % 3], seed)
    assert.ok(s.strokes >= MIN_STROKES && s.strokes <= MAX_STROKES, `seed ${seed}: ${s.strokes} strokes`)
    seen.add(s.strokes)
    assert.equal(s.phases.filter((p) => p.kind === 'stroke').length, s.strokes)
    const loops = s.phases.filter((p) => p.kind === 'loop').length
    assert.ok(loops >= 1 && loops <= 2, `seed ${seed}: ${loops} loops`)
    assert.equal(s.phases[0].from, 0)
    assert.equal(s.phases[s.phases.length - 1].to, s.length)
    for (let i = 1; i < s.phases.length; i++) assert.equal(s.phases[i].from, s.phases[i - 1].to)
    // it crosses the whole row, and each stroke spans most of the row's height
    const b = boxes[seed % 3]
    assert.ok(s.length > b.w && s.length > s.strokes * b.h * 0.7, `seed ${seed}: length ${s.length}`)
  }
  assert.equal(seen.size, MAX_STROKES - MIN_STROKES + 1, 'the box and seed reach every count')
  // a wider row gets more strokes
  const avg = (box: Box) => Array.from({ length: 40 }, (_, i) => scribblePath(box, i + 1).strokes).reduce((a, b) => a + b, 0) / 40
  assert.ok(avg({ x: 0, y: 0, w: 1200, h: 150 }) > avg({ x: 0, y: 0, w: 600, h: 150 }))
  for (const strokes of [1, 6, 8, 10, 30]) {
    assert.equal(scribblePath(BOX, 1, { strokes }).strokes, Math.min(MAX_STROKES, Math.max(MIN_STROKES, strokes)))
  }
  assert.equal(scribblePath(BOX, 1, { loops: 0 }).phases.filter((p) => p.kind === 'loop').length, 0)
})

test('drawing runs 0 → length without going back, fast along a stroke and slow into the turns', () => {
  const s = scribblePath(BOX, 11, { strokes: 8, loops: 1 })
  assert.equal(scribbleDrawn(s, 0), 0)
  assert.equal(scribbleDrawn(s, -1), 0)
  assert.equal(scribbleDrawn(s, 1), s.length)
  assert.equal(scribbleDrawn(s, 2), s.length)
  let last = 0
  for (let i = 1; i <= 400; i++) {
    const v = scribbleDrawn(s, i / 400)
    assert.ok(v >= last - 1e-9, `went back at ${i / 400}`)
    last = v
  }
  // within the first stroke: the middle tenth of its time covers more ground than the first tenth
  const first = s.phases[0]
  const share = 1 / (s.strokes + 0.55)
  const at = (k: number) => scribbleDrawn(s, share * k)
  assert.ok(at(0.55) - at(0.45) > 3 * (at(0.1) - at(0)), 'not faster mid-stroke')
  assert.ok(Math.abs(at(1) - first.to) < 1e-6)
})
