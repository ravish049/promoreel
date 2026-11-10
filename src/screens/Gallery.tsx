// The screen kit's gallery, for Studio (`npm run gallery`): every kind with made-up sample data (a bookings app), each
// running its actions in turn, at 1080×1920 and 1920×1080. It wears the project template's brand, the look a new
// project starts with. Cards with a button get the cursor, aimed with screenTarget().
import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { Cursor, EASE, enter, exit, tween, useFontGate, useLayout } from '../motion'
import { ThemeProvider, rgba, useTheme } from '../reel/theme'
import type { Brand, ScreenSpec } from '../reel/spec'
import template from '../../templates/project/brand.json'
import { sec } from './look'
import { Pill, type Progress } from './parts'
import { Screen, screenSize, screenTarget } from './Screen'

export const GALLERY_BRAND = { ...template, name: 'Sample', logo: undefined, photo: undefined } as Brand

/** Seconds each sample plays. */
export const SAMPLE_SECONDS = 6

type Sample = { name: string; spec: ScreenSpec; at: Partial<Record<keyof Progress, number>> }

const SAMPLES: Sample[] = [
  {
    name: 'list',
    spec: {
      kind: 'list',
      title: "Today's bookings",
      subtitle: 'Tuesday · 5 appointments',
      icon: 'clock',
      badge: '5 open',
      rows: [
        { initials: 'AM', title: 'Ana Morales', subtitle: '09:30 · Cut and style', value: '$48.00', tag: 'New', tagTone: 'accent' },
        { initials: 'JK', title: 'James Kerr', subtitle: '10:15 · Beard trim', value: '$22.00', tag: 'Repeat', tagTone: 'highlight' },
        { initials: 'SL', title: 'Sofia Lindqvist', subtitle: '11:00 · Colour', value: '$96.00' },
        { initials: 'RT', title: 'Ravi Thomas', subtitle: '13:30 · Cut', value: '$35.00', tag: 'Paid', tagTone: 'success' },
        { icon: 'users', title: 'Walk-in slot', subtitle: '15:00 · Open', value: '$0.00', tag: 'Open', tagTone: 'muted' },
      ],
      button: { label: 'Confirm all', busy: 'Confirming…', done: 'All confirmed' },
    },
    at: { fill: 0.5, count: 1.4, checkRows: 2.4, click: 4.1, done: 4.7 },
  },
  {
    name: 'table',
    spec: {
      kind: 'table',
      title: 'Weekly hours',
      subtitle: 'Studio team · week 14',
      icon: 'line-chart',
      columns: ['Day', 'Planned', 'Logged'],
      rows: [
        ['Mon', '8.0 h', '8.0 h'],
        ['Tue', '8.0 h', '6.5 h'],
        ['Wed', '8.0 h', '8.0 h'],
        ['Thu', '8.0 h', '8.0 h'],
        ['Fri', '6.0 h', '6.0 h'],
      ],
      compare: { columns: [1, 2] },
      summary: 'Planned 38.0 h · logged 36.5 h · 1 differs',
      button: { label: 'Approve week', busy: 'Approving…', done: 'Approved' },
    },
    at: { fill: 0.5, checkRows: 2.2, click: 4.1, done: 4.7 },
  },
  {
    name: 'form',
    spec: {
      kind: 'form',
      title: 'New invoice',
      subtitle: 'Filled in from this week’s bookings',
      icon: 'file-text',
      badge: 'Draft',
      fields: [
        { label: 'Client', value: 'Harbor Street Studio' },
        { label: 'Due', value: 'Net 15 · May 2' },
      ],
      items: [
        { label: 'Cut and style × 12', detail: 'Apr 8 – Apr 14', amount: '$576.00' },
        { label: 'Colour × 4', detail: 'Apr 9, Apr 11', amount: '$384.00' },
      ],
      total: { label: 'Total', value: '$960.00' },
      button: { label: 'Send invoice', busy: 'Sending…', done: 'Sent' },
    },
    at: { fill: 0.5, count: 2.4, click: 4.1, done: 4.7 },
  },
  {
    name: 'stat',
    spec: { kind: 'stat', title: 'This month', icon: 'sparkles', value: 1284, prefix: '$', label: 'Booked through the app' },
    at: { count: 0.8, done: 2.6 },
  },
  {
    name: 'phone · list + action',
    spec: {
      kind: 'phone',
      statusBarTime: '8:57',
      screen: {
        kind: 'list',
        title: 'My day',
        subtitle: 'Tuesday, April 15',
        rows: [
          { icon: 'check-square', title: 'Open the studio', subtitle: '08:45' },
          { icon: 'users', title: 'Ana Morales', subtitle: '09:30 · Cut and style' },
          { icon: 'users', title: 'James Kerr', subtitle: '10:15 · Beard trim' },
        ],
      },
      action: { label: 'Check in', icon: 'map-pin', done: 'Checked in' },
      tabs: [
        { label: 'Today', icon: 'clock' },
        { label: 'Clients', icon: 'users' },
        { label: 'Messages', icon: 'message-square' },
        { label: 'Pay', icon: 'banknote' },
      ],
    },
    at: { fill: 0.4, checkRows: 1.6, click: 3.4, done: 4.1 },
  },
  {
    name: 'phone · form',
    spec: {
      kind: 'phone',
      screen: {
        kind: 'form',
        title: 'Book a visit',
        fields: [
          { label: 'Service', value: 'Cut and style' },
          { label: 'When', value: 'Thu 10:00' },
        ],
        total: { label: 'Total', value: '$48.00' },
        button: { label: 'Book', busy: 'Booking…', done: 'Booked' },
      },
      tabs: [
        { label: 'Home', icon: 'layout-grid' },
        { label: 'Bookings', icon: 'clock' },
        { label: 'Profile', icon: 'users' },
      ],
      activeTab: 1,
    },
    at: { fill: 0.5, count: 1.8, click: 3.6, done: 4.2 },
  },
]

