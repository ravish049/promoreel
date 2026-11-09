// Unit tests for the walk timeline (scene lengths, beat sync, anchors, cuts).   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Caption } from '@remotion/captions'
import type { Anchor, WalkCut, WalkSpec, WalkStep } from '../reel/spec'
import { buildWalkTimeline, walkWarnings, type WalkTimeline, type WalkWords } from './timeline'

// fps 30, so: lead 300 ms = 9 f, gap 600 ms = 18 f, tail 400 ms = 12 f, min 1000 ms = 30 f, end hold 1000 ms = 30 f
const PACE = { leadMs: 300, gapMs: 600, tailMs: 400, minMs: 1000, endHoldMs: 1000 }

const step = (id: string, anchors?: Record<string, Anchor>): WalkStep => ({
  id,
  label: `Label ${id}`,
  icon: 'map-pin',
  screen: { kind: 'stat', value: 1, label: id },
  anchors,
})

function walk(stepIds: string[], cuts: Record<string, WalkCut>, extra: Partial<WalkSpec> = {}): WalkSpec {
  const lineIds = new Set<string>()
  for (const c of Object.values(cuts)) for (const sc of [c.hook, ...c.steps, c.logo]) for (const l of sc?.lines ?? []) lineIds.add(l)
  return {
    id: 'demo',
    style: 'walk',
    fps: 30,
    voice: { use: 'af_heart' },
    lines: [...lineIds].map((id) => ({ id, say: id })),
    steps: stepIds.map((id) => step(id)),
    cuts,
    hook: { headline: 'Losing hours?' },
    pace: PACE,
    ...extra,
  }
}

/** Words laid out the way captions.json stores them: a leading space on every word after the first. */
function caps(text: string, msPerWord: number): Caption[] {
  return text.split(' ').map((w, k) => ({ text: k === 0 ? w : ` ${w}`, startMs: k * msPerWord, endMs: (k + 1) * msPerWord, timestampMs: null, confidence: null }))
}

function assertContiguous(tl: WalkTimeline) {
  assert.equal(tl.scenes[0].from, 0)
  for (let i = 1; i < tl.scenes.length; i++) assert.equal(tl.scenes[i].from, tl.scenes[i - 1].to, `scene ${tl.scenes[i].id} starts where ${tl.scenes[i - 1].id} ends`)
  assert.equal(tl.scenes[tl.scenes.length - 1].to, tl.durationInFrames)
  for (const l of tl.lines) {
    const sc = tl.scenes.find((s) => s.id === l.sceneId)!
    assert.ok(l.from >= sc.from && l.from + l.durationInFrames <= sc.to, `line ${l.id} sits inside scene ${sc.id}`)
  }
}

test('3 steps: each scene is lead + lines + tail, the logo holds to the end', () => {
  const spec = walk(['a', 'b', 'c'], {
    long: { steps: [{ step: 'a', lines: ['la'] }, { step: 'b', lines: ['lb'] }, { step: 'c', lines: ['lc'] }], logo: { lines: ['close', 'cta'] } },
  })
  spec.steps[0].anchors = { click: { word: 'shift', offsetMs: 100 }, done: { line: 'la' }, enter: { scene: 'b', offsetMs: -200 } }
  const tl = buildWalkTimeline(spec, 'long', { la: 2000, lb: 2000, lc: 2000, close: 1500, cta: 1000 }, { la: caps('send a shift', 300) })
  assert.equal(tl.fps, 30)
  assert.deepEqual(
    tl.scenes.map((s) => [s.id, s.kind, s.from, s.to]),
    [
      ['a', 'step', 0, 81],
      ['b', 'step', 81, 162],
      ['c', 'step', 162, 243],
      ['logo', 'logo', 243, 387],
    ],
  )
  assert.equal(tl.durationInFrames, 357 + 30)
  assert.deepEqual(
    tl.lines.map((l) => [l.id, l.sceneId, l.from, l.durationInFrames]),
    [
      ['la', 'a', 9, 60],
      ['lb', 'b', 90, 60],
      ['lc', 'c', 171, 60],
      ['close', 'logo', 252, 45],
      ['cta', 'logo', 315, 30],
    ],
  )
  // "shift" is word 2 at 600 ms = 18 f into the line, +100 ms = 3 f
  assert.deepEqual(tl.events.a, { click: 9 + 18 + 3, done: 9, enter: 81 - 6 })
  assert.deepEqual(tl.events.b, {})
  assert.deepEqual(tl.events.logo, {})
  assert.deepEqual(tl.trackerSteps, [
    { id: 'a', label: 'Label a', icon: 'map-pin' },
    { id: 'b', label: 'Label b', icon: 'map-pin' },
    { id: 'c', label: 'Label c', icon: 'map-pin' },
  ])
  assert.deepEqual(tl.warnings, [])
  assertContiguous(tl)
})

