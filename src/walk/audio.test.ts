// Unit tests for the walk's audio job and plan (sections at scene cuts, voice spans, effects on the plan's moments).   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { WalkCut, WalkSpec, WalkStep } from '../reel/spec'
import { outputName } from '../../cli/lib/project'
import { buildWalkTimeline, DEFAULT_WALK_BPM } from './timeline'
import { buildWalkPlan } from './plan'
import { walkAudioJob, walkBedFile } from './audio'

const steps: WalkStep[] = [
  { id: 'list', label: 'Bookings', icon: 'clock', screen: { kind: 'list', rows: [{ title: 'A' }, { title: 'B' }, { title: 'C' }], button: { label: 'Confirm' } }, anchors: { checkRows: { word: 1 } } },
  { id: 'table', label: 'Hours', icon: 'line-chart', screen: { kind: 'table', columns: ['Day', 'Hours'], rows: [['Mon', '8']], button: { label: 'Approve' } } },
  { id: 'stat', label: 'Total', icon: 'sparkles', screen: { kind: 'stat', value: 42, label: 'Booked' } },
  { id: 'phone', label: 'Check-in', icon: 'smartphone', screen: { kind: 'phone', screen: { kind: 'list', rows: [{ title: 'Visit' }] }, action: { label: 'Check in' } } },
]

const cuts: Record<string, WalkCut> = {
  long: {
    hook: { lines: ['hook'] },
    steps: [
      { step: 'list', lines: ['l1'] },
      { step: 'table', lines: ['l2'] },
      { step: 'stat', lines: ['l3'] },
      { step: 'phone', lines: ['l4'] },
    ],
    logo: { lines: ['close', 'cta'] },
  },
  short: { steps: [{ step: 'list', lines: ['l1'] }, { step: 'phone', lines: ['l4'] }], logo: { lines: ['cta'] } },
}

const spec = (extra: Partial<WalkSpec> = {}): WalkSpec => ({
  id: 'demo',
  style: 'walk',
  fps: 60,
  voice: { use: 'af_heart' },
  lines: ['hook', 'l1', 'l2', 'l3', 'l4', 'close', 'cta'].map((id) => ({ id, say: `${id} says a few words here` })),
  steps,
  cuts,
  hook: { headline: 'A week that books itself' },
  ...extra,
})

const durations = { hook: 2100, l1: 2600, l2: 2300, l3: 1900, l4: 2200, close: 1500, cta: 1800 }
const words = Object.fromEntries(Object.keys(durations).map((id) => [id, [0, 1, 2, 3, 4].map((k) => ({ text: `w${k}`, startMs: k * 300, endMs: k * 300 + 250 }))]))
const ms = (f: number, fps = 60) => Math.round((f / fps) * 1000)

test('sections change at the scene cuts: intro under the hook, build from the first step, drop on the last step, resolve on the close', () => {
  const s = spec()
  const tl = buildWalkTimeline(s, 'long', durations, words)
  const job = walkAudioJob(s, tl)
  const at = (id: string) => ms(tl.scenes.find((x) => x.id === id)!.from)
  assert.deepEqual(job.sections, [
    { atMs: 0, kind: 'intro' },
    { atMs: at('list'), kind: 'build' },
    { atMs: at('phone'), kind: 'drop' },
    { atMs: at('logo'), kind: 'resolve' },
  ])
  const cutsMs = new Set(tl.scenes.map((x) => ms(x.from)))
  for (const sec of job.sections) assert.ok(cutsMs.has(sec.atMs), `section at ${sec.atMs} ms sits on a scene cut`)
  assert.equal(job.durationMs, ms(tl.durationInFrames))
})

test('a cut without a hook starts on build; with two steps there is no drop', () => {
  const s = spec()
  const tl = buildWalkTimeline(s, 'short', durations, words)
  const job = walkAudioJob(s, tl)
  assert.deepEqual(
    job.sections.map((x) => x.kind),
    ['build', 'resolve'],
  )
  assert.equal(job.sections[0].atMs, 0)
  assert.equal(job.sections[1].atMs, ms(tl.scenes.find((x) => x.id === 'logo')!.from))
})

