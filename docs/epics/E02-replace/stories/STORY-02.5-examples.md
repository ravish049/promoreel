# STORY-02.5 — Examples: CrewDash and Brindlebook replace ads

## Goal
Two committed examples that show what the style does and how far JSON alone changes the look.

## Done When
- `examples/crewdash/reels/replace.json` (drawn mode):
  - Headline about replacing spreadsheets, group texts and paper timesheets.
  - Tools: spreadsheet, chat, phone, email, calendar, clipboard.
  - A pitch screen whose copy is true to what CrewDash does (dispatch, hours, invoices). It has no user counts, ratings
    or trial offers unless the owner supplies them.
  - The CTA is the brand's.

  If the owner supplies a photo by the time this story starts, `replace-photo.json` uses it.
- `examples/sample-walk/reels/replace.json` for Brindlebook (fictional): its own headline, colours, scribble colour and a
  `list` screen instead of `pitch`, to show a different look.
- Every example renders in 9:16, 4:5 and 1:1 with stills, under `examples/*/out/`. The manifests are updated, and no
  output name clashes with an existing one.
- Contact sheets and stills are reviewed against the checklist, and each mix is −16 to −14 LUFS with a true peak at or
  below −1 dBFS.
- The example READMEs each get one line pointing at the new ad.

## Files
- `examples/crewdash/reels/replace*.json`, `examples/crewdash/out/replace*`, `examples/crewdash/out/manifest.json`, `examples/crewdash/README.md`
- `examples/sample-walk/reels/replace.json`, `examples/sample-walk/out/replace*`, `examples/sample-walk/out/manifest.json`, `examples/sample-walk/README.md`
