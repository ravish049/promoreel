// The hook: a kinetic headline, word by word, rows in the accent colour where the spec says so. When the film has a
// counter, it rolls up on the centre stage above the headline (Launch.tsx draws it, at hookGeometry's place) and moves
// to its corner at the cut. The type pushes in slowly and drifts; it leaves ease-in at the end of the scene.
import React from 'react'
import { Center, Words, drift, tween } from '../../motion'
import { useTheme } from '../../reel/theme'
import { ROW_H, WORD_GAP, sceneOut, useLaunch } from '../context'
import { at60, type HookPlan } from '../plan'

export const HookScene: React.FC<{ p: HookPlan; f: number }> = ({ p, f }) => {
  const t = useTheme()
  const { hooks, plan } = useLaunch()
  const geo = hooks[p.scene.id]
  if (!geo) return null
  const fps = plan.fps
  const len = p.scene.to - p.scene.from
  const out = sceneOut(f, p.out, fps)
  const push = tween(f, 0, len, 1, 1.05)
  const blockH = geo.rows.length * geo.size * ROW_H
  return (
    <Center>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: geo.headTop + blockH / 2 + drift(f, 3, at60(280, fps)),
          width: 0,
          height: 0,
          opacity: 1 - out,
          transform: `translateY(${out * 24}px) scale(${push})`,
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {geo.rows.map((r, i) => (
            <div key={i} style={{ height: geo.size * ROW_H, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
              <Words f={f} words={r.words} at={r.at} size={geo.size} color={r.accent ? t.accent : t.paper} gap={WORD_GAP} />
            </div>
          ))}
        </div>
      </div>
    </Center>
  )
}
