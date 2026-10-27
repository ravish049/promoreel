# Credits

What promoreel took, from where, and under which licence. "Idea" means a design was borrowed and the code was written
here; "code" means code was copied or adapted.

## The source: the CrewDash video project (code, same author)
promoreel was extracted from the private Remotion project that made the CrewDash reel (`examples/crewdash`). It has the
same author as this repo and is relicensed here under MIT. Taken and made generic:
- **The template:**
  - the spec-driven `Reel`, `timeline.ts`, the hook and quiz scenes, the phone scene (camera, ripples, glows, badges,
    jump cuts);
  - the captions, the photo backdrop with three looks, and the feature-grid outro.
- **The recorder:** the DevTools screenshot loop at device pixels, tap and focus metadata, and human-paced input.
- **Voice and captions:**
  - Kokoro phrase-by-phrase rendering, and the Chatterbox bridge with per-line seeds;
  - whisper.cpp captions with alignment to the script's own words.
- **The script-writing rules.**

New in promoreel:
- `brand.json` theming;
- the flow-file format and runner;
- the `VoiceProvider` interface;
- the CLI and its JSON progress;
- the manifest;
- line auto-fitting;
- the `terminal` and `showcase` scenes;
- the GitHub helpers;
- the agent skill and `AGENTS.md`.

## Projects read before building (ideas only, no code copied)
- **[digitalsamba/claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit)**:
  MIT, "Copyright (c) 2024 Digital Samba". Ideas borrowed:
  - brand settings in their own JSON file, separate from each video's spec;
  - one set of instructions serving both Claude Code (`.claude/`, `CLAUDE.md`) and Codex (`AGENTS.md`);
  - tools that print JSON for the agent to read, rather than prose;
  - a project folder an agent can resume from.

  Its Python, GPU and ElevenLabs tooling and its synthetic-UI recording route were not used.
- **[wilwaldon/Claude-Code-Video-Toolkit](https://github.com/wilwaldon/Claude-Code-Video-Toolkit)**: a curated list
  (a single README). Its README says MIT, but the repo has no LICENSE file, so **nothing was copied**. It confirmed
  the stack choice: Remotion plus a Playwright recording, driven by the agent.
- **Remotion's official agent skills** ([remotion.dev/docs/ai](https://www.remotion.dev/docs/ai),
  [remotion-dev/skills](https://github.com/remotion-dev/skills)), under the Remotion License. Their text is **not
  vendored here**; the README suggests installing them with `npx remotion skills add`. Ideas borrowed:
  - a thin `SKILL.md` that links to topic files loaded only when needed;
  - frontmatter kept to `name` and `description`;
  - a "preserve the user's changes" rule;
  - `agents/openai.yaml` display metadata beside the skill, for Codex.

## Libraries and models (used, not copied)
| What | Licence | Use |
|---|---|---|
| [Remotion](https://www.remotion.dev) (`remotion`, `@remotion/*`) | Remotion License: free for individuals, companies of up to 3 employees and non-profits; others need a company licence | Rendering, Studio, captions helpers, whisper.cpp installer, Google Fonts loader |
| [kokoro-js](https://github.com/hexgrad/kokoro) + Kokoro-82M ONNX weights (`onnx-community/Kokoro-82M-v1.0-ONNX`) | Apache-2.0 | Default voice |
| [Chatterbox](https://github.com/resemble-ai/chatterbox) (`chatterbox-tts`, `ResembleAI/chatterbox`) | MIT; output carries the PerTh watermark | Optional voice |
| [whisper.cpp](https://github.com/ggml-org/whisper.cpp) + Whisper `ggml-*.en` models | MIT | Captions |
| [Playwright](https://playwright.dev) (`playwright-core`) | Apache-2.0 | The recorder's browser driver |
| [tsx](https://github.com/privatenumber/tsx) | MIT | Runs the TypeScript CLI |
| Inter, DM Sans, Manrope, Plus Jakarta Sans, Poppins, Space Grotesk, JetBrains Mono | SIL OFL 1.1 | Overlay type, loaded from Google Fonts at render |
| [FFmpeg](https://ffmpeg.org) (installed separately) | LGPL/GPL | Encoding, contact sheets |

## Icons: Lucide (paths inlined in `src/reel/icons.tsx`)
```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright
(c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

## Example content
- `examples/generic` films [Playwright's TodoMVC demo](https://demo.playwright.dev/todomvc), a public page made for
  testing automation, which shows a banner saying so. TodoMVC is by Addy Osmani, Sindre Sorhus and contributors (MIT).
- `examples/crewdash`: the CrewDash name, mark, footage and the loading-dock photo belong to CrewDash's owner, who made
  the photo for this video. Included as an example; not under this repo's MIT licence.
- The tap sound (`assets/sfx/tap.wav`) is synthesised by `scripts/make-sfx.sh`; nothing is downloaded.
- The example logos (`examples/generic/public/brand/logo.svg`, `examples/promoreel-promo/public/brand/logo.svg`) were made
  for this repo (MIT).
