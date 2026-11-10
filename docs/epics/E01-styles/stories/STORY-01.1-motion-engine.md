# STORY-01.1 — Motion engine

## Goal
Port the generic motion engine from `~/crewdash-videos/src/launch/` into a brand-agnostic `src/motion/`, so the walk and
launch styles share one set of frame-pure motion helpers that work at any canvas size.

## Done When
- `src/motion/` exports:
  - `motion.ts`: `EASE` (inOut, out, in, overshoot, count), `tween`, `enter`, `exit`, `press`, `drift`, `arc`, `TRAVEL`.
  - `layout.ts`: `layoutFor(width, height)` → kind (`wide` | `tall` | `square`), text scale and a safe area. For
    1080×1920 the safe area equals today's `SAFE` (top 269, bottom 1248, left 65, right 1015); 16:9 and 1:1 get
    sensible margins. `useLayout()` reads it from `useVideoConfig()`.
  - `Camera.tsx`: `camAt(keys, f)` with eased keyframes, `Camera`, `Box`, `At`, `Center` (placed from the canvas centre).
  - `Cursor.tsx`: cursor on arcs with overshoot, hesitation and click ring; colours from `useTheme()`.
  - `Counter.tsx`: `Odometer` with N digits (not fixed at 3) and `Counter` card with a glow mixing two theme colours.
  - `Words.tsx`: kinetic word-by-word type.
  - `fonts.ts`: `useFontGate(families)` that holds the render until the theme's fonts load and fails loudly
    (`cancelRender`) if one is missing.
- No colour literal, brand name or CrewDash copy in `src/motion/` (grep for `#FF5A00`, `crew`, `rgba(255,90,0` is empty).
- `@remotion/motion-blur` added at the same version as the other Remotion packages (4.0.539).
- Unit tests for the pure helpers (`tween`, `enter` end values, `layoutFor` for 1080×1920 / 1920×1080 / 1080×1080,
  `camAt` interpolation) pass; the test script picks up `src/**/*.test.ts` as well as `cli/lib/*.test.ts`.
- `npm run lint` and `npm test` pass; `npx promoreel all examples/generic` output is unchanged.

## Files
- `src/motion/motion.ts`, `layout.ts`, `Camera.tsx`, `Cursor.tsx`, `Counter.tsx`, `Words.tsx`, `fonts.ts`, `index.ts`
- `src/motion/motion.test.ts`, `src/motion/layout.test.ts`
- `package.json`, `package-lock.json` (motion-blur dep; test glob)
