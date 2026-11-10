// The cross-out scribble drawing itself over a row box as `progress` runs 0 → 1: fast along each stroke, slower into
// the turns (scribbleDrawn). It reads as a marker: a main stroke over a softer one laid slightly off it (so the line's
// width changes with its direction, like a pressed felt tip) and a light streak inside, all with round ends. The colour
// comes from props; the width scales with the box. Drawn in the parent's coordinates (the box is in the parent's px).
import React, { useMemo } from 'react'
import { lift } from '../../screens/look'
import { scribbleDrawn, scribblePath, type Box, type ScribbleOpts } from './scribblePath'

export type { Box, ScribbleOpts } from './scribblePath'

export type ScribbleProps = {
  /** The row to cross out, in the parent's px. */
  box: Box
  /** 0 → 1: how far it has drawn. */
  progress: number
  color: string
  /** Picks the path; the same seed draws the same scribble. */
  seed?: number
  /** The main stroke's width in px (default: 16 % of the box height). */
  width?: number
  opts?: ScribbleOpts
  /** The marker's opacity (default 0.94). */
  opacity?: number
}

export const Scribble: React.FC<ScribbleProps> = ({ box, progress, color, seed = 1, width, opts, opacity = 0.94 }) => {
  const s = useMemo(() => scribblePath(box, seed, opts), [box.x, box.y, box.w, box.h, seed, opts?.strokes, opts?.loops, opts?.overshoot])
  const drawn = scribbleDrawn(s, progress)
  if (drawn <= 0) return null
  const sw = width ?? Math.max(2, box.h * 0.16)
  // the drawn length, then a gap longer than the path; no dash once it has finished, so the end never shows a seam
  const dash = progress >= 1 ? undefined : `${drawn} ${s.length + sw * 4}`
  const common = { d: s.d, fill: 'none', stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeDasharray: dash }
  return (
    <svg width={1} height={1} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <g opacity={opacity}>
        {/* a softer pass laid off to one side: the line is wider where it runs across that offset, as with a tilted nib */}
        <path {...common} strokeWidth={sw} opacity={0.42} transform={`translate(${sw * 0.16} ${sw * 0.2})`} />
        <path {...common} strokeWidth={sw * 0.9} />
        {/* a lighter streak inside, where the nib carries less ink */}
        <path {...common} stroke={lift(color, 0.45)} strokeWidth={sw * 0.22} opacity={0.3} transform={`translate(${-sw * 0.1} ${-sw * 0.12})`} />
      </g>
    </svg>
  )
}
