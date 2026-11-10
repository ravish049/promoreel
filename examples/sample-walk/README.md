# Example: sample-walk (a feature walk from JSON alone)

**Brindlebook** is a made-up bookings app for small dog-grooming salons. Its name, people, pets, prices and the
`brindlebook.example` address are invented (`.example` is a reserved domain, so it can't point at a real site). There is
no app to record: every screen is drawn by promoreel's screen kit from `reels/walk.json`.

```bash
npx promoreel all examples/sample-walk      # voice (Kokoro, no Python) → captions (Whisper) → both cuts
```
→ `out/walk-long.mp4` (30.6 s), `out/walk-short.mp4` (18.3 s), a contact sheet for each, `out/manifest.json`.

What it shows: a hook over the lit chain of steps, then four steps, each a different kind of screen: a **list** of today's
bookings that tick off and confirm, a **phone** where the owner checks in, a **stat** that rolls up the week's bookings,
and a **form** (an invoice whose fields type in, line items tick in and total rolls up), then the logo, tagline and call to
action. The short cut reuses two of the steps with its own lines, and its tracker lists only those two.

| To change | Edit |
|---|---|
| Name, colours, font, logo, the close's line, tagline and CTA | `brand.json` (`colors`, `font`: any bundled Google Font, `outro`), `public/brand/logo.svg` |
| What the voice says and the captions show | `reels/walk.json` → `lines` (`say` for the ear, `text` for the eye; `\|` is a breath) |
| The screens | `reels/walk.json` → `steps[].screen` (`list`, `table`, `form`, `phone`, `stat`) |
| When things happen on a screen | `steps[].anchors` (`fill`, `count`, `checkRows`, `click`, `done`, pinned to a spoken word) |
| Which steps each cut shows, and its lines | `reels/walk.json` → `cuts.long`, `cuts.short` |
| The voice | `voice.use` (any Kokoro voice, e.g. `am_michael`, or `chatterbox`) |
