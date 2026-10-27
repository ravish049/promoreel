# Flow reference

A flow file (`<project>/flows/<name>.flow.json`) says what to do in the app. `promoreel record` plays it in Chromium at
iPhone size (390×844 CSS px, device scale 3) and films each clip into `public/videos/<name>/`:
- `<clip>.mp4`: 1170×2532, about 30 fps. It's a DevTools capture loop at device pixels, sharper than Playwright's video.
- `<clip>.json`: the clip's length and every event (label, time, box). The reel's zooms, tap ripples, glows and line
  timings come from this file.

Taps and typing are human-paced: a pause before and after each tap (±15 %), and typing key by key.

```json
{
  "name": "signup",
  "url": "http://localhost:3000",
  "hide": [".intercom-launcher", "#cookie-banner"],
  "login": {
    "path": "/login",
    "email": { "label": "Email" },
    "password": { "label": "Password" },
    "submit": { "role": "button", "name": "Sign in" }
  },
  "setup": [{ "goto": "/dashboard" }],
  "clips": [
    {
      "name": "01-create",
      "steps": [
        { "mark": "loaded" },
        { "tap": { "role": "button", "name": "New project" }, "label": "new" },
        { "type": "Launch plan", "into": { "placeholder": "Project name" }, "label": "name", "enter": true },
        { "waitFor": { "text": "Project created" } },
        { "focus": { "text": "Launch plan" }, "label": "created", "card": true },
        { "wait": 800 }
      ]
    }
  ]
}
```

## Top level
| Field | Meaning |
|---|---|
| `name` | The output folder: `public/videos/<name>`. A reel's phone scene points at it with `clipsDir: "videos/<name>"` |
| `url` | The app's base URL. `PROMOREEL_APP_URL` overrides it (e.g. a different port) |
| `login` | Optional sign-in before recording (below) |
| `hide` | CSS selectors hidden for the whole recording: a chat bubble, a cookie banner, a dev toolbar |
| `localStorage` | Keys set before every page load (a theme, a dismissed tour) |
| `colorScheme` | `light` (default) or `dark` |
| `locale`, `timezone` | Default `en-US`, the machine's time zone |
| `geolocation` | `{ latitude, longitude, accuracy? }`: the page's location answers with it (permission granted) |
| `setup` | Steps run before the first clip, not filmed |
| `clips` | `[{ name, steps, leadMs?, tailMs? }]`: each is filmed on its own (lead 500 ms, tail 900 ms by default) |

## Steps
| Step | Does | Logs |
|---|---|---|
| `{ "goto": "/path", "settle": 1200 }` | Opens a page, waits for the network to go quiet, then `settle` ms | – |
| `{ "tap": target, "label": "x" }` | Scrolls it into view, pauses, taps (`before` / `after` ms) | tap + box |
| `{ "type": "text", "into": target, "label": "x", "enter": true }` | Taps, then types key by key (`perKey` ms); `enter` presses Enter after; `clear` empties it first | tap, type, `x-enter` |
| `{ "press": "Enter" }` | Presses a key | mark `press-enter` |
| `{ "wait": 800 }` | Waits | – |
| `{ "waitFor": target, "state": "visible" }` | Waits for something to appear (or `hidden`) | – |
| `{ "scroll": target, "label": "x" }` / `{ "scroll": { "by": 400 } }` | Smooth, thumb-like scroll to an element (centred) or by CSS px | scroll |
| `{ "focus": target, "label": "x", "card": true }` | Logs a box for a zoom or a glow, without touching it. `card` takes the whole row or card around it (`minHeight`, default 120) | focus + box |
| `{ "mark": "loaded" }` | A named moment with no place (trim on it: `"from": "loaded-200"`) | mark |
| `{ "choose": target, "option": "Label" }` | Taps a `<select>` and picks an option | tap |
| `{ "upload": target, "files": ["./sheet.pdf"] }` | Taps a file input and hands it files (paths relative to the flow) | tap |

## Targets
- A string is a CSS or Playwright selector: `"button.primary"`, `"text=Save"`, `"[data-test=save]"`.
- An object picks by what users see: `{ "role": "button", "name": "Save" }`, `{ "text": "Saved" }`,
  `{ "label": "Email" }`, `{ "placeholder": "Search" }`, `{ "testid": "save" }`, `{ "css": "…" }`. Add `"exact": true`
  for an exact match.
- When several elements match, the first is used. `"nth": 2` picks another.

Prefer roles, labels and `data-*` attributes over CSS classes: they survive restyling.

## Signing in
`login` fills the form with credentials from the environment. **They are never read from the file:**
```bash
export PROMOREEL_LOGIN_EMAIL=demo@example.test PROMOREEL_LOGIN_PASSWORD='…'    # a TEST account of your LOCAL app
npx promoreel record projects/my-app
```
- `emailEnv` / `passwordEnv` rename the variables, e.g. for two personas.
- The recorder refuses to sign in to a host that isn't local (`localhost`, `127.0.0.1`, `*.localhost`, `*.test`) unless
  `PROMOREEL_ALLOW_REMOTE_LOGIN=1`. Record a local or staging copy with seed data, never production with real customers.

## Scripted flows
When JSON is not enough (two browser tabs, preparing data through the app's API), write
`flows/<name>.flow.mjs`. It exports `default async function ({ createRecorder, outDir, env, log })`, which uses the
recorder directly and returns the clip manifests:
```js
export default async function ({ createRecorder, outDir, env }) {
  const r = await createRecorder({ base: env.PROMOREEL_APP_URL ?? 'http://localhost:3000', outDir })
  try {
    await r.go('/')
    const a = await r.clip('01-open', async (c) => {
      c.mark('loaded')
      await c.tap(r.page.getByRole('button', { name: 'Start' }), 'start')
    })
    return [a]
  } finally {
    await r.close()
  }
}
```
Clip helpers: `tap`, `type`, `press`, `focus`, `focusCard`, `scrollTo`, `scrollBy`, `mark`, `choose`, `tapForFiles`,
`pause` (see `cli/record/recorder.cjs`).

## Re-recording
- `npx promoreel record projects/my-app signup` records one flow.
- `--only 02-edit` records one clip. Earlier clips' state must already be in place.
- `promoreel all` records only the flows a reel needs that haven't been recorded yet; `--fresh` records them again.
