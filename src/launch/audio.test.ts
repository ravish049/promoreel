// Unit tests for the launch film's plan and audio job: cuts on the beat, sections at the cuts, no voice, clicks on the
// cursor's press, ticks on card landings and checkmarks (every card landed before its checkmark), the counter's track,
// and the per-format layout staying in the safe area.   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Format, LaunchSpec } from '../reel/spec'
import { FORMAT_SIZE } from '../reel/shared'
import { outputName } from '../../cli/lib/project'
import { DEFAULT_LAUNCH_BPM, buildLaunchPlan, buildLaunchTimeline, counterAt, type PayoffPlan, type ScreenPlan } from './plan'
import { launchAudioJob, launchBedFile } from './audio'
import { counterHeight, launchLayout, rectH, rectW, screenBox } from './layout'

const spec = (extra: Partial<LaunchSpec> = {}): LaunchSpec => ({
  id: 'launch',
  style: 'launch',
  formats: ['16x9', '9x16', '1x1'],
  counter: { label: 'Invoices to chase', value: 86 },
  scenes: [
    { id: 'hook', kind: 'hook', seconds: 4.1, headline: [{ text: '86 invoices.' }, { text: 'Due Friday.', accent: true }] },
    {
      id: 'screen',
      kind: 'screen',
      seconds: 7.2,
      words: ['Check.', 'Chase.', 'Repeat.'],
      screen: {
        kind: 'table',
        title: 'Overdue',
        columns: ['Client', 'Billed', 'Paid'],
        rows: [
          ['A', '10', '10'],
          ['B', '20', '15'],
        ],
        compare: { columns: [1, 2] },
        button: { label: 'Chase all', busy: 'Sending…', done: 'Sent' },
      },
    },
    { id: 'payoff', kind: 'payoff', seconds: 6, words: ['Sent.', 'Paid.'], cards: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }, { title: 'Four' }] },
    { id: 'logo', kind: 'logo', seconds: 5, cta: 'Try it' },
  ],
  ...extra,
})

test('scene cuts land on the beat of music.bpm (default 120), and the film ends on the last cut', () => {
  const tl = buildLaunchTimeline(spec(), 60)
  assert.equal(tl.bpm, DEFAULT_LAUNCH_BPM)
  assert.equal(tl.beat, 30)
  for (const s of tl.scenes) assert.equal(s.from % 30, 0, `${s.id} starts on a beat (${s.from})`)
  assert.deepEqual(
    tl.scenes.map((s) => [s.from, s.to]),
    [
      [0, 240],
      [240, 690],
      [690, 1050],
      [1050, 1350],
    ],
  )
  assert.equal(tl.durationInFrames, 1350)
  // another tempo: 96 bpm = 0.625 s per beat
  const t96 = buildLaunchTimeline(spec({ music: { bpm: 96 } }), 60)
  for (const s of t96.scenes) assert.ok(Math.abs(s.from / 37.5 - Math.round(s.from / 37.5)) < 0.03, `${s.id} at ${s.from} is on the 96 bpm grid`)
  // beatSync false keeps the seconds as written
  const raw = buildLaunchTimeline(spec({ music: { beatSync: false } }), 60)
  assert.equal(raw.scenes[1].from, Math.round(4.1 * 60))
})

test('a scene never collapses: at least one beat each', () => {
  const tl = buildLaunchTimeline(
    {
      scenes: [
        { id: 'a', kind: 'logo', seconds: 0.1 },
        { id: 'b', kind: 'logo', seconds: 0.1 },
      ],
    },
    60,
  )
  assert.deepEqual(
    tl.scenes.map((s) => s.to - s.from),
    [30, 30],
  )
})

