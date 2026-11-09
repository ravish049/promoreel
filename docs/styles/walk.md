# Style: walk

A voiced feature walk (1080×1920): **drawn screens**, one step at a time, along a path with a labelled step tracker,
captions, music and a logo close. You describe each screen in JSON (a list, a table, a form, a phone, a number), so
there is nothing to record. One spec renders several cuts, for example a 35-second walk and a 15-second ad.

**Use it when** you want to show how several features fit together, the app isn't easy to run or film, or the real
screens hold data you can't show. Keep the screens and claims true to what the app does.

## Make one
```bash
npx promoreel init my-app --style walk     # brand.json, reels/walk.json (a working example to edit)
npx promoreel all my-app                   # voice (Kokoro) → captions → out/walk-long.mp4, out/walk-short.mp4
```

## The fields you usually edit
| Field (in `reels/walk.json`) | What it changes |
|---|---|
| `lines` | The script: `say` for the voice, `text` for the captions, `\|` for a breath |
| `steps[]` | One stop each: `label` and `icon` for the tracker, and the `screen` it draws |
| `steps[].screen` | `kind`: `list`, `table`, `form`, `stat`, or `phone` around one of those, with its rows, fields and button |
| `steps[].anchors` | When the screen moves, pinned to a spoken word: `{ "click": { "word": "send" } }` |
| `cuts` | Which steps each video shows and which lines it speaks. Each cut is its own video |
| `hook`, `close` | The opening headline, and the close's tagline and call to action |
| `voice.use`, `music` | The voice (Kokoro by default, or `chatterbox`) and the music bed (`bpm`, `beatSync`, or your own `src`) |

Colours, font, logo and the fallback tagline and CTA come from `brand.json`.

## A minimal spec
```json
{
  "id": "walk",
  "style": "walk",
  "voice": { "use": "af_heart" },
  "lines": [
    { "id": "inbox", "say": "Every request lands in one list." },
    { "id": "cta", "say": "Try it free today." }
  ],
  "steps": [
    {
      "id": "inbox", "label": "Inbox", "icon": "list-checks",
      "screen": { "kind": "list", "title": "New requests", "rows": [{ "title": "Update the price list" }, { "title": "Order paper" }] },
      "anchors": { "checkRows": { "word": "list" } }
    }
  ],
  "cuts": { "main": { "steps": [{ "step": "inbox", "lines": ["inbox"] }], "logo": { "lines": ["cta"] } } },
  "close": { "cta": "Try it · example.com" }
}
```
With one cut the video is `out/walk.mp4`; with several, `out/walk-<cut>.mp4`.

## Examples
- [`examples/sample-walk`](../../examples/sample-walk): Brindlebook, a made-up bookings app. Four steps (list, phone,
  stat, form) and two cuts, voiced with Kokoro.
- [`examples/crewdash/reels/walk.json`](../../examples/crewdash/reels/walk.json): CrewDash from dispatch to invoice,
  with a table that compares two columns, and a Chatterbox voice.
- `npm run gallery` opens every screen kind in Remotion Studio.

Every field: [`docs/spec.md`](../spec.md#walk).