export const GALLERY_SECONDS = SAMPLES.length * SAMPLE_SECONDS

/** The box a sample is drawn in, by canvas: a card hugs its content inside the safe area; a phone gets a taller box. */
const boxFor = (spec: ScreenSpec, W: number, H: number, wide: boolean, safe: { top: number; bottom: number; left: number; right: number }) => {
  const nat = screenSize(spec)
  if (spec.kind === 'phone') {
    const h = wide ? H * 0.8 : H * 0.66
    return { width: h * (nat.width / nat.height), height: h, top: wide ? H * 0.1 : H * 0.12 }
  }
  const width = wide ? Math.min(1100, W * 0.6) : safe.right - safe.left
  const maxH = wide ? H * 0.8 : safe.bottom - safe.top
  const height = Math.min(maxH, nat.height * (width / nat.width))
  const top = wide ? H * 0.12 + (maxH - height) / 2 : safe.top + (maxH - height) / 2
  return { width, height, top }
}

const SampleView: React.FC<{ sample: Sample; local: number }> = ({ sample, local }) => {
  const { width: W, height: H, fps } = useVideoConfig()
  const L = useLayout()
  const t = useTheme()
  const box = boxFor(sample.spec, W, H, L.wide, L.safe)
  const left = (W - box.width) / 2
  const progress: Progress = Object.fromEntries(Object.entries(sample.at).map(([k, s]) => [k, sec(s, fps)]))
  const inP = enter(local, 0, sec(0.8, fps), fps)
  const out = exit(local, sec(SAMPLE_SECONDS - 0.4, fps), sec(0.35, fps))
  const target = screenTarget(sample.spec, box.width, box.height)
  const click = progress.click
  const moves =
    target && click !== undefined && sample.spec.kind !== 'phone'
      ? [
          { at: 0, dur: 0, to: [left + box.width + 160, box.top + box.height + 200] as [number, number] },
          { at: click - sec(1.2, fps), dur: sec(0.9, fps), to: [left + target[0], box.top + target[1]] as [number, number], hesitate: true },
          { at: click + sec(0.9, fps), dur: sec(0.8, fps), to: [left + box.width + 200, box.top + box.height + 260] as [number, number] },
        ]
      : null
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: box.top - (L.wide ? 70 : 80), display: 'flex', justifyContent: 'center', opacity: tween(local, 0, sec(0.4, fps), 0, 1, EASE.out) }}>
        <Pill tone="muted" size={L.wide ? 24 : 28}>
          {sample.name}
        </Pill>
      </div>
      <div style={{ position: 'absolute', left, top: box.top, opacity: Math.min(1, inP * 1.6), transform: `translateY(${(1 - inP) * 40}px) scale(${0.96 + 0.04 * inP})` }}>
        <Screen spec={sample.spec} progress={progress} f={local} width={box.width} height={box.height} />
      </div>
      {moves ? (
        <Cursor f={local} moves={moves} clicks={[click!]} size={L.wide ? 44 : 56} opacity={tween(local, click! - sec(1.3, fps), click! - sec(1.0, fps), 0, 1) * (1 - tween(local, click! + sec(1.2, fps), click! + sec(1.6, fps), 0, 1))} />
      ) : null}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: L.wide ? 30 : 120, textAlign: 'center', fontFamily: t.font, fontSize: L.wide ? 22 : 26, fontWeight: 600, color: rgba(t.ink, 0.45) }}>
        {Object.keys(sample.at).join(' → ')}
      </div>
    </AbsoluteFill>
  )
}

const GalleryBody: React.FC = () => {
  const t = useTheme()
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  useFontGate([t.font])
  const per = sec(SAMPLE_SECONDS, fps)
  const i = Math.min(SAMPLES.length - 1, Math.floor(f / per))
  return (
    <AbsoluteFill style={{ background: t.paper }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${rgba(t.ink, 0.07)} 2.2px, transparent 2.6px)`, backgroundSize: '56px 56px' }} />
      <SampleView key={i} sample={SAMPLES[i]} local={f - i * per} />
    </AbsoluteFill>
  )
}

export const ScreenGallery: React.FC = () => (
  <ThemeProvider brand={GALLERY_BRAND}>
    <GalleryBody />
  </ThemeProvider>
)