test('6 steps with a hook: 8 contiguous scenes, a minimum length holds, scene overrides of lead / tail / min apply', () => {
  const ids = ['s1', 's2', 's3', 's4', 's5', 's6']
  const spec = walk(ids, {
    long: {
      hook: { lines: ['hook'], leadMs: 0 },
      steps: ids.map((id) => ({ step: id, lines: [`l-${id}`] })),
      logo: { lines: ['cta'], tailMs: 0, minMs: 3000 },
    },
  })
  const durations: Record<string, number> = { hook: 1000, cta: 500 }
  ids.forEach((id, i) => (durations[`l-${id}`] = 1000 + i * 500))
  durations['l-s1'] = 300 // a short line: the scene runs its minimum (30 f)
  const tl = buildWalkTimeline(spec, 'long', durations)
  assert.deepEqual(
    tl.scenes.map((s) => s.kind),
    ['hook', 'step', 'step', 'step', 'step', 'step', 'step', 'logo'],
  )
  assert.deepEqual(
    tl.scenes.map((s) => s.id),
    ['hook', ...ids, 'logo'],
  )
  assert.deepEqual(tl.lines[0], { id: 'hook', sceneId: 'hook', from: 0, durationInFrames: 30 })
  const s1 = tl.scenes[1]
  assert.equal(s1.to - s1.from, 30, 's1: lead 9 + line 9 + tail 12 = 30 = the minimum')
  const logo = tl.scenes[7]
  assert.equal(logo.to - 30 - logo.from, 90, 'the logo runs its 3 s minimum, then the end hold')
  assert.equal(tl.trackerSteps.length, 6)
  assert.deepEqual(tl.warnings, [])
  assertContiguous(tl)
})

// ── beat sync ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const twoScenes = (laMs: number, tailMs: number, bpm: number) =>
  walk(['a'], { long: { steps: [{ step: 'a', lines: ['la'], tailMs }], logo: { lines: ['cta'] } } }, { music: { bpm, beatSync: true } })

test('beat sync: a cut moves to the nearest beat, even an earlier one', () => {
  // 120 bpm = a beat every 15 f. Line ends at 69, natural cut at 81: beats 75 (6 away) and 90 (9 away) → 75.
  const tl = buildWalkTimeline(twoScenes(2000, 400, 120), 'long', { la: 2000, cta: 1000 })
  assert.equal(tl.scenes[1].from, 75)
  assert.equal(tl.scenes[0].to, 75)
  assert.equal(tl.lines[1].from, 75 + 9, 'the next scene lays its lines out from the moved cut')
})

test('beat sync: never within 0.2 s of the last spoken word', () => {
  // the line ends at 70 (61 f); natural cut 82; beat 75 is nearer (7) but only 5 f after the word → 90
  const tl = buildWalkTimeline(twoScenes(2033, 400, 120), 'long', { la: 2033, cta: 1000 })
  assert.equal(tl.lines[0].from + tl.lines[0].durationInFrames, 70)
  assert.equal(tl.scenes[1].from, 90)
})

test('beat sync: never more than 0.3 s later or 0.6 s earlier', () => {
  // 60 bpm = a beat every 30 f. Natural cut 81: beat 60 is 21 f early (> 18), beat 90 is 9 f late (= 0.3 s) → 90
  assert.equal(buildWalkTimeline(twoScenes(2000, 400, 60), 'long', { la: 2000, cta: 1000 }).scenes[1].from, 90)
  // natural cut 78 (tail 300 ms): beat 90 is 12 f late (> 9), beat 60 is before the last word (ends at 69) → no beat
  // fits, so the cut stays where it was
  assert.equal(buildWalkTimeline(twoScenes(2000, 300, 60), 'long', { la: 2000, cta: 1000 }).scenes[1].from, 78)
})

