# Example: generic (the smoke test)

A ~33 s reel of [Playwright's public TodoMVC demo](https://demo.playwright.dev/todomvc), a page made for testing
automation. It needs no app of your own and no login, so it's the first thing to run:

```bash
npx promoreel all examples/generic --pretty      # records → voices (Kokoro) → captions (Whisper) → renders
```
→ `out/todo-promo.mp4` (1080×1920, ~33 s), `out/todo-promo-sheet.png`, `out/manifest.json`.

| File | What |
|---|---|
| `flows/todos.flow.json` | Three clips: add three to-dos, tick two off, filter and clear |
| `reels/todo-promo.json` | Question hook → quiz → the phone part (jump cuts, zooms, a glow on the counter) → outro |
| `brand.json` | Red accent, DM Sans, a gradient backdrop (no photo), six features |
| `public/brand/logo.svg` | The example's logo |

What it shows off:
- `segments` (jump cuts over the typing);
- camera keys on tap and focus events;
- `glow`;
- `statusBarColor` matched to the demo's yellow banner;
- automatic line fitting: clip `02-done` is slowed so its line fits, and `promoreel voice` says so;
- the default Kokoro voice.

The demo site belongs to the Playwright project. If it changes its markup, the flow's selectors (`ul.todo-list`,
`.todo-count`, the placeholder "What needs to be done?") may need an update.
