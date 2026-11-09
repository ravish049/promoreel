# E01 — Styles: feature walk and launch film

## Goal
Any developer can make two new kinds of video from JSON alone, with no React and no app recording:

| Style | What it is | Formats | Sound |
|---|---|---|---|
| `recorded` (today, unchanged) | Phone recordings of your app, zooms, captions | 9:16 | Voice + captions |
| `walk` | A voiced feature walk: drawn screens one step at a time along a path, a labelled step tracker, captions, logo + CTA. Long cut and ad cut from one spec | 9:16 | Voice + music + sound effects |
| `launch` | A launch film: kinetic headline, a counter, drawn screens with a cursor, checkmarks, logo + CTA | 16:9, 9:16, 1:1 | Music + clicks, no voice |

Source: the CrewDash launch film and Instagram reel variation C (`~/crewdash-videos`, `src/launch/` and `src/insta/c/`),
made generic. Their CrewDash screens are traced from the real app; here they become a small **screen kit** of JSON
primitives (list, table, form, phone, stat) so anyone can describe their own screens.

## Principles
- Free and local stays true: music and sound effects are synthesised in TypeScript, voice is Kokoro or Chatterbox,
  mastering is ffmpeg. No Python needed beyond the existing optional Chatterbox.
- Nothing brand-specific in `src/`: colours and fonts from `useTheme()`, copy from the spec.
- The `recorded` style and existing examples render exactly as before.
- README grows by about 15 lines; depth goes into `docs/styles/*.md` and example READMEs.
- The two v4 notes are fixed by design: the step label crossfades, and the tracker shows only the steps a cut contains.

## Stories
| Story | Name | Depends on |
|---|---|---|
| 01.1 | Motion engine | — |
| 01.2 | Audio: music bed, sound effects, master | — |
| 01.3 | Spec and CLI: style, formats, optional voice | — |
| 01.4 | Screen kit | 01.1 |
| 01.5 | Walk timeline (pure) | 01.3 |
| 01.6 | Walk composition | 01.1, 01.2, 01.4, 01.5 |
| 01.7 | Launch composition | 01.1, 01.2, 01.3, 01.4 |
| 01.8 | Walk examples | 01.6 |
| 01.9 | Launch examples | 01.7 |
| 01.10 | Docs, skill and `init --style` | 01.3 |
| 01.11 | Bigger phone screens, walk warnings everywhere (added after batch 4 review) | 01.6, 01.8 |
| 01.12 | Final review fixes: docs, agent checklist, small edge cases (added after the final review) | 01.10 |

## Batch plan
No two stories in one batch touch the same file. Each worker builds its story in its own worktree off
`epic/e01-styles`; the coordinator merges, then runs the gate.

| Batch | Stories (parallel) | Why this grouping |
|---|---|---|
| 1 | 01.1 · 01.2 · 01.3 | Independent foundations: `src/motion/`, `cli/audio/`, spec + CLI |
| 2 | 01.4 · 01.5 | Screen kit needs the engine; walk timeline needs the spec types |
| 3 | 01.6 | Walk composition registers in `src/Root.tsx` |
| 4 | 01.7 · 01.8 | Launch registers in `src/Root.tsx`; walk examples touch only `examples/` |
| 5 | 01.11 · 01.10 | Phone size + re-render walk examples; docs, README, skill and `init` |
| 6 | 01.9 · 01.12 | Launch examples (writes `examples/crewdash/out/manifest.json`, which 01.11 also writes); final review fixes |

## Gate after every batch
- `npm run lint` and `npm test` pass.
- `npx promoreel all examples/generic` still renders (the `recorded` smoke test).
- From batch 3: render every new example, read the contact sheets against `.claude/skills/promoreel/review.md`
  (safe zone, overlaps, nothing off canvas), and check loudness (−16 to −14 LUFS, true peak ≤ −1 dBFS).
- A review agent reads the batch diff for bugs and brand-specific leaks into `src/`.

## Out of scope
- High-fidelity CrewDash screens (they stay in `~/crewdash-videos`).
- Project-local React components, landscape `recorded` reels, paid voices, the web Studio.

## Delivery
One PR from `epic/e01-styles` to `main` with a report. The owner merges.
