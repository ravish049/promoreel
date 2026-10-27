# Checking a render

Read the contact sheet (`out/<id>-sheet.png`, plus your own `promoreel sheet … --at` times on each scene's middle and
each zoom) and go through this list. A "no" means fix the spec and render again.

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
