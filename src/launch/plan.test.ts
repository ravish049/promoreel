// Unit tests for the launch plan's edge cases: short screen scenes keep every event inside the scene and the press
// before its done state, kinetic words fit the scene, an early click still gets a cursor that starts on screen (and no
// push-in that would finish after it), a one-part tagline plans, an `at` past the scene is moved in with a warning, the
// counter moves to its corner only after its count-up, and a short payoff names the seconds it needs. At 60 and 30 fps.
//   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { LaunchScreen, LaunchSpec } from '../reel/spec'
import { buildLaunchPlan, logoBeats, type LogoPlan, type ScreenPlan } from './plan'

const screen = (over: Partial<LaunchScreen> = {}): LaunchScreen => ({
  id: 'screen',
  kind: 'screen',
  seconds: 6,
  screen: { kind: 'table', columns: ['Client', 'Billed', 'Paid'], rows: [['A', '10', '10']], compare: { columns: [1, 2] }, button: { label: 'Chase all', done: 'Sent' } },
  ...over,
})

const film = (sc: LaunchScreen, music?: LaunchSpec['music']): LaunchSpec => ({
  id: 'launch',
  style: 'launch',
  music,
  scenes: [{ id: 'hook', kind: 'hook', seconds: 2, headline: [{ text: 'Hi.' }] }, sc, { id: 'logo', kind: 'logo', seconds: 3, cta: 'Try it' }],
})

const screenOf = (spec: LaunchSpec, fps: number) => {
  const plan = buildLaunchPlan(spec, fps)
  return { plan, sc: plan.scenes[1] as ScreenPlan }
}

/** Every action, cursor move, zoom and word lands inside the scene, and the press comes before its done state. */
const inside = (plan: ReturnType<typeof buildLaunchPlan>, sc: ScreenPlan, what: string) => {
  const len = sc.scene.to - sc.scene.from
  assert.ok(sc.out >= 0 && sc.out < len, `${what}: the exit starts inside the scene (out ${sc.out}, len ${len})`)
  for (const [k, v] of Object.entries(sc.progress)) assert.ok(v >= 0 && v <= sc.out, `${what}: ${k} at ${v} is inside the scene before its exit (${sc.out})`)
  const c = sc.cursor
  if (c) {
    assert.ok(sc.progress.done! >= c.click, `${what}: done (${sc.progress.done}) is not before the click (${c.click})`)
    assert.ok(c.enter[0] >= 0, `${what}: the cursor enters at ${c.enter[0]}, not before the scene`)
    assert.ok(c.approach[0] >= c.enter[0] && c.approach[0] + c.approach[1] <= c.click + 1, `${what}: on the button by the press`)
    assert.ok(plan.clicks.every((g) => g >= sc.scene.from && g < sc.scene.to), `${what}: the click sound plays in this scene`)
  }
  if (sc.zoom) {
    assert.ok(sc.zoom.in[0] < sc.zoom.in[1] && sc.zoom.in[1] <= c!.click, `${what}: the push-in finishes before the click`)
    assert.ok(sc.zoom.out[0] >= c!.click && sc.zoom.out[1] <= len, `${what}: the pull-out is after the click, inside the scene`)
  }
  for (const w of sc.wordsAt) assert.ok(w >= 0 && w < sc.out, `${what}: word at ${w} lands before the exit (${sc.out})`)
}

test('a short screen scene keeps the press inside the scene and before its done state', () => {
  for (const fps of [60, 30]) {
    for (const seconds of [1, 1.5, 2, 2.5, 3, 4, 7]) {
      const { plan, sc } = screenOf(film(screen({ seconds })), fps)
      assert.ok(sc.cursor, `${seconds} s at ${fps} fps has a cursor`)
      inside(plan, sc, `${seconds} s at ${fps} fps`)
    }
    // the measured case: a 1 s scene used to press at its last frame, after its done state
    const { sc } = screenOf(film(screen({ seconds: 1 })), fps)
    assert.ok(sc.cursor!.click < sc.out, `1 s at ${fps} fps: the press is seen before the exit`)
  }
})

