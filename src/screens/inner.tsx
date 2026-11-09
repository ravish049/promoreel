// The four card screens behind one component, and their geometry: the natural height and where the primary button sits
// (for a cursor or a finger to aim at). Shared by Screen (any spec) and Phone (the screen it wraps).
import React from 'react'
import type { InnerScreen } from '../reel/spec'
import { Form, formHeight } from './Form'
import { List, listHeight } from './List'
import { Stat, statHeight } from './Stat'
import { Table, tableHeight } from './Table'
import { BUTTON_H, DW, FLAT_PAD, PAD, fitOf, type ScreenProps } from './parts'

export const innerHeight = (s: InnerScreen, dw = DW) =>
  s.kind === 'list' ? listHeight(s) : s.kind === 'table' ? tableHeight(s) : s.kind === 'form' ? formHeight(s) : statHeight(s, dw)

/** Where to click the primary button (right of its label, so a cursor doesn't cover it) in a width × height box; null without a button. */
export const innerTarget = (s: InnerScreen, width: number, height: number, opts: { dw?: number; flat?: boolean } = {}): [number, number] | null => {
  if (s.kind === 'stat' || !s.button) return null
  const dw = opts.dw ?? DW
  const { u } = fitOf(innerHeight(s, dw), dw, width, height)
  const pad = opts.flat ? FLAT_PAD : PAD
  return [width * 0.76, height - u * (pad + BUTTON_H * 0.35)]
}

export const InnerView: React.FC<ScreenProps<InnerScreen>> = ({ spec, ...rest }) => {
  switch (spec.kind) {
    case 'list':
      return <List spec={spec} {...rest} />
    case 'table':
      return <Table spec={spec} {...rest} />
    case 'form':
      return <Form spec={spec} {...rest} />
    case 'stat':
      return <Stat spec={spec} {...rest} />
  }
}
