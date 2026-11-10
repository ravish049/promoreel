// Unit tests for photo placement: the homography, the cover crop per format, and the warnings.   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, coverCrop, homography, homographyMatrix, mapPoint, mapQuad, matrix3d, photoWarnings, quadCentre, type Point, type Quad } from './perspective'
import { layoutFor } from '../motion/layout'

const near = (a: Point, b: Point, tol: number, msg?: string) =>
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol, `${msg ?? ''} got [${a.map((v) => v.toFixed(3))}], want [${b}]`)

const FORMATS = [
  { name: '9:16', width: 1080, height: 1920 },
  { name: '4:5', width: 1080, height: 1350 },
  { name: '1:1', width: 1080, height: 1080 },
]

test('a rectangle quad gives an affine matrix (no perspective row)', () => {
  const m = homographyMatrix(390, 844, [
    [100, 200],
    [490, 200],
    [490, 1044],
    [100, 1044],
  ])
  assert.ok(Math.abs(m[2][0]) < 1e-12 && Math.abs(m[2][1]) < 1e-12, 'g and h are 0')
  assert.ok(Math.abs(m[0][0] - 1) < 1e-12 && Math.abs(m[1][1] - 1) < 1e-12, 'unit scale')
  assert.deepEqual([m[0][2], m[1][2]], [100, 200])
  // and the CSS has 0 in the perspective slots (the 4th and 8th of the column-major list)
  const css = homography(390, 844, [
    [100, 200],
    [490, 200],
    [490, 1044],
    [100, 1044],
  ])
  const v = css.slice('matrix3d('.length, -1).split(', ').map(Number)
  assert.equal(v.length, 16)
  assert.deepEqual([v[3], v[7], v[15]], [0, 0, 1])
  assert.deepEqual([v[12], v[13]], [100, 200])
})

test('a parallelogram is affine too, a trapezoid is not', () => {
  const para = homographyMatrix(100, 200, [
    [10, 10],
    [110, 30],
    [130, 230],
    [30, 210],
  ])
  assert.ok(Math.abs(para[2][0]) < 1e-12 && Math.abs(para[2][1]) < 1e-12)
  const trap = homographyMatrix(100, 200, [
    [20, 10],
    [90, 10],
    [110, 210],
    [0, 210],
  ])
  assert.ok(Math.abs(trap[2][1]) > 1e-6)
})

test('known corner points map back within 0.5 px (perspective quads)', () => {
  const quads: Quad[] = [
    [
      [612, 410],
      [1108, 488],
      [1036, 1532],
      [498, 1418],
    ],
    [
      [300, 260],
      [760, 300],
      [820, 1260],
      [240, 1180],
    ],
    [
      [10, 0],
      [400, 40],
      [390, 900],
      [0, 880],
    ],
  ]
  for (const q of quads) {
    for (const [w, h] of [
      [390, 844],
      [1080, 1920],
      [1, 1],
    ]) {
      const m = homographyMatrix(w, h, q)
      near(apply(m, [0, 0]), q[0], 0.5, 'TL')
      near(apply(m, [w, 0]), q[1], 0.5, 'TR')
      near(apply(m, [w, h]), q[2], 0.5, 'BR')
      near(apply(m, [0, h]), q[3], 0.5, 'BL')
      // and the midpoint of the box lands where the diagonals cross (projective centre)
      const c = apply(m, [w / 2, h / 2])
      const [p, r] = [q[0], q[2]]
      const [s, t] = [q[1], q[3]]
      const den = (p[0] - r[0]) * (s[1] - t[1]) - (p[1] - r[1]) * (s[0] - t[0])
      const u = ((p[0] - s[0]) * (s[1] - t[1]) - (p[1] - s[1]) * (s[0] - t[0])) / den
      near(c, [p[0] + u * (r[0] - p[0]), p[1] + u * (r[1] - p[1])], 1e-6, 'centre')
    }
  }
})

test('matrix3d is column-major, plain decimals, and reproduces apply()', () => {
  const q: Quad = [
    [612, 410],
    [1108, 488],
    [1036, 1532],
    [498, 1418],
  ]
  const m = homographyMatrix(390, 844, q)
  const css = matrix3d(m)
  assert.match(css, /^matrix3d\(([-0-9.]+, ){15}[-0-9.]+\)$/, 'no exponent notation')
  const v = css.slice('matrix3d('.length, -1).split(', ').map(Number)
  // CSS: [x' y' z' w'] = M · [x y 0 1], with M column-major in v
  const at = (x: number, y: number): Point => {
    const X = v[0] * x + v[4] * y + v[12]
    const Y = v[1] * x + v[5] * y + v[13]
    const W = v[3] * x + v[7] * y + v[15]
    return [X / W, Y / W]
  }
  near(at(0, 0), q[0], 0.01)
  near(at(390, 0), q[1], 0.01)
  near(at(390, 844), q[2], 0.01)
  near(at(0, 844), q[3], 0.01)
})

test('a degenerate quad throws', () => {
  assert.throws(() =>
    homographyMatrix(100, 100, [
      [0, 0],
      [50, 50],
      [100, 100],
      [150, 150],
    ]),
  )
  assert.throws(() => homographyMatrix(0, 100, [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]))
})

