# Style: recorded

A vertical reel (1080×1920) made from **real recordings of your app**: the recorder films each flow at phone size and
logs every tap, and the reel zooms onto each tap, draws ripples and cuts out the waiting. A voice reads the script and
Whisper captions it.

**Use it when** the app runs locally and the footage itself is the proof: a promo of a real flow, or a tutorial of one
feature. If you can't run the app, or want a landscape video, use [walk](walk.md) or [launch](launch.md).

## Make one
```bash
npx promoreel init my-app --url http://localhost:3000     # brand.json, reels/first-reel.json, flows/first-flow.flow.json
npx promoreel all my-app                                  # record → voice → captions → render
```
`--style recorded` is the default, so you don't need to pass it.

## The fields you usually edit
| File | Field | What it changes |
|---|---|---|
| `flows/*.flow.json` | `url`, `clips[].steps` | What the recorder does: `goto`, `tap`, `type`, `scroll`, `mark` ([flows](../flows.md)) |
| `reels/<id>.json` | `lines` | The script: `say` for the voice, `text` for the captions, `\|` for a breath |
| | `scenes` | `hook`, `quiz`, `phone`, `terminal`, `showcase`, `end`, in order |
| | `scenes[].clips[].camera` | Zooms onto a recorded tap or focus |
| | `voice.use` | A Kokoro voice (`af_heart`, `am_michael`, …) or `chatterbox` |
| `brand.json` | `colors`, `font`, `logo`, `features`, `outro` | The look, the closing grid and the closing lines |

## A minimal spec
```json
{
  "id": "first-reel",
  "voice": { "use": "af_heart" },
  "lines": [
    { "id": "hook", "say": "Still doing this the slow way?" },
    { "id": "step-1", "say": "Open the app, | and it's right there." }
  ],
  "scenes": [
    { "id": "hook", "type": "hook", "headline": "The slow way?", "lines": [{ "id": "hook" }] },
    {
      "id": "phone", "type": "phone", "clipsDir": "videos/first-flow",
      "clips": [{ "name": "01-open", "from": "loaded-200" }],
      "lines": [{ "id": "step-1", "clip": "01-open", "offsetMs": 300 }]
    },
    { "id": "end", "type": "end" }
  ]
}
```

## Examples
- [`examples/generic`](../../examples/generic): Playwright's TodoMVC demo, the smoke test.
- [`examples/crewdash/reels/video-01.json`](../../examples/crewdash/reels/video-01.json): every scene type, jump cuts,
  glows and a badge.

Every field: [`docs/spec.md`](../spec.md).
