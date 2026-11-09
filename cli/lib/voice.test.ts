// `promoreel voice` on a walk: the lines it just voiced again lose their old word timings (they belong to the old take),
// so the walk's warnings never come from stale captions.   npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshWords } from '../commands/voice'

const words = {
  inbox: [{ text: 'Every', startMs: 0 }, { text: 'request', startMs: 300 }],
  send: [{ text: 'Send', startMs: 0 }, { text: 'it', startMs: 250 }],
}

test('voice drops the word timings of the lines it re-voiced and keeps the rest', () => {
  assert.deepEqual(freshWords(words, ['send']), { inbox: words.inbox })
  assert.deepEqual(freshWords(words, []), words)
  assert.deepEqual(freshWords(words, ['inbox', 'send']), {})
  // no captions yet: still none
  assert.equal(freshWords(undefined, ['send']), undefined)
})
