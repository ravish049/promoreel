# {{NAME}} reels

A promoreel project with a feature walk: drawn screens, a voice-over, captions and music. Nothing is recorded. Edit
these, then run `promoreel all <this folder>`:

- `brand.json`: colours, font and logo (files in `public/`), and the close's tagline and call to action (`outro`).
- `reels/walk.json`: the script (`lines`), one drawn screen per step (`steps`), and the cuts to render (`cuts`).
  See `docs/styles/walk.md` and `docs/spec.md` in the promoreel repo.

Renders land in `out/` (`walk-long.mp4`, `walk-short.mp4`), listed in `out/manifest.json`.
