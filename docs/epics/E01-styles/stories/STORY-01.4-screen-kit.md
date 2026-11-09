# STORY-01.4 — Screen kit

## Goal
A small set of drawn UI screens that anyone describes in JSON, so walk and launch videos show the user's own product
without React or a recording. Built from the parts in `~/crewdash-videos/src/insta/c/parts.tsx` and `steps.tsx`, with
every CrewDash detail removed.

## Done When
- `src/screens/` renders a `ScreenSpec` (types from 01.3) of these kinds, all themed by `useTheme()`:
  - `list`: rows of avatar/icon, title, subtitle, value, tag pill.
  - `table`: columns and rows; optional compare columns with a diff pill and check discs.
  - `form`: header, fields, line items with a total, primary button with idle / busy / done states.
  - `phone`: a phone frame wrapping one of the above, with an optional big action button and tab bar.
  - `stat`: a big number with the Odometer and a label.
- Each screen takes a `progress` map of named actions (`click`, `checkRows`, `fill`, `count`, `done`) with frame
  numbers, so the walk and launch styles drive the same screen from their own timelines.
- Shared parts: `CardShell` (with the light sweep on done), `Pill`, `Avatar`, `Check`, `CheckDisc`, `ScreenHead`,
  `AppButton`.
- No colour literal or product copy in `src/screens/` (all text comes from the spec).
- A `ScreenGallery` composition for Studio shows every kind with sample data, so contributors can see them.
- Stills of each kind at 1080×1920 and 1920×1080 show no clipped text and nothing off the card.
- `npm run lint` and `npm test` pass.

## Files
- `src/screens/List.tsx`, `Table.tsx`, `Form.tsx`, `Phone.tsx`, `Stat.tsx`, `parts.tsx`, `Screen.tsx` (dispatch),
  `Gallery.tsx`, `index.ts`
