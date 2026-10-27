# CrewDash: the showcase

**[CrewDash](https://crewdash.ca)** is staffing-agency software for small agencies: dispatch, the worker app with GPS
clock-in, timesheets, payroll and invoicing. This reel came out of the project promoreel was extracted from.

**▶ [`out/video-01.mp4`](out/video-01.mp4)** · 1080×1920 · 41.8 s · "Losing hours?"

What's in it, and which part of the kit made each piece:

| Part | Scene type / kit piece |
|---|---|
| "Losing hours?" over a photo, then two number cards: 40 → 38 rolls like an odometer, a −2 h badge drops in | `hook` with `cards` and `badge` |
| "Who eats the 2 hours?" with three options; the right one lights up in blue | `quiz` |
| The real app on a phone: GPS clock-in, upload the client's sheet, compare day by day, validate, invoice | `phone` (recorder clips, jump cuts, camera keys, glows, a badge) |
| Tap ripples and the tap sound, from the recorder's own tap log | automatic |
| Word-by-word captions in Meta's safe zone | Whisper captions |
| The 3 × 5 feature grid and the "Book a demo" pill | `end` (the brand's `features` and `outro`) |
| Voice | Chatterbox (`exaggeration` 0.55, `cfgWeight` 0.45; the invoice line on seed 42) |

## What's here

- `out/video-01.mp4`: the finished reel.
- `reels/video-01.json`: its spec, in promoreel's format (the hook's cards were a fixed layout in the original template).
- `brand.json`: CrewDash's colours (ink `#181410`, paper `#EFEBE2`, orange `#FF5A00`, the app's blue `#0071E3`), Inter,
  the 15 features and the outro's two lines.
- `public/brand/logo.svg`: the CrewDash mark. `public/brand/bg-loading-dock.jpg`: the loading-dock photo under every scene.
  The owner made it for this video.

The recordings, the recording flows and the voice files aren't included, because they come from a private build of the
product. So this project shows a real spec and brand next to the video they produced, but it can't be rendered again
from this repo. To make your own, start from `examples/generic`.

The script was written before promoreel's script rules were. Its lines still have ellipses ("Quick question…"), which the
rules now advise against because TTS tends to pause on them.

CrewDash and its mark belong to their owner. They're included as an example, not under this repo's MIT licence. See the
README's licence section.
