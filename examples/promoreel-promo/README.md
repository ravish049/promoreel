# Example: promoreel-promo (the kit's own promo)

**"Make a promo reel of your app with Claude Code, free"**, made only with the kit's own CLI:

```bash
npx promoreel all examples/promoreel-promo --pretty
```
→ `out/promoreel-promo.mp4` (1080×1920, 32 s, rendered at `crf` 24) and `out/promoreel-promo-sheet.png` (8 frames).

| Scene | Type | What |
|---|---|---|
| Hook | `hook` | "A promo reel of your app?", then two odometer cards ("API keys you need" 3 → 0, "Paid voices" 0) and a "Free" badge |
| Three steps | `terminal` | `promoreel record`, `voice`, `captions` and `render` typed out with step pills. The output lines are copied from the real run of `examples/generic` |
| The result | `showcase` | The finished `examples/generic` reel, playing in a frame (`src: ../generic/out/todo-promo.mp4`, staged by the CLI) |
| Close | `end` | The 12 features and the repo link |

The voice is Chatterbox (`bash scripts/install-chatterbox.sh` first), with captions from Whisper `small.en`. One line
(`step-3b`) uses `seed: 42`: the default take read "Remotion" as "our lotion", which Whisper's read-back caught.

It needs `examples/generic/out/todo-promo.mp4`, so run the generic example first.
