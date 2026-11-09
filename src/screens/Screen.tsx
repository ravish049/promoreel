// Any screen spec, by kind: a card (list, table, form, stat) or a phone wrapping one. The walk and launch styles both
// draw screens through this: they choose the box (width × height, in pixels) and drive it with a progress map of
// action → start frame from their own timelines.
import React from 'react'
import type { ScreenSpec } from '../reel/spec'
import { InnerView, innerHeight, innerTarget } from './inner'
import { DW, type ScreenProps } from './parts'
import { PH, PW, Phone, phoneTarget } from './Phone'

/** The screen's natural size in design pixels: the aspect it looks best at (a phone is always PW × PH). */
export const screenSize = (spec: ScreenSpec): { width: number; height: number } =>
  spec.kind === 'phone' ? { width: PW, height: PH } : { width: DW, height: innerHeight(spec) }

/**
 * Where to click on the screen drawn in a width × height box: the primary button, or the phone's action button, in box
 * pixels from its top-left corner. Null when the screen has nothing to press (a stat, or no button).
 */
export const screenTarget = (spec: ScreenSpec, width: number, height: number): [number, number] | null =>
  spec.kind === 'phone' ? phoneTarget(spec, width, height) : innerTarget(spec, width, height)

export const Screen: React.FC<ScreenProps<ScreenSpec>> = ({ spec, ...rest }) =>
  spec.kind === 'phone' ? <Phone spec={spec} {...rest} /> : <InnerView spec={spec} {...rest} />
