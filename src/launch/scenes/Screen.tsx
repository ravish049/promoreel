// A screen: one screen-kit screen on the stage, driven by the plan's actions (fill, count, checkRows, click, done). The
// cursor comes in from off canvas on an arc, hesitates near the button, then presses it; the camera eases in (1.3×)
// for the click and back out. Kinetic words land on the beat in the band the layout keeps for them.
import React from 'react'
import { Box, Camera, Center, Cursor, Words, camAt, enter, type CamKey, type Move } from '../../motion'
import { useTheme } from '../../reel/theme'
import { Screen, screenTarget } from '../../screens'
import { WORD_GAP, fitRows, hudWidth, sceneOut, useLaunch } from '../context'
import { screenBox } from '../layout'
import { LEAD, at60, type ScreenPlan } from '../plan'

/** How far the camera pushes in for the click. */
const ZOOM = 1.3

export const ScreenScene: React.FC<{ p: ScreenPlan; f: number }> = ({ p, f }) => {
  const t = useTheme()
  const { plan, lay } = useLaunch()
  const fps = plan.fps
  const F = (n: number) => at60(n, fps)
  const { W, H } = lay.L
  const words = p.spec.words ?? []
  const stage = lay.stage({ words: words.length > 0, hud: hudWidth(t, lay, plan.counter, p.scene) })
  const box = screenBox(p.spec.screen, stage, lay.L.wide ? 1180 : Infinity)
  const left = box.cx - box.w / 2
  const top = box.cy - box.h / 2
  const tgt = screenTarget(p.spec.screen, box.w, box.h)
  const target: [number, number] | null = tgt ? [left + tgt[0], top + tgt[1]] : null
  const len = p.scene.to - p.scene.from

  // the camera: settles in, pushes toward the button for the click, eases back out
  const keys: CamKey[] = [
    { f: -F(LEAD), x: 0, y: 0, s: 0.965 },
    { f: F(70), x: 0, y: 0, s: 1 },
  ]
  if (p.zoom && target) {
    // wide: lean well toward the button; narrow canvases stay nearer the middle, so less of the card is cut away
    const lean = lay.L.wide ? 0.72 : 0.45
    const focus = { x: target[0] * lean, y: target[1] * 0.72 }
    keys.push({ f: p.zoom.in[0], x: 0, y: 0, s: 1 }, { f: p.zoom.in[1], ...focus, s: ZOOM }, { f: p.zoom.out[0], ...focus, s: ZOOM }, { f: p.zoom.out[1], x: 0, y: 0, s: 1 })
  }
  const cam = camAt(keys, f, 0.02, len)

  // the cursor: in from beyond the bottom-right corner, a hesitation up and left of the button, the press, and away
  let moves: Move[] | null = null
  if (p.cursor && target) {
    const c = p.cursor
    const off: [number, number] = [W / 2 + 90, H / 2 + 110]
    const hes: [number, number] = [target[0] - Math.min(220, box.w * 0.2), target[1] - Math.min(150, box.h * 0.16)]
    moves = [
      { at: 0, dur: 0, to: off },
      { at: c.enter[0], dur: c.enter[1], to: hes, bend: 0.18, hesitate: true },
      { at: c.approach[0], dur: c.approach[1], to: target, bend: 0.08 },
      ...(c.leave ? [{ at: c.leave[0], dur: c.leave[1], to: [W / 2 + 120, H / 2 + 160] as [number, number], bend: 0.12 }] : []),
    ]
  }

  const inn = enter(f, -F(8), F(40), fps)
  const out = sceneOut(f, p.out, fps)
  const fitted = words.length ? fitRows([{ words, accent: false, at: p.wordsAt }], lay.words.maxW, lay.words.size, t.font) : null
  return (
    <>
      <Camera cam={cam}>
        <Box
          x={box.cx}
          y={box.cy}
          w={box.w}
          h={box.h}
          style={{ opacity: Math.min(1, inn * 1.6) * (1 - out), transform: `translateY(${(1 - inn) * 70 + out * 20}px) scale(${(0.94 + 0.06 * inn) * (1 - 0.03 * out)})` }}
        >
          <Screen spec={p.spec.screen} progress={p.progress} f={f} width={box.w} height={box.h} />
        </Box>
        {moves ? <Cursor f={f} moves={moves} clicks={[p.cursor!.click]} size={lay.cursor} opacity={1 - out} /> : null}
      </Camera>
      {fitted ? (
        <Center>
          <div style={{ position: 'absolute', left: 0, top: lay.words.cy, width: 0, height: 0, opacity: 1 - out }}>
            <div style={{ position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
              {fitted.rows.map((r, i) => {
                const first = fitted.rows.slice(0, i).reduce((n, x) => n + x.words.length, 0)
                const lastRow = i === fitted.rows.length - 1
                return (
                  <Words
                    key={i}
                    f={f}
                    words={r.words}
                    at={r.at}
                    size={fitted.size}
                    color={t.paper}
                    gap={WORD_GAP}
                    accentWords={lastRow && first + r.words.length === words.length && words.length > 1 ? [r.words.length - 1] : []}
                  />
                )
              })}
            </div>
          </div>
        </Center>
      ) : null}
    </>
  )
}
