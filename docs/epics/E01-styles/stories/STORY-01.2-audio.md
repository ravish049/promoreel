# STORY-01.2 — Audio: music bed, sound effects, master

## Goal
Give promoreel background music, sound effects and a loudness master, synthesised in TypeScript (no Python, no
downloads), ported from `scripts/insta-c-music.py`, `insta-c-audio.ts` and `insta-c-master.ts` in `~/crewdash-videos`.

## Done When
- `cli/audio/synth.ts` writes a music bed WAV (48 kHz stereo) from a job: `{ durationMs, bpm, sections: [{atMs, kind:
  'intro'|'build'|'drop'|'resolve'}], sfx: [{atMs, kind: 'whoosh'|'swish'|'riser'|'impact'|'chime'|'click'|'tick'}],
  voiceSpans: [{startMs, endMs}], duckDb, sfxDuckDb }`. Music ducks under voice spans (default −9 dB); peak ≤ −2 dBFS.
- Optional `music.src` (the user's own track, decoded by ffmpeg) replaces the synthesised bed and is ducked the same way.
- `cli/audio/sfx.ts` writes standalone `click.wav` and `tick.wav` (used by the launch style).
- `cli/audio/master.ts` runs a two-pass ffmpeg `loudnorm` on a rendered mp4 to −15 LUFS, true peak ≤ −1.5 dBFS,
  AAC 256k, and reports measured LUFS / true peak as a JSON progress line.
- Output is deterministic: the same job gives byte-identical WAVs (seeded noise).
- Unit tests: ducking lowers gain inside a voice span by the configured dB (±0.5); peak limit holds; determinism.
- `npm run lint` and `npm test` pass. No new npm or pip dependency.

## Files
- `cli/audio/synth.ts`, `cli/audio/sfx.ts`, `cli/audio/master.ts`, `cli/audio/wav.ts`
- `cli/audio/synth.test.ts`