test('voice spans match the lines, one per spoken line, in order', () => {
  const s = spec()
  for (const cut of ['long', 'short']) {
    const tl = buildWalkTimeline(s, cut, durations, words)
    const job = walkAudioJob(s, tl)
    assert.equal(job.voiceSpans.length, tl.lines.length)
    tl.lines.forEach((l, i) => {
      assert.equal(job.voiceSpans[i].startMs, ms(l.from))
      assert.equal(job.voiceSpans[i].endMs, ms(l.from + l.durationInFrames))
      // within a frame of the measured length
      assert.ok(Math.abs(job.voiceSpans[i].endMs - job.voiceSpans[i].startMs - durations[l.id as keyof typeof durations]) <= 1000 / 60)
    })
  }
})

test('effects land on the plan: a whoosh per camera move, a chime per step done, a click per press, the riser peaks at the close', () => {
  const s = spec()
  const tl = buildWalkTimeline(s, 'long', durations, words)
  const plan = buildWalkPlan(s, tl)
  const job = walkAudioJob(s, tl, { plan })
  const of = (kind: string) => job.sfx.filter((e) => e.kind === kind).map((e) => e.atMs)
  for (const st of plan.steps) {
    assert.ok(of('chime').includes(ms(st.done)), `chime when ${st.id} is done`)
    if (st.moveIn) assert.ok(of('whoosh').includes(ms(st.moveIn[0])), `whoosh on the move into ${st.id}`)
  }
  assert.ok(of('whoosh').includes(ms(plan.hook!.dive[0])), 'whoosh on the dive')
  // list, table and phone are pressed; the stat is not
  assert.equal(of('click').length, 3)
  assert.deepEqual(of('riser'), [ms(plan.logo.scene.from)])
  // three rows tick off on the list, four chips check in the hook
  assert.equal(of('tick').length, 3 + 4)
  for (const e of job.sfx) assert.ok(e.atMs >= 100 && e.atMs <= job.durationMs, `${e.kind} at ${e.atMs} ms is inside the bed`)
  assert.deepEqual(
    job.sfx.map((e) => e.atMs),
    [...job.sfx.map((e) => e.atMs)].sort((a, b) => a - b),
  )
})

test('bpm defaults to the walk grid, offset 0; a track is resolved against public/', () => {
  const tl = buildWalkTimeline(spec(), 'long', durations)
  const plain = walkAudioJob(spec(), tl)
  assert.equal(plain.bpm, DEFAULT_WALK_BPM)
  assert.equal(plain.offsetMs, 0)
  assert.equal(plain.music, undefined)
  const s = spec({ music: { bpm: 96, src: 'music/track.mp3', gainDb: -3 } })
  const job = walkAudioJob(s, buildWalkTimeline(s, 'long', durations), { resolveMusic: (src) => `/project/public/${src}` })
  assert.equal(job.bpm, 96)
  assert.deepEqual(job.music, { src: '/project/public/music/track.mp3', gainDb: -3 })
})

test('plan: every step completes inside its scene, actions run in order, defaults fill in what the spec leaves out', () => {
  const s = spec()
  const tl = buildWalkTimeline(s, 'long', durations, words)
  const plan = buildWalkPlan(s, tl)
  for (const st of plan.steps) {
    assert.ok(st.done >= st.scene.from && st.done < st.scene.to, `${st.id} is done inside its scene`)
    assert.ok(st.done <= st.leaveAt, `${st.id} is done before its screen leaves`)
    const p = st.progress
    if (p.click !== undefined) assert.ok(p.click < st.done, `${st.id} is pressed before it is done`)
  }
  const [list, table, stat, phone] = plan.steps
  assert.equal(list.progress.checkRows, tl.events.list.checkRows)
  assert.ok(table.progress.fill !== undefined && table.progress.click !== undefined)
  assert.equal(stat.progress.click, undefined)
  assert.ok(stat.progress.count !== undefined)
  assert.ok(phone.progress.click !== undefined)
  assert.ok(plan.trackerOut < plan.logo.scene.from, 'the tracker leaves before the close')
  assert.deepEqual(plan.hideCaptionsIn, ['hook', 'logo'])
})

test('the bed file is the video name: <id>.wav for one cut, <id>-<cut>.wav for several', () => {
  const two = spec()
  assert.equal(walkBedFile(two, 'long'), `audio/${outputName('demo', '9x16', 'long')}.wav`)
  const one = spec({ cuts: { long: cuts.long } })
  assert.equal(walkBedFile(one, 'long'), `audio/${outputName('demo', '9x16')}.wav`)
})
