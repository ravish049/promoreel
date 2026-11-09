# Spec reference

A video is one JSON file in `<project>/reels/<id>.json`. Its `style` says what kind of video it makes:

| `style` | Made from | Sections |
|---|---|---|
| `recorded` (default) | Recordings of your app, a voice and captions | [Recorded](#recorded) |
| `walk` | Drawn screens, a voice, captions and music | [Walk](#walk), [The screen kit](#the-screen-kit) |
| `launch` | Drawn screens and music, no voice | [Launch](#launch), [The screen kit](#the-screen-kit) |

The CLI merges the project's `brand.json` into the spec and hands both to Remotion. The authoritative types are in
[`src/reel/spec.ts`](../src/reel/spec.ts) and the checks in [`cli/lib/project.ts`](../cli/lib/project.ts) (`validateSpec`);
this page explains them. A short page per style: [`docs/styles/`](styles).

Working examples:
- [`examples/generic/reels/todo-promo.json`](../examples/generic/reels/todo-promo.json): recorded; hook, quiz, phone, end.
- [`examples/promoreel-promo/reels/promoreel-promo.json`](../examples/promoreel-promo/reels/promoreel-promo.json): recorded;
  hook with cards, terminal, showcase, end.
- [`examples/crewdash/reels/video-01.json`](../examples/crewdash/reels/video-01.json): recorded; everything, including
  jump cuts, glows and a badge.
- [`examples/sample-walk/reels/walk.json`](../examples/sample-walk/reels/walk.json) and
  [`examples/crewdash/reels/walk.json`](../examples/crewdash/reels/walk.json): walks with two cuts.
- [`examples/crewdash/reels/launch.json`](../examples/crewdash/reels/launch.json): a launch film in three formats.

## Every style
| Field | Default | Meaning |
|---|---|---|
| `id` | required | File-safe name: `out/<id>.mp4`, `public/vo/<id>/…` |
| `style` | `recorded` | `recorded`, `walk` or `launch` |
| `title` | `id` | Shown in `out/manifest.json` (and a future studio's gallery) |
| `formats` | `["9x16"]` | The canvases to render: `9x16` (1080×1920), `16x9` (1920×1080), `1x1` (1080×1080). Only `launch` takes `16x9` and `1x1`. Each is its own file: `out/<id>.mp4`, `out/<id>-16x9.mp4`, `out/<id>-1x1.mp4` |
| `fps` | recorded 30, walk and launch 60 | Frames per second |
| `crf` | 18 | H.264 quality for `render`: 18 is near-lossless; 23–26 gives files about a third the size that still read sharp. `--crf` overrides it |

### `music` (walk and launch)
A music bed, synthesised locally on a beat grid, or your own track. Sound effects (swishes, clicks) are added for you,
and the mix is mastered with ffmpeg.

| Field | Default | Meaning |
|---|---|---|
| `bpm` | walk 112, launch 120 | Tempo of the synthesised bed, 40–240 |
| `src` | none | Your own track in `public/` instead of the synthesised bed (ducked under the voice in a walk). Give its `bpm` for beat sync |
| `gainDb` | 0 | Level of the bed before ducking, dB |
| `beatSync` | walk off, launch on | Move each scene cut onto the nearest beat (in a walk, never into a spoken word) |

## Recorded
A 1080×1920 reel: phone recordings of the app, zooms, a voice and captions.

| Field | Default | Meaning |
|---|---|---|
| `width`, `height` | 1080, 1920 | The template is laid out for 1080×1920 |
| `voice` | required | See below |
| `captions.model` | `base.en` | Whisper model (`tiny.en`, `base.en`, `small.en`, `medium.en`, …); `small.en` reads names back better |
| `captions.hideIn` | `[]` | Scene ids with no captions |
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

### Scenes
Every scene has `id` and `type`. The talking scenes (`hook`, `quiz`, `terminal`, `showcase`, `end`) also take:
- `lines: [{ id, gapBeforeMs? }]`, played one after another (`gapBeforeMs` defaults to 350);
- `leadMs` (default 250), the silence before the first line;
- `tailMs` (default 400), the hold after the last line.

#### `hook`: the question
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

#### `quiz`: three options, the right one lights up
| Field | Meaning |
|---|---|
| `question` | The words of the question |
| `options` | 2–4 options |
| `answer` | The index of the right option |
| `revealLine` | The line at which the answer lights up |
| `foot` / `footAtWord` | A small accent line under the options, shown at a word |
| `highlight` | Words of the question drawn in the accent colour (default: words with a digit) |

#### `phone`: the recordings
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

#### `terminal`: a CLI walkthrough
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

#### `showcase`: a finished video in a frame
| Field | Meaning |
|---|---|
| `src` | A video in `public/`, or a path relative to the project (e.g. `../generic/out/todo-promo.mp4`), which the CLI copies to `public/_staged/` |
| `fromMs`, `rate` | Where to start and how fast. It plays muted |
| `label` | A pill over the frame ("The result") |

#### `end`: the shared close
The feature grid, tagline and CTA come from `brand.json`, and so does the voice (`outro.lines`). An `end` scene needs no
lines. Override `title` or `cta` for one reel.

## Walk
A 1080×1920 feature walk: one drawn screen per step, a step tracker, a voice, captions and music. Nothing is recorded.
`voice` and `lines` work as in a recorded reel ([`voice`](#voice), [`lines[]`](#lines)).

| Field | Default | Meaning |
|---|---|---|
| `voice` | required | As above |
| `captions.model` | `base.en` | Whisper model |
| `music` | synthesised, 112 bpm | See [`music`](#music-walk-and-launch) |
| `lines` | required | The script |
| `steps` | required | The stops of the walk (below) |
| `cuts` | required, at least one | The videos to render from the steps and lines (below) |
| `hook` | none | `{ headline, sub? }`: the opening over the lit chain of steps. A cut shows it only if it has a `hook` |
| `close` | `brand.outro` | `{ title?, tagline?: [words, accentWords?], cta? }`: the logo close. A CTA is required here or in `brand.outro.cta` |
| `pace` | `{ leadMs: 350, gapMs: 800, tailMs: 400, minMs: 2400, endHoldMs: 1000 }` | Default timing of every scene, ms: before its first line, between lines, after its last line, its shortest length, and the hold after the close |

### `steps[]`
| Field | Meaning |
|---|---|
| `id` | Unique; not `hook` or `logo` |
| `label`, `icon` | The tracker's label ("Invoice") and icon (a name from [`src/reel/icons.tsx`](../src/reel/icons.tsx)) |
| `screen` | The drawn screen: see [The screen kit](#the-screen-kit) |
| `anchors` | When things happen on the screen: `{ "<action>": <anchor> }`. The actions are `click`, `checkRows`, `fill`, `count` and `done`; a screen ignores the ones it has no use for. Without an anchor, the walk picks a moment for each action |

**Anchors** pin a moment to the voice:
- `{ "line": "invoice", "word": "send", "offsetMs": 250 }`: the moment the voice says "send" in that line, plus 250 ms.
  `word` is the word's text or its index (negative counts from the end). Without `line`, the scene's first line; without
  `word`, the line's start.
- `{ "scene": "logo", "offsetMs": -500 }`: the start of a scene (`hook`, a step id, or `logo`).

### `cuts`
Each cut is its own video: `out/<id>.mp4` when there is one cut, `out/<id>-<cut>.mp4` when there are several.

| Field | Meaning |
|---|---|
| `hook` | `{ lines, minMs?, leadMs?, tailMs? }`: open on the spec's `hook` while these lines play. Leave it out to start on the first step |
| `steps` | `[{ step, lines, minMs?, leadMs?, tailMs?, anchors? }]`: the steps this cut shows, in order, and the lines spoken over each. The tracker lists only these. `anchors` overrides the step's own for this cut |
| `logo` | `{ lines, minMs?, anchors? }`: the close. Its anchors `name`, `tagline` and `cta` time the three parts |
| `tracker` | `numbered` ("Step 2 of 3 · Invoice", default) or `title` (just the label) |
| `hideCaptionsIn` | Scene ids with no captions (default `["hook", "logo"]`, whose own words are on screen) |

A scene lasts as long as its lines (plus lead, gaps and tail), and never less than `minMs`. `render` warns when an
anchor can't be placed, a line repeats in a cut, or a screen is still filling when its step ends.

## Launch
A launch film with music and click sounds and **no voice**, in any of the three formats. Each scene runs a set number of
seconds.

| Field | Default | Meaning |
|---|---|---|
| `formats` | `["9x16"]` | Any of `16x9`, `9x16`, `1x1` |
| `music` | synthesised, 120 bpm, beat-synced | See [`music`](#music-walk-and-launch) |
| `counter` | none | `{ label, value }`: a number that rolls up in the hook, waits in a corner, and drops in the payoff |
| `scenes` | required | In order. Every scene has `id`, `kind` and `seconds` (> 0; at least 1 for `screen` and `payoff`, 1.5 or more reads well); cuts move onto the nearest beat |

`voice` and `lines` are not used (the CLI notes it if they are there).

| `kind` | Fields |
|---|---|
| `hook` | `headline`: `[{ text, accent? }]`, one row each, `accent` rows in the accent colour. `counter` (default `true` when the spec has one): show the counter rolling up |
| `screen` | `screen`: a [screen kit](#the-screen-kit) screen with a cursor that travels and clicks. `at`: `{ click?, checkRows?, fill?, count?, done? }` in seconds into the scene (defaults are chosen for you). `words`: short words over the screen, one per beat (`["Check.", "Retype.", "Repeat."]`) |
| `payoff` | `cards`: `[{ title, icon?, lines?, done? }]` that land one by one, then tick off. `words`, as above. `counterTo`: where the counter drops (default 0) |
| `logo` | The brand's logo builds, then `title` (default `brand.name`), `tagline` (`[words, accentWords?]`, the accent part optional, default `brand.outro.tagline`), `line` (default `brand.outro.title`) and a `cta` pill (default `brand.outro.cta`; one of the two is required) |

## The screen kit
The screens in walks and launch films are drawn from JSON. Every screen has a `kind`, and all but `phone` can carry a
heading: `title`, `subtitle`, `icon`, and a `badge` pill. A `button` is `{ label, busy?, done? }` ("Send" → "Sending…"
→ "Sent"). Icons are names from [`src/reel/icons.tsx`](../src/reel/icons.tsx). `npm run gallery` opens every kind in
Remotion Studio.

Each screen moves on the five actions that walk `anchors` and launch `at` time: `checkRows` (rows tick off one by one),
`fill` (fields and line items fill in), `count` (numbers roll to their values), `click` (the cursor or a finger presses
the button or the phone's action) and `done` (the button shows its done label). A screen skips the ones it has nothing
for.

| `kind` | Required | Other fields |
|---|---|---|
| `list` | `rows`: `[{ title }]` | per row: `subtitle`, `value` (right-aligned), `tag` + `tagTone` (`accent`, `highlight`, `success`, `muted`), `initials` or `icon`; `button` |
| `table` | `columns`: `["…"]`; `rows`: one string per column | `compare: { columns: [i, j], diffLabel? }` marks rows that differ between two columns; `summary` (a line under the table); `button` |
| `form` | `fields` (`[{ label, value }]`) or `items` (`[{ label, detail?, amount }]`) | `total: { label, value }`; `button` |
| `stat` | `value` (a whole number), `label` | `from` (default 0), `prefix` ("$"), `suffix` (" h") |
| `phone` | `screen`: a `list`, `table`, `form` or `stat` | `action: { label, icon?, done? }` (a big round button), `tabs: [{ label, icon }]`, `activeTab`, `statusBarTime` |

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
| `outro` | `{ title, tagline?: [words, accentWords], cta, lines: [...], gapMs?, tailMs? }`: the same close in every recorded reel of the project (required for them). Walks and launch films use its `title`, `tagline` and `cta` when the spec doesn't set its own |

## Layout constants
- Captions and key text stay inside Meta's safe zone for Reels: x 65–1015, y 269–1248 (`SAFE` in `theme.tsx`).
- The phone shows a 390×844 CSS-px viewport (the recorder's size). Record at that size.
