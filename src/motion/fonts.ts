// Holds the render until the given font families are loaded, so no frame is ever drawn in a fallback font. A family the
// browser can't find fails the render loudly (cancelRender) instead.
import { useEffect, useRef, useState } from 'react'
import { cancelRender, continueRender, delayRender } from 'remotion'

const DEFAULT_WEIGHTS = ['400', '500', '600', '700', '800'] as const
const RETRIES = 100
const RETRY_MS = 100

/** The first family of a CSS font stack, unquoted: '"Inter", -apple-system, sans-serif' → 'Inter'. */
export const firstFamily = (stack: string) => stack.split(',')[0].trim().replace(/^["']|["']$/g, '')

/**
 * `families` are family names or full stacks (pass the theme's: `useFontGate([t.font, t.mono])`); only the first family
 * of each stack is waited for. Call it once at the top of a composition.
 */
export const useFontGate = (families: readonly string[], weights: readonly string[] = DEFAULT_WEIGHTS) => {
  const names = [...new Set(families.map(firstFamily))]
  const key = `${names.join('|')}::${weights.join(',')}`
  const [handle] = useState(() => delayRender(`Loading fonts: ${names.join(', ')}`))
  const continued = useRef(false)
  useEffect(() => {
    let live = true
    // A font file loaded with @remotion/fonts joins document.fonts only after it is fetched, so a family that isn't
    // there yet is retried for a while before it counts as missing.
    const facesOf = async (fam: string) => (await Promise.all(weights.map((w) => document.fonts.load(`${w} 20px "${fam}"`)))).flat().length
    const missingOf = async (fam: string) => {
      for (let i = 0; i < RETRIES; i++) {
        await document.fonts.ready
        if ((await facesOf(fam)) > 0) return null
        await new Promise((r) => setTimeout(r, RETRY_MS))
      }
      return fam
    }
    Promise.all(names.map(missingOf))
      .then((missing) => {
        const gone = missing.filter((m): m is string => m !== null)
        if (gone.length) throw new Error(`Fonts not loaded: ${gone.join(', ')}`)
        if (live && !continued.current) {
          continued.current = true
          continueRender(handle)
        }
      })
      // fail the render loudly rather than draw a fallback font (a re-run effect reports it itself)
      .catch((e) => {
        if (live) cancelRender(e)
      })
    return () => {
      live = false
    }
    // names and weights are captured through `key`, so a new array with the same contents doesn't re-run the check
  }, [handle, key])
}
