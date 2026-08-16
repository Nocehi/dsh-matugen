import { Hct, argbFromHex, hexFromArgb } from '@material/material-color-utilities'

/**
 * dsh-context 0.10.x category identities. Hue/chroma come from these stable
 * seeds; only HCT tone changes between light and dark presentation.
 *
 * These are data identities, not Material primary/secondary/tertiary UI roles.
 * Keeping the seeds stable means a wallpaper change cannot turn "assistant"
 * into a different category hue.
 */
export const CONTEXT_CATEGORY_SEEDS = Object.freeze({
  system: '#6366f1',
  tools: '#f59e0b',
  user: '#22c55e',
  inject: '#a855f7',
  assistant: '#3b82f6',
  tool: '#14b8a6',
})

/**
 * Role-like Material 3 tones: darker ink on light surfaces and lighter ink on
 * dark surfaces. Material does not prescribe these values for charts; this is
 * a bounded extended-color policy built from the same HCT machinery.
 */
export const CONTEXT_CATEGORY_TONES = Object.freeze({ light: 40, dark: 80 })

function toneOf(seed, tone) {
  const source = Hct.fromInt(argbFromHex(seed))
  return hexFromArgb(Hct.from(source.hue, source.chroma, tone).toInt())
}

/** Build the six fixed-identity HCT tonal pairs served to the browser. */
export function contextCategoryPalette() {
  const result = {}
  for (const [key, seed] of Object.entries(CONTEXT_CATEGORY_SEEDS)) {
    result[key] = Object.freeze({
      seed,
      light: toneOf(seed, CONTEXT_CATEGORY_TONES.light),
      dark: toneOf(seed, CONTEXT_CATEGORY_TONES.dark),
    })
  }
  return Object.freeze(result)
}
