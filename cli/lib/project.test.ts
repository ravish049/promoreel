// Unit tests for spec validation per style, the render plan (composition, formats, file names) and the recorded
// style's props, which must stay exactly what they were before styles existed.   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { Brand, LaunchSpec, VideoSpec, WalkSpec } from '../../src/reel/spec'
import { buildProps, loadProject, outputName, pickReel, renderJobs, validateSpec, type Project } from './project'

const generic = path.join(__dirname, '..', '..', 'examples', 'generic')
// captured from the unmodified code (before styles), with buildProps(loadProject(generic), todo-promo)
const snapshot = fs.readFileSync(path.join(__dirname, 'fixtures', 'todo-promo.props.json'), 'utf8')

const brand: Brand = { name: 'Acme', colors: { ink: '#111111', paper: '#FAFAFA', accent: '#FF3366' }, features: [] }
const withOutro: Brand = { ...brand, outro: { title: 'Acme', cta: 'acme.dev', lines: [{ id: 'outro', say: 'Acme.' }] } }
const project = (b: Brand = brand): Project => ({ dir: '/tmp/acme', name: 'acme', brand: b, publicDir: '/tmp/acme/public', outDir: '/tmp/acme/out', reels: [] })

const walk = (over: Partial<WalkSpec> = {}): WalkSpec => ({
  id: 'walk',
  style: 'walk',
  voice: { use: 'af_heart' },
  lines: [
    { id: 'open', say: 'This is Acme.' },
    { id: 'book', say: 'Book a slot in two taps.' },
    { id: 'pay', say: 'Then get paid the same day.' },
    { id: 'cta', say: 'Try it at acme dot dev.' },
  ],
  steps: [
    { id: 'book', label: 'Booking', icon: 'send', screen: { kind: 'list', title: 'Today', rows: [{ title: 'Haircut', value: '10:00' }] }, anchors: { click: { word: 'taps' } } },
    { id: 'pay', label: 'Payout', icon: 'banknote', screen: { kind: 'phone', screen: { kind: 'stat', value: 420, prefix: '$', label: 'Paid today' }, action: { label: 'Pay out', icon: 'check' } } },
  ],
  hook: { headline: 'Bookings, sorted' },
  cuts: {
    long: { hook: { lines: ['open'] }, steps: [{ step: 'book', lines: ['book'] }, { step: 'pay', lines: ['pay'] }], logo: { lines: ['cta'], anchors: { cta: { line: 'cta', word: -1 } } } },
    short: { steps: [{ step: 'book', lines: ['book'] }], logo: { lines: ['cta'] } },
  },
  close: { cta: 'acme.dev' },
  ...over,
})

const launch = (over: Partial<LaunchSpec> = {}): LaunchSpec => ({
  id: 'launch',
  style: 'launch',
  formats: ['16x9', '9x16', '1x1'],
  music: { bpm: 120 },
  counter: { label: 'Sheets to match', value: 140 },
  scenes: [
    { id: 'hook', kind: 'hook', seconds: 4, headline: [{ text: '140 sheets.' }, { text: 'Due at 5.', accent: true }] },
    { id: 'product', kind: 'screen', seconds: 8, screen: { kind: 'table', columns: ['Day', 'Theirs', 'Ours'], rows: [['Mon', '8.0', '8.0'], ['Tue', '6.0', '8.0']], compare: { columns: [1, 2] }, button: { label: 'Match', done: 'Matched' } }, at: { click: 3 } },
    { id: 'payoff', kind: 'payoff', seconds: 6, cards: [{ title: 'Payroll', icon: 'banknote' }] },
    { id: 'logo', kind: 'logo', seconds: 5, cta: 'acme.dev' },
  ],
  ...over,
})

const rejects = (spec: unknown, re: RegExp, b?: Brand) => assert.throws(() => validateSpec(spec as VideoSpec, 'reels/x.json', b), re)

test('a recorded spec gives byte-for-byte the props it gave before styles', () => {
  const p = loadProject(generic)
  const { spec } = pickReel(p, 'todo-promo')
  assert.equal(JSON.stringify(buildProps(p, spec as never), null, 2) + '\n', snapshot)
  const jobs = renderJobs(p, spec)
  assert.equal(jobs.length, 1)
  assert.deepEqual({ ...jobs[0], props: undefined }, { style: 'recorded', composition: 'Reel', format: '9x16', width: 1080, height: 1920, name: 'todo-promo', props: undefined })
  assert.equal(JSON.stringify(jobs[0].props, null, 2) + '\n', snapshot)
})

test('format → file name: 9x16 keeps the plain id, the others get a suffix, a cut comes before the format', () => {
  assert.equal(outputName('launch', '9x16'), 'launch')
  assert.equal(outputName('launch', '16x9'), 'launch-16x9')
  assert.equal(outputName('launch', '1x1'), 'launch-1x1')
  assert.equal(outputName('walk', '9x16', 'short'), 'walk-short')
  assert.equal(outputName('walk', '16x9', 'short'), 'walk-short-16x9')
})

