# Writing the script

These rules come from making real reels and listening back. A reel is heard more than it is read, so write it the way
someone would explain the app to a friend over coffee.

## The shape (30–45 s)
| Beat | Scene | Lines | Example |
|---|---|---|---|
| Hook: a question the viewer answers in their head | `hook` (headline, optional number cards) | 1–2 | "Are you losing hours between what you pay, and what you bill?" |
| The problem, made concrete | `hook` cards or `quiz` | 1–2 | "Your client's sheet says 38. But you paid for 40." |
| The product doing it, on screen | `phone` (or `terminal`) | 3–5, one per step | "Drop the sheet in, and check it, day by day." |
| The result | `phone` last clip or `showcase` | 1 | "And your invoice fills itself in." |
| The shared close | `end` (brand.json → outro.lines) | 1–2 | "CrewDash. Every hour, matched." |

## The rules
1. **Open with a question.** The first two seconds decide whether anyone stays. Make it a question the viewer answers
   with "yes, that's me".
2. **One idea per line.** A line is one breath of meaning. If it has an "and also", split it.
3. **No ellipses (…).** TTS turns them into long, robotic pauses. Use `|` for a breath (`pauseMs` sets its length), and a
   comma for a short one.
4. **Claim only what the footage shows.**
   - "It fills the invoice in" is fine when the clip shows it filling in.
   - "Saves you 10 hours a week" is not fine without proof on screen.
   - No invented numbers, customers, awards or integrations.
5. **85–100 words for about 35 s.** Count them. Over 100 and the clips feel rushed; under 80 and they drag.
6. **Conversational.** Contractions ("it's", "you'll"), short phrases, "you" and "your". Read it aloud once: if you
   wouldn't say it, rewrite it.
7. **Spell for the ear in `say`, for the eye in `text`.**
   - `say`: "thirty-eight", "Crew Dash", "A P I".
   - `text`: "38", "CrewDash", "API".
8. **Vary the pace a little:** `speed` from 0.95 to 1.05 per line, so the lines don't all march at one tempo.
9. **Brand names:** if the voice blurs one, spell it in `say` the way it sounds ("Promo reel"). Then check what Whisper
   heard after `promoreel captions`.

## Before you voice it
- [ ] The first line is a question.
- [ ] Every claim maps to a clip and an event you recorded.
- [ ] There is no "…" in any `say`.
- [ ] 85–100 words, outro included.
- [ ] The close is the brand's shared outro: same lines in every reel of the project.
