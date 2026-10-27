// Unit tests for the pure parts: caption alignment and the timeline's line fitting.   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { align, words } from './align'
import { buildTimeline, type ClipManifest } from '../../src/reel/timeline'
import type { ReelSpec } from '../../src/reel/spec'

const cap = (text: string, startMs: number, endMs: number) => ({ text, startMs, endMs, timestampMs: null, confidence: 1 })

test('words() glues sub-word tokens and drops [BLANK_AUDIO]', () => {
  const w = words([cap(' Your', 0, 100), cap(' client', 100, 300), cap("'s", 300, 350), cap(' [BLANK', 350, 360), cap('_AUDIO]', 360, 370), cap(' sheet', 400, 600)])
  assert.deepEqual(
    w.map((x) => x.text.trim()),
    ['Your', "client's", 'sheet'],
  )
})

test('align() keeps the script spelling and borrows Whisper timings', () => {
  const heard = [cap(' says', 0, 200), cap(' thirty-eight', 200, 700)]
  const out = align(['says', '38.'], heard, 900)
  assert.equal(out[0].text, 'says')
  assert.equal(out[1].text, ' 38.')
  assert.equal(out[0].startMs, 0)
  // "38." was not heard as such: it takes the time after "says"
  assert.ok(out[1].startMs > 0 && out[1].startMs < 900)
})

const manifest: ClipManifest = { name: 'a', file: 'a.mp4', cssWidth: 390, cssHeight: 844, pixelWidth: 1170, pixelHeight: 2532, fps: 30, durationMs: 2000, events: [{ kind: 'mark', label: 'loaded', t: 100 }] }
const spec = (fitLines?: boolean): ReelSpec => ({
  id: 't',
  voice: { use: 'af_heart' },
  lines: [
    { id: 'one', say: 'one' },
    { id: 'two', say: 'two' },
  ],
  scenes: [{ id: 'phone', type: 'phone', clipsDir: 'videos/x', fitLines, clips: [{ name: 'a', rate: 1 }], lines: [{ id: 'one', clip: 'a' }] }, { id: 'end', type: 'end', lines: [{ id: 'two' }] }],
})

test('a phone line longer than its clip slows the clip down', () => {
  const tl = buildTimeline(spec(), { one: 3000, two: 1000 }, { a: manifest })
  assert.ok(tl.fitted.a < 1, 'clip a was slowed')
  assert.equal(tl.warnings.length, 0)
})

test('fitLines: false leaves the clip alone and warns', () => {
  const tl = buildTimeline(spec(false), { one: 3000, two: 1000 }, { a: manifest })
  assert.deepEqual(tl.fitted, {})
  assert.ok(tl.warnings.some((w) => w.includes('past the end')))
})