test('the audio job: sections at the scene cuts (intro, build, drop, resolve), no voice, the film length, 0 offset', () => {
  const s = spec()
  const plan = buildLaunchPlan(s, 60)
  const job = launchAudioJob(s, plan)
  const ms = (f: number) => Math.round((f / 60) * 1000)
  assert.deepEqual(job.sections, [
    { atMs: 0, kind: 'intro' },
    { atMs: ms(240), kind: 'build' },
    { atMs: ms(690), kind: 'drop' },
    { atMs: ms(1050), kind: 'resolve' },
  ])
  assert.deepEqual(job.voiceSpans, [])
  assert.equal(job.durationMs, ms(1350))
  assert.equal(job.bpm, 120)
  assert.equal(job.offsetMs, 0)
  assert.equal(job.music, undefined)
  // a user's track replaces the bed, resolved to a file the synth can read
  const own = launchAudioJob(spec({ music: { src: 'music/theme.mp3', gainDb: -3 } }), plan, { resolveMusic: (x) => `/abs/${x}` })
  assert.deepEqual(own.music, { src: '/abs/music/theme.mp3', gainDb: -3 })
})

test('repeated scene kinds share one section; the bpm follows the spec', () => {
  const s = spec({ music: { bpm: 100 } })
  s.scenes.splice(2, 0, { id: 'screen2', kind: 'screen', seconds: 4, screen: { kind: 'stat', value: 5, label: 'Done' } })
  const job = launchAudioJob(s, buildLaunchPlan(s, 60))
  assert.deepEqual(
    job.sections.map((x) => x.kind),
    ['intro', 'build', 'drop', 'resolve'],
  )
  assert.equal(job.bpm, 100)
})

test('the bed file is named after the video it plays under', () => {
  for (const f of ['16x9', '9x16', '1x1'] as Format[]) assert.equal(launchBedFile('launch', f), `audio/${outputName('launch', f)}.wav`)
})

test('the screen: the cursor arrives, hesitates, then presses; the camera is pushed in at the click; a click sound on it', () => {
  const plan = buildLaunchPlan(spec(), 60)
  const sc = plan.scenes.find((p): p is ScreenPlan => p.kind === 'screen')!
  const c = sc.cursor!
  assert.ok(c, 'a screen with a button gets a cursor')
  assert.equal(c.click, sc.progress.click)
  assert.ok(c.enter[0] >= 0 && c.enter[0] + c.enter[1] < c.approach[0], 'travels in, then hesitates before the approach')
  assert.ok(c.approach[0] + c.approach[1] <= c.click, 'on the button before the press')
  assert.ok(sc.progress.done! > c.click)
  assert.ok(sc.zoom && sc.zoom.in[1] <= c.click && sc.zoom.out[0] >= c.click, 'pushed in for the click')
  assert.ok(sc.zoom!.out[1] <= sc.out + 18, 'back out before the scene leaves')
  assert.ok(sc.progress.checkRows !== undefined, 'a compare table checks its rows by default')
  assert.deepEqual(plan.clicks, [sc.scene.from + c.click])
  // words on the beat
  for (const w of sc.wordsAt) assert.equal(w % 30, 0)
  // `at` pins an action, in seconds into the scene
  const pinned = spec()
  ;(pinned.scenes[1] as { at?: object }).at = { click: 4 }
  const sc2 = buildLaunchPlan(pinned, 60).scenes[1] as ScreenPlan
  assert.equal(sc2.progress.click, 240)
})

test('a screen with nothing to press gets no cursor and no click', () => {
  const s = spec()
  s.scenes[1] = { id: 'screen', kind: 'screen', seconds: 6, screen: { kind: 'stat', value: 12, label: 'Saved' } }
  const plan = buildLaunchPlan(s, 60)
  const sc = plan.scenes[1] as ScreenPlan
  assert.equal(sc.cursor, undefined)
  assert.equal(sc.zoom, undefined)
  assert.deepEqual(plan.clicks, [])
  assert.ok(sc.progress.count !== undefined)
})

