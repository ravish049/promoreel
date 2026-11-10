// One tool a customer uses today, drawn as an app icon: a rounded square with a soft top-to-bottom gradient, a soft
// shadow and a white glyph, with an optional label underneath. `image` (a path in public/) is drawn edge to edge in the
// tile instead of a glyph. The default fills below are a fixed, neutral set picked to suit each kind of tool; they are
// not any company's colours. The label and the shadow take the theme's ink.
import React from 'react'
import { Img, staticFile } from 'remotion'
import { mixColor } from '../../motion'
import { rgba, useTheme } from '../../reel/theme'
import { lift } from '../../screens/look'
import { Glyph, type ToolIconName } from './glyphs'

export type { ToolIconName } from './glyphs'

/** A tool in the row. Matches the spec's ToolSpec. */
export type ToolSpec = { icon?: ToolIconName; image?: string; label?: string; color?: string }

/** The default fill per tool. */
export const TOOL_COLORS: Record<ToolIconName, string> = {
  spreadsheet: '#2E9460',
  chat: '#5E64E0',
  phone: '#25A88A',
  email: '#DE5A4C',
  calendar: '#EB8A2E',
  calculator: '#5F6878',
  clipboard: '#8A5AD8',
  notes: '#E8B421',
  folder: '#3A8AD6',
}

/** The fill a tool is drawn in: its own colour, else its icon's default, else a neutral grey. */
export const toolColor = (tool: ToolSpec) => tool.color ?? (tool.icon ? TOOL_COLORS[tool.icon] : undefined) ?? TOOL_COLORS.calculator

/** The tile's corner radius as a share of its size (an app-icon squircle, approximated). */
export const TILE_RADIUS = 0.235

export type ToolTileProps = {
  tool: ToolSpec
  /** The tile's width and height in px. */
  size: number
  /** Overrides the tool's colour. */
  color?: string
  /** Overrides the tool's label; `false` hides it. */
  label?: string | false
  /** The label's colour (default: the theme's ink). */
  labelColor?: string
  style?: React.CSSProperties
}

/** The label's font size and the gap above it, for a tile of `size`: so a row can reserve the room. */
export const tileLabelSize = (size: number) => ({ font: Math.round(size * 0.19), gap: Math.round(size * 0.12) })

export const ToolTile: React.FC<ToolTileProps> = ({ tool, size, color, label, labelColor, style }) => {
  const t = useTheme()
  const fill = color ?? toolColor(tool)
  const r = size * TILE_RADIUS
  const top = lift(fill, 0.16)
  const bottom = mixColor(fill, '#000000', 0.12)
  const text = label === false ? undefined : (label ?? tool.label)
  const ls = tileLabelSize(size)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: ls.gap, width: size, flexShrink: 0, ...style }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: r,
          position: 'relative',
          overflow: 'hidden',
          background: tool.image && !color && !tool.color ? '#FFFFFF' : `linear-gradient(180deg, ${top} 0%, ${fill} 55%, ${bottom} 100%)`,
          boxShadow: `0 ${size * 0.06}px ${size * 0.16}px ${rgba(t.ink, 0.2)}, 0 ${size * 0.015}px ${size * 0.035}px ${rgba(t.ink, 0.14)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {tool.image ? (
          <Img src={staticFile(tool.image)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Glyph name={tool.icon ?? 'clipboard'} size={size * 0.64} color="#FFFFFF" cut={fill} style={{ filter: `drop-shadow(0 ${Math.max(1, size * 0.012)}px ${Math.max(1, size * 0.02)}px rgba(0,0,0,0.16))` }} />
        )}
        {/* a soft sheen on the top half and a hairline edge, as app icons have */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: r,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 48%)',
            boxShadow: `inset 0 ${Math.max(1, size * 0.01)}px 0 rgba(255,255,255,0.22), inset 0 0 0 ${Math.max(1, size * 0.006)}px rgba(0,0,0,0.06)`,
            pointerEvents: 'none',
          }}
        />
      </div>
      {text ? (
        <div style={{ fontFamily: t.font, fontSize: ls.font, fontWeight: 600, color: labelColor ?? t.ink, lineHeight: 1.15, textAlign: 'center', whiteSpace: 'nowrap', maxWidth: size * 1.35, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {text}
        </div>
      ) : null}
    </div>
  )
}
