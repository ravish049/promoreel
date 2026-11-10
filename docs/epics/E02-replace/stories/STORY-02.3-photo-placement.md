# STORY-02.3 — Photo placement: four corners to a perspective transform, crop per format

## Goal
Place any drawn screen onto the phone in a user's photo or tripod clip, and keep that phone in frame in 9:16, 4:5 and
1:1.

## Done When
- `src/replace/perspective.ts` (pure):
  - `homography(w, h, quad)` returns the CSS `matrix3d` that maps a `w×h` box onto a quad (TL, TR, BR, BL).
  - `coverCrop(src, canvas, focus)` gives the scale and offset that cover the canvas, keeping `focus` (default: the
    screen quad's centre) as central as the edges allow.
  - `mapQuad(quad, crop)` maps a source quad to canvas pixels.
  - `photoWarnings(quad, canvas, safe)` returns plain-language warnings: the screen falls partly outside a format's crop;
    the screen is smaller than 25% of the canvas width; the quad is not convex or its corners are out of order.
- Unit tests: a rectangle quad gives an affine matrix; known corner points map back within 0.5 px; `coverCrop` keeps the
  focus in view for 9:16, 4:5 and 1:1 from a 3:4 and a 9:16 source; each warning fires on a crafted bad input.
- `src/replace/PhotoScreen.tsx`: draws the photo (`Img`) or clip (`OffthreadVideo`, muted, looped to the video length)
  cover-cropped to the canvas, with a `dim` overlay. It places its children (a `w×h` box) onto the mapped quad with the
  matrix, with a faint glare gradient and slightly softened edges, and fades the screen in from dark with a `light` prop
  (0–1). Its props are local types that match 02.1's `background`.
- Check with a generated test photo (not committed): a portrait image with a known coloured quad, rendered as a still
  in all three formats. The placed screen covers the quad within 2 px at each corner.
- `npm run lint` and `npm test` pass.

## Files
- `src/replace/perspective.ts`, `perspective.test.ts`, `PhotoScreen.tsx`
