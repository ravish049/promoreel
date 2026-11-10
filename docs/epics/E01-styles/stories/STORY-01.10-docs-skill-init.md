# STORY-01.10 — Docs, skill and `init --style`

## Goal
A new developer finds the right style in under a minute and gets a working project with one command, without the
README getting deeper.

## Done When
- `README.md`: a "Pick a style" table (recorded / walk / launch: made from, formats, sound, example link), the new
  videos added to the showcase, and the roadmap line about landscape cuts and music removed. Net growth ≤ 20 lines.
- `docs/styles/recorded.md`, `walk.md`, `launch.md`: one page each — when to use it, the one command, the fields you
  edit, a minimal spec. No internals.
- `docs/spec.md` documents `style`, `formats`, `music`, walk steps / anchors / cuts, launch scenes and the screen kit.
- `.claude/skills/promoreel/SKILL.md` and `AGENTS.md`: a "pick a style" step before proposing ideas; record only for
  `recorded`, voice skipped for `launch`; the frontmatter no longer says 9:16 only.
- `promoreel init <dir> --style walk|launch` scaffolds a working spec from `templates/project/reels/` (no flow file
  for walk/launch), and `npx promoreel all <dir>` on the result renders without edits.
- `npm run lint` and `npm test` pass.

## Files
- `README.md`, `AGENTS.md`, `docs/spec.md`, `docs/styles/recorded.md`, `docs/styles/walk.md`, `docs/styles/launch.md`
- `.claude/skills/promoreel/SKILL.md`
- `cli/commands/init.ts`, `templates/project/reels/walk.json`, `templates/project/reels/launch.json`