test('beat sync: every cut of a 6-step walk lands on a beat inside its window, or stays put', () => {
  const ids = ['s1', 's2', 's3', 's4', 's5', 's6']
  for (const bpm of [72, 96, 112, 128, 150]) {
    const spec = walk(ids, { long: { hook: { lines: ['hook'] }, steps: ids.map((id) => ({ step: id, lines: [`l-${id}`] })), logo: { lines: ['cta'] } } }, { music: { bpm, beatSync: true } })
    const durations: Record<string, number> = { hook: 1700, cta: 1300 }
    ids.forEach((id, i) => (durations[`l-${id}`] = 1130 + i * 517))
    const tl = buildWalkTimeline(spec, 'long', durations)
    const beat = (60 / bpm) * 30
    for (let i = 1; i < tl.scenes.length; i++) {
      const prev = tl.scenes[i - 1]
      const own = tl.lines.filter((l) => l.sceneId === prev.id)
      const speechEnd = Math.max(...own.map((l) => l.from + l.durationInFrames))
      const natural = Math.max(speechEnd + 12, prev.from + 30)
      const start = tl.scenes[i].from
      const lo = Math.max(speechEnd + 6, natural - 18)
      const hi = natural + 9
      const beatsInWindow = [] as number[]
      for (let n = Math.floor(lo / beat); n <= Math.ceil(hi / beat); n++) if (Math.round(n * beat) >= lo && Math.round(n * beat) <= hi) beatsInWindow.push(Math.round(n * beat))
      if (beatsInWindow.length === 0) assert.equal(start, natural, `${bpm} bpm, cut into ${tl.scenes[i].id}: no beat fits, stays`)
      else {
        assert.ok(beatsInWindow.includes(start), `${bpm} bpm, cut into ${tl.scenes[i].id} at ${start} is a beat in [${lo}, ${hi}]`)
        for (const b of beatsInWindow) assert.ok(Math.abs(start - natural) <= Math.abs(b - natural), 'and the nearest one')
      }
    }
    assertContiguous(tl)
  }
})

test('beat sync with your own track and no bpm: a warning, no sync', () => {
  const spec = walk(['a'], { long: { steps: [{ step: 'a', lines: ['la'] }], logo: { lines: ['cta'] } } }, { music: { src: 'track.wav', beatSync: true } })
  const tl = buildWalkTimeline(spec, 'long', { la: 2000, cta: 1000 })
  assert.equal(tl.scenes[1].from, 81)
  assert.match(tl.warnings[0], /music\.bpm/)
})

// ── anchors ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('word anchors: text finds the first match (any case, any punctuation), an index picks one, negative counts from the end', () => {
  const spec = walk(['a'], {
    long: {
      steps: [
        {
          step: 'a',
          lines: ['la'],
          anchors: {
            first: { line: 'la', word: 'shift' },
            shouty: { line: 'la', word: 'SHIFT,' },
            second: { line: 'la', word: 8 },
            last: { line: 'la', word: -1 },
            secondLast: { line: 'la', word: -2 },
            zero: { word: 0, offsetMs: 1000 },
          },
        },
      ],
      logo: { lines: ['cta'] },
    },
  })
  // 9 words, 100 ms (3 f) apart; the line starts at frame 9
  const words: WalkWords = { la: caps('Send a shift, and a crew gets the shift', 100) }
  const tl = buildWalkTimeline(spec, 'long', { la: 2000, cta: 1000 }, words)
  assert.deepEqual(tl.events.a, { first: 9 + 6, shouty: 9 + 6, second: 9 + 24, last: 9 + 24, secondLast: 9 + 21, zero: 9 + 30 })
  assert.deepEqual(tl.warnings, [])
})

test('a missing anchor word is a warning naming the line and the word, and falls on the line start', () => {
  const spec = walk(['a'], { long: { steps: [{ step: 'a', lines: ['la'], anchors: { done: { line: 'la', word: 'invoice' } } }], logo: { lines: ['cta'] } } })
  const tl = buildWalkTimeline(spec, 'long', { la: 2000, cta: 1000 }, { la: caps('send a shift', 300), cta: caps('book a demo', 300) })
  assert.equal(tl.events.a.done, 9)
  assert.equal(tl.warnings.length, 1)
  assert.match(tl.warnings[0], /line "la"/)
  assert.match(tl.warnings[0], /word "invoice"/)
  assert.deepEqual(walkWarnings(spec, { la: 2000, cta: 1000 }, { la: caps('send a shift', 300) }), [tl.warnings[0]].map((w) => `long: ${w}`))
})

test('without word timings yet, word anchors fall on the line start quietly; with captions loaded but a line missing, a warning', () => {
  const spec = walk(['a'], { long: { steps: [{ step: 'a', lines: ['la'], anchors: { click: { word: 'shift' } } }], logo: { lines: ['cta'] } } })
  const quiet = buildWalkTimeline(spec, 'long', { la: 2000, cta: 1000 })
  assert.equal(quiet.events.a.click, 9)
  assert.deepEqual(quiet.warnings, [])
  const loud = buildWalkTimeline(spec, 'long', { la: 2000, cta: 1000 }, {})
  assert.equal(loud.events.a.click, 9)
  assert.match(loud.warnings[0], /line "la" has no word timings/)
})

test('an out-of-range word index is a warning and clamps to the nearest word', () => {
  const spec = walk(['a'], { long: { steps: [{ step: 'a', lines: ['la'], anchors: { x: { word: 5 }, y: { word: -9 } } }], logo: { lines: ['cta'] } } })
  const tl = buildWalkTimeline(spec, 'long', { la: 2000, cta: 1000 }, { la: caps('send a shift', 300) })
  assert.deepEqual(tl.events.a, { x: 9 + 18, y: 9 })
  assert.equal(tl.warnings.length, 2)
  assert.match(tl.warnings[0], /word 5 is out of range/)
})