test('without beat sync at 240 bpm a tiny screen scene still exits inside itself', () => {
  for (const fps of [60, 30]) {
    for (const seconds of [0.25, 0.5, 1]) {
      const { plan, sc } = screenOf(film(screen({ seconds }), { bpm: 240, beatSync: false }), fps)
      inside(plan, sc, `${seconds} s unsynced at ${fps} fps`)
    }
  }
})

test('an explicit done before the click is moved to the click, with a warning', () => {
  for (const fps of [60, 30]) {
    const { plan, sc } = screenOf(film(screen({ at: { click: 3, done: 2 } })), fps)
    assert.equal(sc.progress.done, sc.progress.click)
    assert.ok(plan.warnings.some((w) => w.includes('at.done')))
  }
})

test('kinetic words fit the scene: squeezed when the beat would push the last past it, with a warning only when too fast to read', () => {
  for (const fps of [60, 30]) {
    // a 2 s screen with 4 words: on the beat, the 4th would land at 2 s, past the scene
    const { plan, sc } = screenOf(film(screen({ seconds: 2, words: ['One.', 'Two.', 'Three.', 'Four.'] })), fps)
    assert.equal(sc.wordsAt.length, 4)
    for (let i = 1; i < 4; i++) assert.ok(sc.wordsAt[i] > sc.wordsAt[i - 1], 'in order')
    inside(plan, sc, `2 s with 4 words at ${fps} fps`)
    assert.ok(!plan.warnings.some((w) => w.includes('too fast to read')))
    // 10 words in 1.5 s cannot be read
    const dense = screenOf(film(screen({ seconds: 1.5, words: Array.from({ length: 10 }, (_, i) => `W${i}.`) })), fps)
    inside(dense.plan, dense.sc, `1.5 s with 10 words at ${fps} fps`)
    assert.ok(dense.plan.warnings.some((w) => w.includes('too fast to read')))
    // a long scene keeps its words on the beat
    const long = screenOf(film(screen({ seconds: 7, words: ['A.', 'B.', 'C.'] })), fps)
    const beat = long.plan.tl.beat
    for (const w of long.sc.wordsAt) assert.equal(w % Math.round(beat), 0)
  }
})

test('an early click: the cursor starts on the scene, and the push-in is skipped when it cannot finish before the press', () => {
  for (const fps of [60, 30]) {
    for (const click of [0, 0.1, 0.3, 0.6]) {
      const { plan, sc } = screenOf(film(screen({ at: { click } })), fps)
      assert.equal(sc.cursor!.click, Math.round(click * fps))
      inside(plan, sc, `click at ${click} s at ${fps} fps`)
      assert.ok(plan.warnings.some((w) => w.includes('too little time')))
    }
    assert.equal(screenOf(film(screen({ at: { click: 0.1 } })), fps).sc.zoom, undefined)
    // with room for it, the push-in stays
    assert.ok(screenOf(film(screen({ at: { click: 2.5 } })), fps).sc.zoom)
  }
})

test('a one-part tagline plans its beats (the logo draws no accent part)', () => {
  for (const fps of [60, 30]) {
    const spec = film(screen())
    spec.scenes[2] = { id: 'logo', kind: 'logo', seconds: 3, cta: 'Try it', tagline: ['Every invoice, paid.'] }
    const logo = buildLaunchPlan(spec, fps).scenes[2] as LogoPlan
    assert.deepEqual(logo.spec.tagline, ['Every invoice, paid.'])
    const b = logoBeats(logo, 3, fps)
    assert.ok(b.tagEnd >= logo.tagline && b.line > b.tagEnd && b.cta > b.line)
  }
})

