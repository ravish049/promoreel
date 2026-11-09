// How long each screen's actions take, in seconds and frames. Pure (no React, no theme), so the screens and the walk's
// plan (src/walk/plan.ts) share one source: the plan places a step's click and done after its fill and count finish.
import type { ScreenSpec } from '../reel/spec'

/** Seconds → frames at fps (at least 1). */
export const sec = (s: number, fps: number) => Math.max(1, Math.round(s * fps))

/** Frames between items of a cascade of n: 0.3 s each, tightened so the whole cascade stays within ~1.8 s. */
export const stagger = (n: number, fps: number) => sec(Math.min(0.3, 1.8 / Math.max(1, n)), fps)

/** A count: numbers roll to their values over this long. */
export const COUNT_S = 1
/** A list row slides in over this long. */
export const ROW_IN_S = 0.9
/** A row's check (list) / disc or diff pill (table) lands over this long. */
export const LIST_CHECK_S = 0.4
export const TABLE_CHECK_S = 0.7
/** A table's scan line reads its rows in over this long. */
export const scanSeconds = (rows: number) => 0.6 + 0.14 * rows
/** A form: one field starts typing this long after the one before, and types over TYPE_S; a line item enters over ITEM_IN_S. */
export const FIELD_STEP_S = 0.55
export const TYPE_S = 0.45
export const ITEM_IN_S = 0.85

/** Frames from `fill` until the last row, field or line item is in (0 for a screen that doesn't fill). */
export const fillFrames = (s: ScreenSpec, fps: number): number => {
  switch (s.kind) {
    case 'phone':
      return fillFrames(s.screen, fps)
    case 'list':
      return s.rows.length ? (s.rows.length - 1) * stagger(s.rows.length, fps) + sec(ROW_IN_S, fps) : 0
    case 'table':
      return sec(scanSeconds(s.rows.length), fps)
    case 'form': {
      const fields = s.fields?.length ?? 0
      const items = s.items?.length ?? 0
      if (items) return fields * sec(FIELD_STEP_S, fps) + (items - 1) * stagger(items, fps) + sec(ITEM_IN_S, fps)
      return fields ? (fields - 1) * sec(FIELD_STEP_S, fps) + sec(TYPE_S, fps) : 0
    }
    case 'stat':
      return 0
  }
}

/** Frames from `count` until every number has landed (0 for a screen with nothing to count). */
export const countFrames = (s: ScreenSpec, fps: number): number => {
  switch (s.kind) {
    case 'phone':
      return countFrames(s.screen, fps)
    case 'stat':
      return sec(COUNT_S, fps)
    case 'form':
      return s.total ? sec(COUNT_S, fps) : 0
    case 'list':
      return s.rows.some((r) => r.value) ? sec(COUNT_S, fps) : 0
    case 'table':
      return sec(COUNT_S, fps)
  }
}

/** Frames from `checkRows` until the last row's check has landed (0 for a screen without rows to check). */
export const checkFrames = (s: ScreenSpec, fps: number): number => {
  switch (s.kind) {
    case 'phone':
      return checkFrames(s.screen, fps)
    case 'list':
      return s.rows.length ? (s.rows.length - 1) * stagger(s.rows.length, fps) + sec(LIST_CHECK_S, fps) : 0
    case 'table':
      return s.rows.length ? (s.rows.length - 1) * stagger(s.rows.length, fps) + sec(TABLE_CHECK_S, fps) : 0
    default:
      return 0
  }
}