test('the payoff: cards land one by one, every card has landed before the first checkmark, ticks on both, the clear state holds', () => {
  const plan = buildLaunchPlan(spec(), 60)
  const p = plan.scenes.find((x): x is PayoffPlan => x.kind === 'payoff')!
  for (let i = 1; i < p.land.length; i++) assert.ok(p.land[i] > p.land[i - 1])
  assert.ok(Math.max(...p.landed) < Math.min(...p.checks), 'checks after every landing')
  for (let i = 1; i < p.checks.length; i++) assert.ok(p.checks[i] > p.checks[i - 1])
  assert.ok(p.countDown && p.countDown[1] - p.countDown[0] === 60, 'the counter drops in 1 s')
  assert.equal(p.zero, p.countDown![1])
  assert.ok(p.pullBack[0] >= p.zero)
  assert.ok(p.out - p.zero >= 90, 'holds the clear state ≥ 1.5 s')
  assert.equal(plan.ticks.length, 8)
  for (const f of p.landed) assert.ok(plan.ticks.includes(p.scene.from + f))
  assert.deepEqual(plan.warnings, [])
  // a payoff too short to hold says so
  const short = spec()
  short.scenes[2].seconds = 3
  assert.ok(buildLaunchPlan(short, 60).warnings.some((w) => w.includes('clear state')))
})

test('the counter rolls up in the hook, moves to its corner at the cut, drops to counterTo with its glow turning, and leaves before the logo', () => {
  const plan = buildLaunchPlan(spec(), 60)
  const c = plan.counter!
  assert.equal(c.digits, 2)
  assert.deepEqual(c.rollUp, [30, 90])
  assert.ok(c.toCorner![0] < 240 && c.toCorner![1] > 240)
  assert.equal(counterAt(c, 0).value, 0)
  assert.equal(counterAt(c, 90).value, 86)
  assert.equal(counterAt(c, 400).value, 86)
  const [d0, d1] = c.drops[0].span
  assert.deepEqual(counterAt(c, d0), { value: 86, ok: 0 })
  assert.deepEqual(counterAt(c, d1), { value: 0, ok: 1 })
  assert.ok(c.hide && c.hide[1] <= 1050, 'gone by the logo')
  // no counter in the spec: none in the film
  assert.equal(buildLaunchPlan(spec({ counter: undefined }), 60).counter, undefined)
})

test('the plan scales to other frame rates', () => {
  const p30 = buildLaunchPlan(spec(), 30)
  assert.equal(p30.tl.durationInFrames, 675)
  const sc = p30.scenes[1] as ScreenPlan
  assert.ok(sc.cursor && sc.cursor.click > 0)
})

test('layout: the stage, the cards and the counter stay inside the safe area in every format', () => {
  for (const f of ['16x9', '9x16', '1x1'] as Format[]) {
    const { width, height } = FORMAT_SIZE[f]
    const lay = launchLayout(width, height)
    const S = lay.safe
    for (const words of [false, true])
      for (const hud of [0, 300])
        for (const r of [lay.stage({ words, hud }), lay.cards({ words, hud })]) {
          assert.ok(r.left >= S.left && r.right <= S.right && r.top >= S.top && r.bottom <= S.bottom, `${f}: ${JSON.stringify(r)} inside ${JSON.stringify(S)}`)
          assert.ok(rectW(r) > 400 && rectH(r) > 400, `${f}: a usable stage`)
          if (hud && !lay.L.wide) assert.ok(r.top >= S.top + counterHeight(lay.hud.size), `${f}: the stage starts under the counter`)
          if (hud && lay.L.wide && r.right < S.right) assert.ok(r.right <= S.right - hud, `${f}: the stage clears the counter's column`)
        }
    assert.ok(lay.words.cy + lay.words.size * 0.62 <= S.bottom + 0.5, `${f}: the words sit inside the safe area`)
    const box = screenBox({ kind: 'list', rows: [{ title: 'a' }, { title: 'b' }] }, lay.stage({ words: true, hud: 300 }))
    assert.ok(box.w > 0 && box.h > 0)
  }
})