test('an at value past the scene is moved inside it, with a warning naming it', () => {
  for (const fps of [60, 30]) {
    const { plan, sc } = screenOf(film(screen({ at: { click: 9 } })), fps)
    inside(plan, sc, `at.click 9 in a 6 s scene at ${fps} fps`)
    assert.ok(plan.warnings.some((w) => w.includes('at.click (9 s)') && w.includes('moved')), plan.warnings.join(' | '))
    // an at inside the scene is left alone, without a warning
    const ok = screenOf(film(screen({ at: { click: 3 } })), fps)
    assert.equal(ok.sc.progress.click, 3 * fps)
    assert.ok(!ok.plan.warnings.some((w) => w.includes('at.click')))
  }
})

test("the counter moves to its corner only after its count-up, even in a short hook", () => {
  for (const fps of [60, 30]) {
    for (const seconds of [1.5, 2, 3, 4]) {
      const spec: LaunchSpec = {
        ...film(screen()),
        counter: { label: 'Waiting', value: 90 },
      }
      spec.scenes[0] = { id: 'hook', kind: 'hook', seconds, headline: [{ text: 'Ninety waiting.' }] }
      const plan = buildLaunchPlan(spec, fps)
      const c = plan.counter!
      const what = `${seconds} s hook at ${fps} fps`
      assert.ok(c.rollUp![1] > c.rollUp![0], `${what}: it rolls up`)
      assert.ok(c.toCorner![0] >= c.rollUp![1], `${what}: the move (${c.toCorner}) starts after the count-up (${c.rollUp})`)
      assert.ok(c.toCorner![1] - c.toCorner![0] >= Math.round((20 * fps) / 60), `${what}: the move takes at least 20 frames at 60 fps`)
      assert.ok(c.toCorner![1] <= plan.tl.scenes[0].to - Math.round((12 * fps) / 60), `${what}: in its corner before the next scene mounts`)
      assert.ok(!plan.warnings.some((w) => w.includes('counter')), `${what}: no warning`)
    }
    // the measured case: a 1.5 s hook rolled to 90 while it moved over 58–78; now it rolls over 30–58, then moves
    if (fps === 60) {
      const spec: LaunchSpec = { ...film(screen()), counter: { label: 'Waiting', value: 90 } }
      spec.scenes[0] = { id: 'hook', kind: 'hook', seconds: 1.5, headline: [{ text: 'Hi.' }] }
      const c = buildLaunchPlan(spec, 60).counter!
      assert.deepEqual([c.rollUp, c.toCorner], [[30, 58], [58, 78]])
    }
    // a 1 s hook is too short for both, and says so
    const short: LaunchSpec = { ...film(screen()), counter: { label: 'Waiting', value: 90 } }
    short.scenes[0] = { id: 'hook', kind: 'hook', seconds: 1, headline: [{ text: 'Hi.' }] }
    assert.ok(buildLaunchPlan(short, fps).warnings.some((w) => w.includes('too short for the counter') && w.includes('1.2 s')))
  }
})

test('a payoff too short for its clear state says how many seconds it needs, never a negative hold', () => {
  for (const fps of [60, 30]) {
    const spec: LaunchSpec = { ...film(screen()), counter: { label: 'Waiting', value: 90 } }
    spec.scenes.splice(2, 0, { id: 'payoff', kind: 'payoff', seconds: 1, cards: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] })
    const w = buildLaunchPlan(spec, fps).warnings.find((x) => x.includes('scene "payoff"'))
    assert.ok(w, `${fps} fps: warns`)
    assert.doesNotMatch(w!, /-\d/, `${fps} fps: no negative number in "${w}"`)
    const need = Number(/"seconds": ([\d.]+)/.exec(w!)?.[1])
    assert.ok(need > 1, `${fps} fps: names the seconds it needs (${w})`)
    // giving it those seconds clears the warning (without beat sync, so the cut lands where asked)
    spec.scenes[2] = { ...spec.scenes[2], seconds: need } as LaunchSpec['scenes'][number]
    spec.music = { beatSync: false }
    assert.ok(!buildLaunchPlan(spec, fps).warnings.some((x) => x.includes('scene "payoff"')), `${fps} fps: ${need} s is enough`)
  }
})
