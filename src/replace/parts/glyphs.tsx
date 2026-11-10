// Generic tool glyphs for the replace ad's tiles, drawn here on a 48×48 grid: a spreadsheet grid, a speech bubble, a
// handset, an envelope, a calendar page, a calculator, a clipboard, a note page and a folder. They are plain shapes, not
// any company's logo. Each glyph is a filled shape in `color` with its details knocked out in `cut` (the tile's fill), so
// it reads as one crisp mark on a coloured tile.
import React from 'react'

/** The tools the kit can draw. Matches the spec's ToolIconName. */
export type ToolIconName = 'spreadsheet' | 'chat' | 'phone' | 'email' | 'calendar' | 'calculator' | 'clipboard' | 'notes' | 'folder'

export const TOOL_ICONS: readonly ToolIconName[] = ['spreadsheet', 'chat', 'phone', 'email', 'calendar', 'calculator', 'clipboard', 'notes', 'folder']

type Draw = (c: string, cut: string) => React.ReactNode

const line = (cut: string, w = 2.4) => ({ fill: 'none', stroke: cut, strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

const GLYPHS: Record<ToolIconName, Draw> = {
  spreadsheet: (c, cut) => (
    <>
      <rect x={8} y={10} width={32} height={28} rx={4.5} fill={c} />
      <path d="M8 18.5h32M8 25h32M8 31.5h32M17.5 10v28M28.5 10v28" {...line(cut, 2)} strokeLinecap="butt" />
    </>
  ),
  chat: (c, cut) => (
    <>
      <path d="M17.5 9.5h13a9.5 9.5 0 0 1 9.5 9.5v4.5a9.5 9.5 0 0 1-9.5 9.5H22l-7.2 5.8a.8.8 0 0 1-1.3-.62V32.3A9.5 9.5 0 0 1 8 23.5V19a9.5 9.5 0 0 1 9.5-9.5z" fill={c} />
      <circle cx={16.5} cy={21.3} r={2.4} fill={cut} />
      <circle cx={24} cy={21.3} r={2.4} fill={cut} />
      <circle cx={31.5} cy={21.3} r={2.4} fill={cut} />
    </>
  ),
  // a handset on its side: the earpiece top left, the mouthpiece bottom right, joined by a curved grip
  phone: (c) => (
    <>
      <path d="M15 12.5c-3.2 9.6 2.6 19.6 12.5 21.4" fill="none" stroke={c} strokeWidth={6.2} strokeLinecap="round" />
      <rect x={-5} y={-3.6} width={10} height={7.2} rx={3.6} fill={c} transform="translate(14.6 12.2) rotate(-68)" />
      <rect x={-5} y={-3.6} width={10} height={7.2} rx={3.6} fill={c} transform="translate(30.4 34.2) rotate(-12)" />
    </>
  ),
  email: (c, cut) => (
    <>
      <rect x={7.5} y={12} width={33} height={24} rx={4.5} fill={c} />
      <path d="M9.5 14.5 24 25.5l14.5-11" {...line(cut, 2.6)} />
    </>
  ),
  calendar: (c, cut) => (
    <>
      <rect x={8.5} y={11.5} width={31} height={28} rx={5} fill={c} />
      <path d="M8.5 20h31" {...line(cut, 2.2)} strokeLinecap="butt" />
      <rect x={15} y={7.5} width={3.6} height={8.5} rx={1.8} fill={c} stroke={cut} strokeWidth={1.6} />
      <rect x={29.4} y={7.5} width={3.6} height={8.5} rx={1.8} fill={c} stroke={cut} strokeWidth={1.6} />
      {[14, 22, 30].map((x) => [24, 31].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={4.2} height={4.2} rx={1.1} fill={cut} />))}
    </>
  ),
  calculator: (c, cut) => (
    <>
      <rect x={11.5} y={7.5} width={25} height={33} rx={5} fill={c} />
      <rect x={15} y={11} width={18} height={7.5} rx={2} fill={cut} />
      {[18.2, 24, 29.8].map((x) => [24.5, 30, 35.5].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={2.1} fill={cut} />))}
    </>
  ),
  clipboard: (c, cut) => (
    <>
      <rect x={10.5} y={10.5} width={27} height={30} rx={4.5} fill={c} />
      <rect x={17.5} y={7} width={13} height={7.5} rx={2.6} fill={c} stroke={cut} strokeWidth={2} />
      <path d="M15.5 24.5l2.8 2.8 4.8-5" {...line(cut, 2.4)} />
      <path d="M26 25h6.5M15.5 33h17" {...line(cut, 2.4)} />
    </>
  ),
  notes: (c, cut) => (
    <>
      <path d="M13.5 7.5h14.3a3 3 0 0 1 2.12.88l7.2 7.2a3 3 0 0 1 .88 2.12V36.5a4 4 0 0 1-4 4h-20.5a4 4 0 0 1-4-4v-25a4 4 0 0 1 4-4z" fill={c} />
      <path d="M28.5 8v6.5a2.5 2.5 0 0 0 2.5 2.5h6.5" {...line(cut, 2)} />
      <path d="M15 24h17M15 30h17M15 36h10" {...line(cut, 2.4)} />
    </>
  ),
  folder: (c) => (
    <>
      <path d="M8 14.5a4 4 0 0 1 4-4h7.3a3 3 0 0 1 2.12.88L24.5 14.5H36a4 4 0 0 1 4 4V34a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill={c} opacity={0.62} />
      <rect x={8} y={18.5} width={32} height={19.5} rx={4} fill={c} />
    </>
  ),
}

/** One tool glyph, `size` px square: the shape in `color`, its details in `cut`. */
export const Glyph: React.FC<{ name: ToolIconName; size: number; color?: string; cut: string; style?: React.CSSProperties }> = ({ name, size, color = '#FFFFFF', cut, style }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', flexShrink: 0, ...style }}>
    {(GLYPHS[name] ?? GLYPHS.clipboard)(color, cut)}
  </svg>
)
