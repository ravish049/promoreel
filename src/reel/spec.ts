// The shape of a reel spec (<project>/reels/<id>.json) and of a project's brand (<project>/brand.json).
// One spec = one video. The CLI merges the brand into the spec and hands both to Remotion as props.
import type { IconName } from './icons'

// ── voice lines ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type LineSpec = {
  id: string
  /**
   * What the voice says. Spell numbers and names the way they should sound ("thirty-eight", "Crew Dash").
   * A `|` marks a breath: Kokoro renders each phrase on its own and joins them with `pauseMs`; Chatterbox reads it as a comma.
   */
  say: string
  /** The breath at each `|`, ms (default 300). */
  pauseMs?: number
  /** Chatterbox only: another seed gives another take of the line (when a word comes out slurred). */
  seed?: number
  /** What the captions show, word for word (defaults to `say`): "38", "CrewDash". */
  text?: string
  /** Speed for this line (defaults to voice.speed). Vary it a little (0.95–1.05) so the lines don't all march. */
  speed?: number
}

/** A line inside a talking scene (hook, quiz, terminal, showcase, end): they play one after another. */
export type SceneLine = { id: string; gapBeforeMs?: number }

/** A line inside the phone scene, pinned to a moment of a clip. */
export type PhoneLine = {
  id: string
  clip: string
  /** A recorded event label of that clip (tap / focus / mark), or none for the clip's first shown frame. */
  event?: string
  /** Milliseconds after (or, negative, before) that moment, in OUTPUT time. */
  offsetMs?: number
}

// ── the phone scene's camera, glows and badges ─────────────────────────────────────────────────────────────────────────

/** Where a camera keyframe looks: an event's box (its centre, or a point inside it as fractions), a point in CSS px, or the whole screen. */
export type FocusSpec = 'center' | string | { event: string; fx?: number; fy?: number } | { x: number; y: number }

export type CameraKey = {
  /** The event the camera arrives on (source time), or `atMs` in source ms. */
  event?: string
  atMs?: number
  offsetMs?: number
  scale: number
  focus: FocusSpec
  /** How long the move into this keyframe takes, in OUTPUT ms (default 600). */
  moveMs?: number
}

export type GlowSpec = {
  event: string
  /** The glow lasts until this event (or the end of the clip). */
  untilEvent?: string
  /** accent = the brand accent (a difference, a warning); highlight = the "right thing" colour; success = green. */
  color?: 'accent' | 'highlight' | 'success'
  /** Extra space around the box, CSS px. */
  pad?: number
}

/** A label drawn under an event's box, e.g. "GPS check ✓ · On site". */
export type BadgeSpec = { event: string; text: string; untilEvent?: string; icon?: IconName }

export type ClipSpec = {
  name: string
  /**
   * Jump cuts: play only these source ranges, back to back (hard cuts), each at its own speed. Use them to drop the idle
   * moments of a recording. When set, `from` / `to` / `rate` are not used.
   */
  segments?: { from: string | number; to: string | number; rate?: number }[]
  /** Trim, in SOURCE ms: an event label (optionally "+300"/"-200") or a number. */
  from?: string | number
  to?: string | number
  /** Playback speed (UI taps hold up well to 1.5–2.5×). */
  rate?: number
  camera?: CameraKey[]
  glow?: GlowSpec[]
  badges?: BadgeSpec[]
  /** Tap ripples are drawn on every recorded tap unless this is false. */
  taps?: boolean
}

// ── scenes ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

type Talking = {
  id: string
  lines: SceneLine[]
  /** Silence before the first line, ms (default 250). */
  leadMs?: number
  /** Hold after the last line, ms (default 400). */
  tailMs?: number
}

/** A number card in the hook: it can count from `from` to `value` when the voice says the number. */
export type HookCard = {
  label: string
  value: number
  /** Counts from here to `value` like an odometer, landing when the voice says `value` (or `atWord`). */
  from?: number
  unit?: string
  /** The card appears when the voice says this word (the first card appears with `cardsLine`). */
  atWord?: string
  /** A Lucide icon in the card's tile, or a short glyph such as "$". */
  icon?: IconName
  glyph?: string
}

export type HookScene = Talking & {
  type: 'hook'
  /** A big question over the backdrop, one word per row, the last word in the accent colour ("Losing hours?"). */
  headline?: string
  /** A smaller line under the headline. */
  sub?: string
  /** Up to two number cards; they replace the headline when `cardsLine` starts. */
  cards?: HookCard[]
  cardsLine?: string
  /** A tilted accent pill between the cards, e.g. "−2 h", shown when the voice says `atWord`. */
  badge?: { text: string; atWord?: string }
}

export type QuizScene = Talking & {
  type: 'quiz'
  question: string
  options: string[]
  answer: number
  /** The line at whose start the answer lights up. */
  revealLine: string
  /** A small line under the answer, shown when the voice says `footAtWord`. */
  foot?: string
  footAtWord?: string
  /** Words of the question drawn in the accent colour (default: any word with a digit). */
  highlight?: string[]
}

export type PhoneScene = {
  id: string
  type: 'phone'
  /** Folder under the project's public/ with the recorder's <clip>.mp4 + <clip>.json (e.g. "videos/add-todos"). */
  clipsDir: string
  clips: ClipSpec[]
  lines: PhoneLine[]
  /** Crossfade between clips, frames (default 6). */
  cutFrames?: number
  statusBarTime?: string
  /**
   * Slow a clip down (to at most 0.4× its set speed) when the line pinned on it is longer than the footage, so lines never
   * talk over each other. Default true; the CLI reports each clip it slowed.
   */
  fitLines?: boolean
  /** The status bar's colour, to match the app's top edge (default white; its text turns light on a dark colour). */
  statusBarColor?: string
}

