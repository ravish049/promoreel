# Contributing

Thanks for helping! promoreel is small on purpose, so a short read first.

## Setup
```bash
npm install
npx promoreel doctor
npm run lint && npm test              # typecheck + unit tests (what CI runs)
npx promoreel all examples/generic    # the end-to-end smoke test (needs ffmpeg + Chromium; not run in CI)
```

## What fits
- **Bugs, docs and new scene types** for the template (`src/reel/scenes/`), all themed only through `useTheme()`.
- **Recorder steps** that many apps need (`cli/record/`).
- **Voice providers** behind `VoiceProvider` (`docs/voice-providers.md`). A paid provider is welcome as an opt-in. It
  must never become the default, and it must take its key from the environment only.

## Ground rules
- **Keep the default path free and local.** No API keys, no uploads.
- **Keep `src/reel/timeline.ts` pure.** It's shared by Remotion and the CLI and is unit-tested.
- **Nothing brand-specific in `src/`.** Brands live in `brand.json`.
- **Every CLI step reports through `cli/lib/progress.ts`** (JSON lines). Don't print to stdout directly.
- **A visual change comes with proof.** Attach a contact sheet to the PR
  (`npx promoreel sheet <video> out.png --at …`) and re-render `examples/generic`.
- **Never commit credentials, private footage, or anything from `projects/` or `apps/`.**

## Pull requests
Keep them small and focused, describe what changed and why, and fill in the template's checklist. By contributing you
agree your work is released under the MIT licence.

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
