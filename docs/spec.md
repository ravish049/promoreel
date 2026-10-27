# Spec reference

A reel is one JSON file in `<project>/reels/<id>.json`. The CLI merges the project's `brand.json` into it and hands both
to Remotion. The authoritative types are in [`src/reel/spec.ts`](../src/reel/spec.ts); this page explains them.

Working examples:
- [`examples/generic/reels/todo-promo.json`](../examples/generic/reels/todo-promo.json): hook, quiz, phone, end.
- [`examples/promoreel-promo/reels/promoreel-promo.json`](../examples/promoreel-promo/reels/promoreel-promo.json): hook with
  cards, terminal, showcase, end.
- [`examples/crewdash/reels/video-01.json`](../examples/crewdash/reels/video-01.json): everything, including jump cuts,
  glows and a badge.

## Top level
| Field | Default | Meaning |
|---|---|---|
| `id` | required | File-safe name: `out/<id>.mp4`, `public/vo/<id>/…` |
| `title` | `id` | Shown in `out/manifest.json` (and a future studio's gallery) |
| `fps`, `width`, `height` | 30, 1080, 1920 | The template is laid out for 1080×1920 |
| `voice` | required | See below |
| `captions.model` | `base.en` | Whisper model (`tiny.en`, `base.en`, `small.en`, `medium.en`, …); `small.en` reads names back better |
| `captions.hideIn` | `[]` | Scene ids with no captions |
| `crf` | 18 | H.264 quality for `render`: 18 is near-lossless; 23–26 gives files about a third the size that still read sharp. `--crf` overrides it |
| `sfx.tap` / `sfx.tapVolume` | `sfx/tap.wav`, 0.3 | The tap sound on every recorded tap; `false` turns it off |
| `transitionFrames` | 12 | Frames of the crossfade (or the hook's slide) into each scene |
| `photo` | `brand.photo` | A photo under every scene (in `public/`); none = a gradient from the brand colours |
| `look.cards` | `brand.look.cards` | `solid` (paper cards, ink words) or `glass` (frosted) |
| `lines` | required | The script (below) |
| `scenes` | required | In order (below) |

### `voice`
| Field | Meaning |
|---|---|
| `use` | The voice the video plays. One of: a Kokoro voice (`af_heart`, `af_bella`, `am_michael`, `bf_emma`, `bm_george`, … or `kokoro:af_heart`); `chatterbox`; or `<provider>:<voice>` for a provider you add |
| `render` | Extra voices to render for comparison. Each gets a listening sample in `out/voices/` |
| `speed` | Base speed for every line (1 = normal) |
| `speedByVoice` | Per-voice factor, e.g. `{ "am_michael": 1.08 }` for a slow voice |
| `dtype` | Kokoro precision: `fp32` (best, ~330 MB download), `fp16`, `q8` (~90 MB) |
| `chatterbox` | `{ exaggeration (0.25–2, default 0.5), cfgWeight (default 0.5; lower = slower), seed (default 7) }` |
| `volume` | Voice volume, 0–1 |

### `lines[]`
| Field | Meaning |
|---|---|
| `id` | Referenced by scenes |
| `say` | What the voice says, spelled for the ear ("thirty-eight", "Crew Dash"). `\|` marks a breath |
| `text` | What the captions show, word for word ("38", "CrewDash"). Defaults to `say` |
| `speed` | This line's speed (vary 0.95–1.05) |
| `pauseMs` | The breath at each `\|` (default 300). Kokoro only; Chatterbox reads `\|` as a comma |
| `seed` | Chatterbox: another take of this line (when Whisper's read-back shows a slurred word) |

Lines are **timed automatically**. Talking scenes last as long as their lines. Phone lines sit on recorded events, and a
clip that is too short for its line is slowed down until the line fits (see `fitLines`).

## Scenes
Every scene has `id` and `type`. The talking scenes (`hook`, `quiz`, `terminal`, `showcase`, `end`) also take:
- `lines: [{ id, gapBeforeMs? }]`, played one after another (`gapBeforeMs` defaults to 350);
- `leadMs` (default 250), the silence before the first line;
- `tailMs` (default 400), the hold after the last line.

### `hook`: the question
| Field | Meaning |
|---|---|
| `headline` | Big words over the backdrop, sized to fit, the last word in the accent colour ("Losing hours?") |
| `sub` | A smaller line under the headline |
| `cards` | Up to two number cards. Each is `{ label, value, from?, unit?, atWord?, icon?, glyph? }` |
| `cardsLine` | The line at which the cards replace the headline |
| `badge` | `{ text, atWord? }`: a tilted accent pill that drops in when the voice says `atWord` |

How the cards move:
- A card with `from` counts like an odometer, landing when the voice says `value` (or `atWord`).
- The second card appears at its `atWord`.
- `icon` is any name from `src/reel/icons.tsx`. `glyph` is a short text such as `"$"`.

### `quiz`: three options, the right one lights up
| Field | Meaning |
|---|---|
| `question` | The words of the question |
| `options` | 2–4 options |
| `answer` | The index of the right option |
| `revealLine` | The line at which the answer lights up |
| `foot` / `footAtWord` | A small accent line under the options, shown at a word |
| `highlight` | Words of the question drawn in the accent colour (default: words with a digit) |

### `phone`: the recordings
| Field | Meaning |
|---|---|
| `clipsDir` | `videos/<flow name>`: where `promoreel record` put the clips |
| `clips[]` | One entry per clip shown, in order. A new clip crossfades in (`cutFrames`, default 6) |
| `lines[]` | `{ id, clip, event?, offsetMs? }`: a line pinned to a clip's event (or its first shown frame), offset in output ms |
| `fitLines` | Default `true`: slow a clip (to at most 0.4× its set speed) when its line needs more time. The CLI reports it |
| `statusBarTime` / `statusBarColor` | The phone's status bar. Match the colour to your app's top edge |

**Clip entries:**
| Field | Meaning |
|---|---|
| `name` | The clip's name in the flow |
| `from` / `to` / `rate` | A trim in source ms or event labels (`"loaded"`, `"loaded+350"`, `"tap-x-200"`), and a speed (taps hold up to ~2.5×) |
| `segments` | `[{ from, to, rate }]`: jump cuts. Only these ranges play, back to back, each at its own speed. Use them to drop waits |
| `camera` | `[{ event \| atMs, offsetMs?, scale, focus, moveMs? }]`: zoom keyframes. `focus` is an event label, `{ event, fx, fy }` (a point in its box), `{ x, y }` (CSS px), or `"center"`. The camera moves over `moveMs` (default 600) and arrives at the moment |
| `glow` | `[{ event, untilEvent?, color?, pad? }]`: a pulsing outline on an event's box. `color` is `accent`, `highlight` or `success` |
| `badges` | `[{ event, text, untilEvent?, icon? }]`: a label pill under an event's box |
| `taps` | `false` hides this clip's tap ripples |

Event labels come from the flow: every `tap`, `type`, `focus`, `scroll` and `mark` step logs its label with a time and a box.
A repeated label gets `-2`, `-3`. Open `public/videos/<flow>/<clip>.json` to see them.

### `terminal`: a CLI walkthrough
| Field | Meaning |
|---|---|
| `title` | The window title, e.g. `~/my-app` |
| `commands[]` | `{ atLine, offsetMs?, step?, cmd, output?, progress? }` |

How it plays:
- Each command types out when its line starts.
- Its output lines appear while the line is spoken. An output line is a string, or `{ text, tone }` with tone `muted`,
  `plain`, `ok` or `accent`.
- `progress: true` adds a bar that fills.
- `step` names a pill in the row above the window ("Record", "Voice", "Render"). It lights while its command runs.
- When the next command starts, an earlier one folds to its last output line.

Keep the output honest. Paste real output from your tool.

### `showcase`: a finished video in a frame
| Field | Meaning |
|---|---|
| `src` | A video in `public/`, or a path relative to the project (e.g. `../generic/out/todo-promo.mp4`), which the CLI copies to `public/_staged/` |
| `fromMs`, `rate` | Where to start and how fast. It plays muted |
| `label` | A pill over the frame ("The result") |

### `end`: the shared close
The feature grid, tagline and CTA come from `brand.json`, and so does the voice (`outro.lines`). An `end` scene needs no
lines. Override `title` or `cta` for one reel.

## `brand.json`
| Field | Meaning |
|---|---|
| `name` | The product name (the logo fallback uses its first letter) |
| `colors` | `ink` (dark base), `paper` (light base), `accent` (brand colour), `highlight` (the "right answer" colour, default `#0071E3`), `success` |
| `font` | `Inter` (default), `Manrope`, `DM Sans`, `Plus Jakarta Sans`, `Poppins`, `Space Grotesk` (all OFL, loaded from Google Fonts at render), or `{ "family": "Brand Sans", "file": "brand/BrandSans.woff2" }` |
| `logo` | A square SVG or PNG in `public/` |
| `photo` | A portrait photo in `public/` (about 9:16, ≥ 1080 px wide is best; the blur hides softness) |
| `look.cards` | `solid` or `glass` |
| `features` | Up to 15 `{ label, icon }` for the closing grid (3 columns). Icons are names from `src/reel/icons.tsx` (Lucide) |
| `outro` | `{ title, tagline?: [words, accentWords], cta, lines: [...], gapMs?, tailMs? }`: the same close in every reel of the project |

## Layout constants
- Captions and key text stay inside Meta's safe zone for Reels: x 65–1015, y 269–1248 (`SAFE` in `theme.tsx`).
- The phone shows a 390×844 CSS-px viewport (the recorder's size). Record at that size.