test('a missing line duration throws, naming the line', () => {
  const spec = walk(['a'], { long: { steps: [{ step: 'a', lines: ['la'] }], logo: { lines: ['cta'] } } })
  assert.throws(() => buildWalkTimeline(spec, 'long', { la: 2000 }), /no voice for line "cta"/)
  assert.throws(() => buildWalkTimeline(spec, 'nope', { la: 2000, cta: 1000 }), /no cut "nope" \(has: long\)/)
})

// ── cuts ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('a short cut drops steps: its scenes, events and tracker list only its own; cut anchors override step anchors by name', () => {
  const ids = ['dispatch', 'gps', 'sheet', 'pay', 'invoice']
  const spec = walk(ids, {
    long: { hook: { lines: ['hook'] }, steps: ids.map((id) => ({ step: id, lines: [id] })), logo: { lines: ['close', 'cta'], anchors: { cta: { line: 'cta' } } } },
    short: {
      steps: [
        { step: 'dispatch', lines: ['dispatch-s'] },
        { step: 'sheet', lines: ['sheet-s'], anchors: { done: { word: -1, offsetMs: 300 } } },
        { step: 'invoice', lines: ['invoice-s'] },
      ],
      logo: { lines: ['cta'], anchors: { name: { scene: 'logo', offsetMs: 1000 } } },
      tracker: 'title',
    },
  })
  const sheet = spec.steps.find((s) => s.id === 'sheet')!
  sheet.anchors = { click: { word: 0 }, done: { word: 'hours' } }
  const durations: Record<string, number> = { hook: 1500, close: 1500, cta: 1000, 'dispatch-s': 1500, 'sheet-s': 1500, 'invoice-s': 1500 }
  for (const id of ids) durations[id] = 2000
  const words: WalkWords = { sheet: caps('checks it against your hours', 200), 'sheet-s': caps('checks the sheet', 200), cta: caps('book a demo', 200), close: caps('every hour matched', 200) }

  const long = buildWalkTimeline(spec, 'long', durations, words)
  assert.deepEqual(
    long.trackerSteps.map((s) => s.id),
    ids,
  )
  assert.deepEqual(Object.keys(long.events), ['hook', ...ids, 'logo'])
  const longSheet = long.lines.find((l) => l.id === 'sheet')!
  assert.deepEqual(long.events.sheet, { click: longSheet.from, done: longSheet.from + 24 })
  assert.equal(long.events.logo.cta, long.lines.find((l) => l.id === 'cta')!.from)

  const short = buildWalkTimeline(spec, 'short', durations, words)
  assert.deepEqual(short.trackerSteps, [
    { id: 'dispatch', label: 'Label dispatch', icon: 'map-pin' },
    { id: 'sheet', label: 'Label sheet', icon: 'map-pin' },
    { id: 'invoice', label: 'Label invoice', icon: 'map-pin' },
  ])
  assert.deepEqual(
    short.scenes.map((s) => s.id),
    ['dispatch', 'sheet', 'invoice', 'logo'],
  )
  assert.deepEqual(Object.keys(short.events), ['dispatch', 'sheet', 'invoice', 'logo'])
  // the step's click (no line → the scene's first line in THIS cut) and the cut's own done (last word + 300 ms)
  const shortSheet = short.lines.find((l) => l.id === 'sheet-s')!
  assert.deepEqual(short.events.sheet, { click: shortSheet.from, done: shortSheet.from + 12 + 9 })
  assert.equal(short.events.logo.name, short.scenes[3].from + 30)
  assert.ok(short.durationInFrames < long.durationInFrames)
  assert.deepEqual(short.warnings, [])
  assertContiguous(short)
})

test('an anchor on a scene or line that is not in the cut is a warning and falls on its own scene start', () => {
  const spec = walk(['a', 'b'], {
    long: { steps: [{ step: 'a', lines: ['la'] }, { step: 'b', lines: ['lb'] }], logo: { lines: ['cta'] } },
    short: { steps: [{ step: 'a', lines: ['la'] }], logo: { lines: ['cta'] } },
  })
  spec.steps[0].anchors = { toB: { scene: 'b' }, onLb: { line: 'lb', word: 'x' } }
  const tl = buildWalkTimeline(spec, 'short', { la: 2000, lb: 2000, cta: 1000 }, {})
  assert.deepEqual(tl.events.a, { toB: 0, onLb: 0 })
  assert.equal(tl.warnings.length, 2)
  assert.match(tl.warnings[0], /scene "b" is not in this cut/)
  assert.match(tl.warnings[1], /line "lb" is not spoken in this cut/)
})
