# STORY-01.12 — Final review fixes (docs, agent checklist, small edge cases)

## Goal
Close the findings of the final review so a new developer's first steps work, and the agent checks walk and launch
videos against the right checklist.

## Done When
- README and `docs/styles/*.md` use `npx promoreel init projects/my-app --style …` (git-ignored folder), placed after
  the Quickstart's clone + `npm install`; nothing suggests `promoreel` is on npm.
- `.claude/skills/promoreel/review.md` has a short walk/launch section (safe zone, tracker, captions, 16:9/1:1 edges,
  loudness; no phone-scene / timeline.json checks for them); SKILL.md points walk/launch at it.
- `docs/spec.md` and `docs/styles/launch.md` state the 1 s minimum for screen/payoff scenes; the launch `tagline`
  second part shown as optional; `docs/styles/walk.md` says `voice.use` is required; README alt text and
  "The footage is real" no longer imply every style is a 1080×1920 recording.
- The payoff "clear state holds" warning says how many seconds the scene needs (never a negative hold).
- `voice` ignores old word timings for lines it just re-voiced; `all` prints each walk warning once.
- Launch `at` values clamped to the scene print a warning; the counter's move to its corner starts after its count-up.
- `--style` without a value is rejected.
- `src/launch/context.ts`: doc comments on the right functions.
- `npm run lint` and `npm test` pass.

## Files
- `README.md`, `docs/spec.md`, `docs/styles/*.md`, `docs/media/how-it-works.svg` (text only)
- `.claude/skills/promoreel/SKILL.md`, `.claude/skills/promoreel/review.md`
- `cli/commands/voice.ts`, `cli/commands/all.ts`, `cli/commands/captions.ts`, `cli/index.ts`, `cli/commands/init.ts`
- `src/launch/plan.ts`, `src/launch/context.ts`, tests
