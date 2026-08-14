import { validateBridgePayload } from './core.js'

export const inject = ['theme']
export const SOURCE_ID = 'dsh-matugen'
export const BRIDGE_ROUTE = '/dsh-matugen/palette'
export const POLL_MS = 1000

/** Browser half: poll the fixed same-origin bridge and replace one ThemeRuntime override layer. */
export function apply(ctx) {
  ctx.effect(() => {
    let stopped = false
    let timer
    let inFlight
    let revision
    let disposeLayer

    const schedule = () => {
      if (!stopped) timer = setTimeout(() => { void sync() }, POLL_MS)
    }

    const sync = async () => {
      const controller = new AbortController()
      inFlight = controller
      try {
        const response = await fetch(BRIDGE_ROUTE, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (!response.ok) return
        const body = await response.json()
        if (body?.ok !== true) return
        const payload = validateBridgePayload(body)
        if (payload.revision === revision) return

        // ThemeRuntime validates the whole layer before replacing the existing
        // source, so a bad future DSH token contract cannot partially apply.
        disposeLayer = ctx.theme.overrideTokens(SOURCE_ID, payload.tokens)
        revision = payload.revision
      } catch (error) {
        if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') return
        // Transient palette/read/network failures intentionally keep the last
        // good layer. The next poll retries without mutating theme state.
      } finally {
        if (inFlight === controller) inFlight = undefined
        schedule()
      }
    }

    void sync()
    return () => {
      stopped = true
      if (timer !== undefined) clearTimeout(timer)
      inFlight?.abort()
      disposeLayer?.()
    }
  }, 'dsh-matugen: palette sync')
}

export default apply
