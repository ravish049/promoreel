// Lay Whisper's word timings onto the script's own words. Pure functions, so they are unit-tested (align.test.ts).
import type { Caption } from '@remotion/captions'

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** Glue tokens that do not start with a space onto the word before ("client" + "'s"), and drop [BLANK_AUDIO]-style markers. */
export function words(captions: Caption[]): Caption[] {
  const out: Caption[] = []
  let inMarker = false
  for (const c of captions) {
    if (/^\s*\[/.test(c.text)) inMarker = true
    if (inMarker) {
      if (/\]\s*$/.test(c.text)) inMarker = false
      continue
    }
    if (out.length > 0 && !/^\s/.test(c.text)) {
      const w = out[out.length - 1]
      w.text += c.text
      w.endMs = Math.max(w.endMs, c.endMs)
    } else out.push({ ...c })
  }
  return out.filter((w) => w.text.trim() !== '')
}

/** Lay Whisper's word timings onto the script's own words (word-level edit-distance alignment). */
export function align(script: string[], heard: Caption[], lineMs: number): Caption[] {
  const n = script.length
  const m = heard.length
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (norm(script[i - 1]) === norm(heard[j - 1].text) ? 0 : 1))
  const at: (number | null)[] = Array(n).fill(null)
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (d[i][j] === d[i - 1][j - 1] + (norm(script[i - 1]) === norm(heard[j - 1].text) ? 0 : 1)) {
      at[i - 1] = j - 1
      i--
      j--
    } else if (d[i][j] === d[i - 1][j] + 1) i--
    else j--
  }
  const start = script.map((_, k) => (at[k] !== null ? heard[at[k]!].startMs : null))
  // words Whisper did not hear on their own share the time around them
  for (let k = 0; k < n; k++) {
    if (start[k] !== null) continue
    let a = k - 1
    while (a >= 0 && start[a] === null) a--
    let b = k + 1
    while (b < n && start[b] === null) b++
    const t0 = a >= 0 ? start[a]! : 0
    const t1 = b < n ? start[b]! : lineMs
    start[k] = t0 + ((t1 - t0) * (k - a)) / (b - a)
  }
  return script.map((w, k) => ({
    text: k === 0 ? w : ` ${w}`,
    startMs: Math.round(start[k]!),
    endMs: Math.round(k + 1 < n ? start[k + 1]! : lineMs),
    timestampMs: null,
    confidence: at[k] !== null ? heard[at[k]!].confidence : null,
  }))
}