test('a launch film renders one Launch video per format, each at its own size', () => {
  const jobs = renderJobs(project(), launch())
  assert.deepEqual(
    jobs.map((j) => [j.composition, j.format, j.width, j.height, j.name]),
    [
      ['Launch', '16x9', 1920, 1080, 'launch-16x9'],
      ['Launch', '9x16', 1080, 1920, 'launch'],
      ['Launch', '1x1', 1080, 1080, 'launch-1x1'],
    ],
  )
  const props = jobs[0].props as { format: string; width: number; height: number; fps: number; brand: Brand }
  assert.deepEqual([props.format, props.width, props.height, props.fps, props.brand.name], ['16x9', 1920, 1080, 30, 'Acme'])
  assert.deepEqual(
    renderJobs(project(), launch({ formats: undefined })).map((j) => j.name),
    ['launch'],
  )
})

test('a walk renders one Walk video per cut; a single cut keeps the plain id', () => {
  const jobs = renderJobs(project(), walk())
  assert.deepEqual(
    jobs.map((j) => [j.composition, j.cut, j.name, (j.props as { cut: string }).cut]),
    [
      ['Walk', 'long', 'walk-long', 'long'],
      ['Walk', 'short', 'walk-short', 'short'],
    ],
  )
  const one = walk({ cuts: { long: walk().cuts.long } })
  assert.deepEqual(
    renderJobs(project(), one).map((j) => j.name),
    ['walk'],
  )
})

test('valid walk and launch specs pass, with or without brand.outro', () => {
  validateSpec(walk(), 'walk.json', brand)
  validateSpec(launch(), 'launch.json', brand)
  validateSpec(walk({ close: undefined }), 'walk.json', withOutro)
})

test('a walk without steps, cuts or voice fails with the reason', () => {
  rejects(walk({ steps: undefined }), /x\.json: a walk needs "steps"/)
  rejects(walk({ steps: [] }), /a walk needs "steps"/)
  rejects(walk({ cuts: {} }), /a walk needs "cuts"/)
  rejects(walk({ voice: undefined as never }), /voice\.use is required/)
})

test('a walk with a broken reference names it', () => {
  const w = walk()
  rejects({ ...w, cuts: { long: { ...w.cuts.long, steps: [{ step: 'nope', lines: ['book'] }] } } }, /cut "long" shows step "nope", which is not in "steps"/)
  rejects({ ...w, cuts: { long: { ...w.cuts.long, logo: { lines: ['missing'] } } } }, /cut "long"'s logo uses line "missing"/)
  rejects({ ...w, steps: [{ ...w.steps[0], anchors: { click: { line: 'ghost', word: 'x' } } }, w.steps[1]] }, /step "book": anchor "click" uses line "ghost"/)
  rejects({ ...w, steps: [{ ...w.steps[0], anchors: { click: { scene: 'nowhere' } } }, w.steps[1]] }, /anchor "click" points at scene "nowhere"/)
  rejects({ ...w, steps: [{ ...w.steps[0], icon: 'not-an-icon' }, w.steps[1]] }, /step "book": icon "not-an-icon"/)
  rejects({ ...w, steps: [{ ...w.steps[0], id: 'logo' }, w.steps[1]] }, /step id "logo" is taken/)
  rejects({ ...w, steps: [{ ...w.steps[0], screen: { kind: 'chart' } }, w.steps[1]] }, /screen kind "chart" is not one of list, table, form, phone, stat/)
  rejects({ ...w, hook: undefined }, /cut "long" has a hook scene, but the spec has no "hook"/)
  rejects(walk({ close: undefined }), /the close needs a call to action/, brand)
})

test('a launch film without scenes fails with the reason', () => {
  rejects(launch({ scenes: undefined as never }), /a launch film needs "scenes"/)
  rejects(launch({ scenes: [] }), /a launch film needs "scenes"/)
  rejects(launch({ scenes: [{ id: 'a', kind: 'intro', seconds: 2 } as never] }), /scene "a": kind "intro" is not one of hook, screen, payoff, logo/)
  rejects(launch({ scenes: [{ id: 'a', kind: 'payoff', cards: [{ title: 'x' }] } as never] }), /scene "a" needs "seconds"/)
  rejects(launch({ scenes: [{ id: 'a', kind: 'screen', seconds: 3, screen: { kind: 'table', columns: ['A', 'B'], rows: [['1']] } } as never] }), /every table row needs 2 cells/)
  rejects(launch({ scenes: [{ id: 'l', kind: 'logo', seconds: 3 }] }), /scene "l" needs a call to action/, brand)
})

test('formats: only launch films go landscape or square; unknown formats are refused', () => {
  rejects(walk({ formats: ['16x9'] }), /a walk reel renders in 9x16 only/)
  rejects({ ...pickReel(loadProject(generic), 'todo-promo').spec, formats: ['1x1'] }, /a recorded reel renders in 9x16 only/)
  rejects(launch({ formats: ['4x3' as never] }), /format "4x3" is not one of 9x16, 16x9, 1x1/)
  rejects(launch({ formats: [] }), /"formats" must be a non-empty list/)
  rejects({ ...launch(), style: 'slideshow' }, /"style" must be one of recorded, walk, launch/)
})

test('brand.outro is required only for recorded reels', () => {
  const { spec } = pickReel(loadProject(generic), 'todo-promo')
  rejects(spec, /outro \{ title, cta, lines \} is required for recorded reels/, brand)
  validateSpec(spec, 'todo-promo.json', withOutro)
  validateSpec(launch(), 'launch.json', brand)
})