// a phone screen a little right of and below the middle of the photo
const screenIn = (w: number, h: number): Quad => [
  [w * 0.42, h * 0.38],
  [w * 0.72, h * 0.4],
  [w * 0.7, h * 0.8],
  [w * 0.4, h * 0.78],
]

for (const src of [
  { name: '3:4', width: 1500, height: 2000 },
  { name: '9:16', width: 1080, height: 1920 },
]) {
  for (const f of FORMATS) {
    test(`coverCrop from a ${src.name} source covers ${f.name} and keeps the focus in view`, () => {
      const q = screenIn(src.width, src.height)
      const c = coverCrop(src, f, q)
      // covers: no edge shows
      assert.ok(c.x <= 1e-9 && c.y <= 1e-9, 'offset is never positive')
      assert.ok(c.x + c.width >= f.width - 1e-6 && c.y + c.height >= f.height - 1e-6, 'covers the far edges')
      assert.ok(Math.abs(c.width - src.width * c.scale) < 1e-9)
      // one dimension fits exactly
      assert.ok(Math.abs(c.width - f.width) < 1e-6 || Math.abs(c.height - f.height) < 1e-6)
      // focus in view, and centred on any axis that has room for it
      const [fx, fy] = mapPoint(quadCentre(q), c)
      assert.ok(fx >= 0 && fx <= f.width && fy >= 0 && fy <= f.height, 'focus in view')
      if (c.x < -1e-9 && c.x > f.width - c.width + 1e-9) assert.ok(Math.abs(fx - f.width / 2) < 1e-6)
      if (c.y < -1e-9 && c.y > f.height - c.height + 1e-9) assert.ok(Math.abs(fy - f.height / 2) < 1e-6)
      // the whole screen stays in frame for this placement
      for (const p of mapQuad(q, c)) assert.ok(p[0] >= 0 && p[0] <= f.width && p[1] >= 0 && p[1] <= f.height, `corner ${p} in frame`)
    })
  }
}

test('coverCrop centres the focus when there is room, and clamps at an edge', () => {
  // 3:4 into 1:1: scale 0.72, 1440 tall, 360 px of vertical slack
  const c = coverCrop({ width: 1500, height: 2000 }, { width: 1080, height: 1080 }, [750, 1000])
  assert.ok(Math.abs(c.scale - 0.72) < 1e-12)
  assert.equal(c.x, 0)
  assert.ok(Math.abs(c.y - -180) < 1e-9)
  // focus near the bottom: pinned to the bottom edge
  const b = coverCrop({ width: 1500, height: 2000 }, { width: 1080, height: 1080 }, [750, 1950])
  assert.ok(Math.abs(b.y - (1080 - 1440)) < 1e-9)
  // focus near the top: pinned to the top edge
  assert.equal(coverCrop({ width: 1500, height: 2000 }, { width: 1080, height: 1080 }, [750, 20]).y, 0)
  // default focus is the source centre
  assert.deepEqual(coverCrop({ width: 1500, height: 2000 }, { width: 1080, height: 1080 }), c)
})

const good: Quad = [
  [380, 520],
  [760, 560],
  [740, 1180],
  [360, 1140],
]

test('photoWarnings: a well-placed screen gives none', () => {
  assert.deepEqual(photoWarnings(good, { width: 1080, height: 1920 }, layoutFor(1080, 1920).safe), [])
})

test('photoWarnings: anticlockwise corners', () => {
  const w = photoWarnings([good[0], good[3], good[2], good[1]], { width: 1080, height: 1920 })
  assert.equal(w.length, 1)
  assert.match(w[0], /wrong order/)
})

test('photoWarnings: not convex (two corners swapped)', () => {
  const w = photoWarnings([good[0], good[1], good[3], good[2]], { width: 1080, height: 1920 })
  assert.equal(w.length, 1)
  assert.match(w[0], /convex/)
})

test('photoWarnings: starts at the wrong corner', () => {
  const w = photoWarnings([good[1], good[2], good[3], good[0]], { width: 1080, height: 1920 })
  assert.equal(w.length, 1)
  assert.match(w[0], /wrong corner/)
})

test('photoWarnings: partly outside the crop', () => {
  const q = good.map(([x, y]) => [x, y + 600]) as Quad
  const w = photoWarnings(q, { width: 1080, height: 1350 })
  assert.equal(w.length, 1)
  assert.match(w[0], /1080×1350.*outside the picture \(2 of 4/)
})

test('photoWarnings: outside the safe area but inside the picture', () => {
  const q = good.map(([x, y]) => [x, y + 300]) as Quad
  const w = photoWarnings(q, { width: 1080, height: 1920 }, layoutFor(1080, 1920).safe)
  assert.equal(w.length, 1)
  assert.match(w[0], /safe area/)
})

test('photoWarnings: smaller than a quarter of the canvas width', () => {
  const q: Quad = [
    [500, 600],
    [700, 610],
    [700, 1000],
    [500, 990],
  ]
  const w = photoWarnings(q, { width: 1080, height: 1920 })
  assert.equal(w.length, 1)
  assert.match(w[0], /small: 200 px/)
})
