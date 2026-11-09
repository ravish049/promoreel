// Unit tests for the frame-pure motion helpers.   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EASE, TRAVEL, arc, drift, enter, exit, press, tween } from './motion'
import { camAt, type CamKey } from './Camera'
import { cursorAt } from './Cursor'
import { mixColor } from './Counter'

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`)

test('tween holds outside its frames and eases between them', () => {
  assert.equal(tween(0, 10, 20, 100, 200), 100)
  assert.equal(tween(10, 10, 20, 100, 200), 100)
  assert.equal(tween(20, 10, 20, 100, 200), 200)
  assert.equal(tween(99, 10, 20, 100, 200), 200)
  near(tween(15, 10, 20, 100, 200), 150) // the easy ease is symmetric
  assert.ok(tween(12, 10, 20, 100, 200) < 120, 'eases in, not linear')
  near(tween(15, 10, 20, 0, 1, (t) => t), 0.5)
  near(tween(15, 10, 20, 1, 0), 0.5) // runs backwards too
})

test('easings start at 0 and end at 1; overshoot and travel pass 1 on the way', () => {
  for (const e of [EASE.inOut, EASE.out, EASE.in, EASE.overshoot, EASE.count, TRAVEL]) {
    near(e(0), 0)
    near(e(1), 1)
  }
  assert.ok(Math.max(...Array.from({ length: 99 }, (_, i) => EASE.overshoot((i + 1) / 100))) > 1)
  assert.ok(Math.max(...Array.from({ length: 99 }, (_, i) => TRAVEL((i + 1) / 100))) > 1)
})

test('enter is 0 before its frame and settles at 1 after its duration', () => {
  assert.equal(enter(9, 10), 0)
  assert.equal(enter(10, 10), 0)
  near(enter(40, 10, 30), 1, 0.01) // the spring's last frame is within a hair of 1
  assert.equal(enter(41, 10, 30), 1)
  assert.equal(enter(500, 10, 30), 1)
  assert.equal(enter(71, 10, 60, 60), 1)
  const peak = Math.max(...Array.from({ length: 30 }, (_, i) => enter(10 + i, 10, 30)))
  assert.ok(peak > 1 && peak < 1.1, `a slight overshoot, got ${peak}`)
})

test('exit runs 0 → 1 over its duration; press dips and returns', () => {
  assert.equal(exit(0, 10), 0)
  assert.equal(exit(28, 10), 1)
  assert.equal(press(9, 10), 1)
  near(press(13, 10), 0.96)
  assert.equal(press(18, 10), 1)
  near(press(16, 10, 16), 0.96)
})

test('drift stays inside ±amp', () => {
  for (let f = 0; f < 600; f += 7) assert.ok(Math.abs(drift(f, 4)) <= 4)
  near(drift(0), 0)
})

test('arc starts at a, ends at b and bows off the straight line', () => {
  assert.deepEqual(arc([0, 0], [100, 0], 0), [0, 0])
  assert.deepEqual(arc([0, 0], [100, 0], 1), [100, 0])
  const [x, y] = arc([0, 0], [100, 0], 0.5)
  near(x, 50)
  assert.ok(y < 0, 'bows upward')
  assert.deepEqual(arc([0, 0], [100, 0], 0.5, 0), [50, 0])
})

test('camAt holds before the first key and after the last, and eases between keys', () => {
  const keys: CamKey[] = [
    { f: 10, x: 0, y: 0, s: 1 },
    { f: 30, x: 100, y: -50, s: 2 },
    { f: 60, x: 100, y: -50, s: 1 },
  ]
  assert.deepEqual(camAt(keys, 0), { x: 0, y: 0, s: 1 })
  assert.deepEqual(camAt(keys, 10), { x: 0, y: 0, s: 1 })
  const mid = camAt(keys, 20)
  near(mid.x, 50)
  near(mid.y, -25)
  near(mid.s, 1.5)
  assert.ok(camAt(keys, 13).x < 15, 'eased, not linear')
  assert.deepEqual(camAt(keys, 30), { x: 100, y: -50, s: 2 })
  near(camAt(keys, 45).s, 1.5)
  assert.deepEqual(camAt(keys, 200), { x: 100, y: -50, s: 1 })
  assert.deepEqual(camAt([{ f: 0, x: 5, y: 6, s: 1.2 }], 99), { x: 5, y: 6, s: 1.2 })
})

test('camAt adds the micro-push across its length', () => {
  const keys: CamKey[] = [{ f: 0, x: 0, y: 0, s: 1 }]
  near(camAt(keys, 0, 0.1, 100).s, 1)
  near(camAt(keys, 50, 0.1, 100).s, 1.05)
  near(camAt(keys, 300, 0.1, 100).s, 1.1)
})

test('cursorAt starts at the first move and lands on each target', () => {
  const moves = [
    { at: 0, dur: 0, to: [0, 0] as [number, number] },
    { at: 10, dur: 20, to: [200, 100] as [number, number] },
  ]
  const [sx, sy] = cursorAt(5, moves) // waiting at the start: drifts only a pixel or two
  assert.ok(Math.abs(sx) <= 1.5 && Math.abs(sy) <= 1.2)
  const [x, y] = cursorAt(30, moves)
  near(x, 200)
  near(y, 100)
  const [dx, dy] = cursorAt(60, moves) // settled: drifts only a pixel or two
  assert.ok(Math.abs(dx - 200) <= 1.5 && Math.abs(dy - 100) <= 1.2)
})

test('mixColor blends two hex colours', () => {
  assert.equal(mixColor('#000000', '#ffffff', 0), '#000000')
  assert.equal(mixColor('#000', '#fff', 1), '#ffffff')
  assert.equal(mixColor('#000000', '#ffffff', 0.5), '#808080')
  assert.equal(mixColor('#102030', '#102030', 0.3), '#102030')
  assert.equal(mixColor('#000', '#fff', 2), '#ffffff')
})
