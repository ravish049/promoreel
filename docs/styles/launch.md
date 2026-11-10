# Style: launch

A launch film set to music, **with no voice**: a kinetic headline, a counter that rolls up, drawn screens with a cursor
that clicks, cards that tick off, and a logo close. It renders in 16:9 (1920×1080), 9:16 (1080×1920) and 1:1
(1080×1080) from one spec.

**Use it when** you need a short launch or announcement video for a landing page, a post or a product page, in more than
one shape, and the message fits in a few words on screen. Keep the screens and claims true to what the app does.

## Make one
Run these inside your clone of promoreel, after the [Quickstart](../../README.md#quickstart-5-minutes) (`git clone`,
`npm install`). `projects/` is git-ignored.
```bash
npx promoreel init projects/my-app --style launch   # brand.json, reels/launch.json (a working example to edit)
npx promoreel all projects/my-app                   # render only: out/launch-16x9.mp4, out/launch.mp4, out/launch-1x1.mp4
```

## The fields you usually edit
| Field (in `reels/launch.json`) | What it changes |
|---|---|
| `formats` | Which shapes to render: `16x9`, `9x16`, `1x1` |
| `counter` | The number that rolls up in the hook and drops to `counterTo` (default 0) in the payoff |
| `scenes[]` | In order, each with `id`, `kind` and `seconds` (a `screen` or `payoff` needs at least 1, and reads well from 1.5): |
| `hook` | `headline`: rows of words; `"accent": true` colours a row |
| `screen` | One drawn `screen` (`list`, `table`, `form`, `stat` or `phone`), `words` over it, and `at` to time its click |
| `payoff` | `cards` that land one by one and tick off |
| `logo` | `tagline`, `line` and `cta` (each falls back to `brand.json` `outro`) |
| `music` | `bpm` (cuts land on the beat), or your own `src` track |

## A minimal spec
```json
{
  "id": "launch",
  "style": "launch",
  "formats": ["16x9", "9x16"],
  "counter": { "label": "Requests waiting", "value": 48 },
  "scenes": [
    { "id": "hook", "kind": "hook", "seconds": 4, "headline": [{ "text": "48 requests waiting." }, { "text": "Sorted.", "accent": true }] },
    {
      "id": "inbox", "kind": "screen", "seconds": 6,
      "screen": { "kind": "list", "title": "New requests", "rows": [{ "title": "Update the price list" }], "button": { "label": "Assign all", "done": "Assigned" } }
    },
    { "id": "payoff", "kind": "payoff", "seconds": 6, "cards": [{ "title": "Assigned", "icon": "users" }, { "title": "Tracked", "icon": "list-checks" }] },
    { "id": "logo", "kind": "logo", "seconds": 5, "cta": "Try it · example.com" }
  ]
}
```

## Example
- [`examples/crewdash/reels/launch.json`](../../examples/crewdash/reels/launch.json): the CrewDash launch film, in all
  three formats.
- `npm run gallery` opens every screen kind in Remotion Studio.

Every field: [`docs/spec.md`](../spec.md#launch).
