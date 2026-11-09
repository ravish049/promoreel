# {{NAME}} reels

A promoreel project with a launch film: a headline, a counter, drawn screens with a cursor, and a logo close, set to
music. No voice, nothing recorded. Edit these, then run `promoreel all <this folder>`:

- `brand.json`: colours, font and logo (files in `public/`), and the close's tagline and call to action (`outro`).
- `reels/launch.json`: the counter, the scenes and how long each runs, and the formats to render (`formats`).
  See `docs/styles/launch.md` and `docs/spec.md` in the promoreel repo.

Renders land in `out/` (`launch-16x9.mp4`, `launch.mp4`, `launch-1x1.mp4`), listed in `out/manifest.json`.