/** One command in a terminal scene: typed out, then its output lines appear. */
export type TerminalCommand = {
  /** The line during which this command runs (it starts typing when the line starts, plus `offsetMs`). */
  atLine: string
  offsetMs?: number
  /** The step pill lit while this command runs, e.g. "Record". */
  step?: string
  cmd: string
  /** Output lines, shown one after another while the line is spoken. `{text, tone}` colours one. */
  output?: (string | { text: string; tone?: 'muted' | 'ok' | 'accent' | 'plain' })[]
  /** Draws a progress bar under the output that fills while the line is spoken. */
  progress?: boolean
}

export type TerminalScene = Talking & {
  type: 'terminal'
  /** The window title, e.g. "~/my-app". */
  title?: string
  commands: TerminalCommand[]
}

/** A finished video (any aspect) shown in a rounded frame: a result, a before/after, another reel. */
export type ShowcaseScene = Talking & {
  type: 'showcase'
  /** A video under the project's public/, or a path relative to the project folder (the CLI stages it). */
  src: string
  /** Start this far into the video, ms. */
  fromMs?: number
  rate?: number
  /** A short label over the frame, e.g. "The result". */
  label?: string
}

/** The closing: the feature grid, the same in every video of a project (its features and voice live in brand.json). */
export type EndScene = {
  id: string
  type: 'end'
  /** Leave out: every outro gets the brand's outro lines. */
  lines?: SceneLine[]
  leadMs?: number
  tailMs?: number
  /** Override the brand's title / button for one video. */
  title?: string
  cta?: string
}

export type SceneSpec = HookScene | QuizScene | PhoneScene | TerminalScene | ShowcaseScene | EndScene

/** Cards on the backdrop: solid paper with ink words (default), or frosted glass. */
export type CardStyle = 'solid' | 'glass'

// ── the reel ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type VoiceSettings = {
  /**
   * The voice the video plays: a Kokoro voice ("af_heart", "am_michael", or "kokoro:af_heart"), or "chatterbox".
   * Another provider plugs in as "<provider>:<voice>" (see docs/voice-providers.md).
   */
  use: string
  /** Extra voices to render for comparison (samples land in out/voices/). Default: just `use`. */
  render?: string[]
  /** Kokoro precision: fp32 (best), fp16, q8 (smallest download). Default fp32. */
  dtype?: string
  speed?: number
  /** A voice that talks slower can be sped up on its own, e.g. { "am_michael": 1.08 }. */
  speedByVoice?: Record<string, number>
  /** Chatterbox's expressiveness (0.25–2, default 0.5) and CFG weight (default 0.5; lower = slower, more deliberate). */
  chatterbox?: { exaggeration?: number; cfgWeight?: number; seed?: number }
  volume?: number
}

export type ReelSpec = {
  id: string
  /** Shown in the manifest and the studio's gallery. */
  title?: string
  fps?: number
  width?: number
  height?: number
  voice: VoiceSettings
  captions?: {
    /** Whisper model (default base.en). */
    model?: string
    /** Hide the captions during these scenes. */
    hideIn?: string[]
  }
  /** H.264 quality for `render` (default 18; 23–26 gives much smaller files that still read sharp). `--crf` overrides it. */
  crf?: number
  /** The tap sound (default on: sfx/tap.wav, which the CLI puts in public/). */
  sfx?: { tap?: string | false; tapVolume?: number }
  /** Frames of the transition INTO each scene after the first (default 12). */
  transitionFrames?: number
  /** The photo under every scene, in public/ (overrides brand.photo). */
  photo?: string
  look?: { cards?: CardStyle }
  lines: LineSpec[]
  scenes: SceneSpec[]
}

// ── the brand ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Feature = { label: string; icon: IconName }

export type Brand = {
  name: string
  colors: {
    /** The dark base: backdrop tint, caption pill, text on light cards. */
    ink: string
    /** The light base: cards, caption words. */
    paper: string
    /** The brand colour: the hook's last word, the spoken caption word, tap ripples, the outro button. */
    accent: string
    /** The "right answer" colour: the lit quiz option, glows on the validated thing (default an iOS blue). */
    highlight?: string
    success?: string
  }
  /**
   * The overlay font: one of the bundled Google Fonts (Inter, Manrope, DM Sans, Plus Jakarta Sans, Poppins, Space Grotesk),
   * or { family, file } for a font file in public/.
   */
  font?: string | { family: string; file: string }
  /** The logo in public/ (svg or png, square works best). Without one, the outro draws the name's first letter. */
  logo?: string
  /** The photo every scene sits on, in public/ (portrait, ~9:16). Without one, a gradient from the brand colours. */
  photo?: string
  look?: { cards?: CardStyle }
  /** The closing grid: up to 15 tiles (3 columns). */
  features: Feature[]
  outro: {
    title: string
    /** The words, then the last one in the accent colour: ["Everything a small agency needs.", "Covered."] */
    tagline?: [string, string]
    cta: string
    /** The outro's own voice: every video of the project ends with these lines over the grid. */
    lines: LineSpec[]
    gapMs?: number
    tailMs?: number
  }
}

/** What Remotion receives: the spec with its brand merged in. */
export type ReelInput = ReelSpec & { brand: Brand }
