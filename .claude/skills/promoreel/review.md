# Checking a render

Read the contact sheet (`out/<id>-sheet.png`, plus your own `promoreel sheet … --at` times on each scene's middle and
each zoom) and go through the list for the style. A "no" means fix the spec and render again.

## recorded

**Hook (0–3 s)**
- [ ] The question is readable in under a second, with nothing cut at the edges.
- [ ] Any number cards land when the voice says the number.

**Phone scenes**
- [ ] Each zoom lands on what the line talks about, and arrives before the word, not after.
- [ ] Tap ripples sit on the tapped control (a ripple off to the side means the page scrolled after the box was logged:
      add a `wait` or `mark` before the tap).
- [ ] No loading spinner or blank page lingers. Trim it with `from` / `to` or a jump cut (`segments`).
- [ ] Nothing private on screen: real names, emails, API keys, a dev banner you don't want shown.

**Captions**
- [ ] Every line has captions, in sync, spelled your way, inside the safe zone (never under the top ~270 px or the bottom ~670 px).
- [ ] Two lines never talk over each other (`promoreel voice` warns, and `out/<id>.timeline.json` lists the times).

**Close**
- [ ] The outro's grid is complete and the CTA is readable before the video ends.
- [ ] 30–45 s in total.

**Sound**
- [ ] Listen to `out/voices/<id>-<voice>.wav` once: no clipped word, no long silence.

## walk and launch
A walk has one video per cut and a launch film one per format, each with its sheet beside it
(`out/walk-long-sheet.png`, `out/launch-16x9-sheet.png`, …). Check every one.

**Layout**
- [ ] In 9:16, key text sits inside the safe zone: top 269, bottom 1248, left 65, right 1015 px.
- [ ] In 16:9 and 1:1, nothing is cut off at any edge: headline, counter, screens, cards, logo.

**Walk**
- [ ] The step tracker shows each step's label, and it is gone before the logo close.
- [ ] Captions sit inside the safe zone, in sync and spelled your way; read every `warn` line from `voice` and `render`.

**Launch**
- [ ] The cursor lands on the button before it clicks.
- [ ] The payoff's cards all land before they tick off.

**Close and sound**
- [ ] The logo, tagline and CTA are readable before the video ends.
- [ ] Loudness −16 to −14 LUFS, true peak ≤ −1 dBFS (the render's `master` line prints both).
