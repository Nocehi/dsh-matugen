import { validateBridgePayload } from './core.js'

export const inject = ['theme']
export const SOURCE_ID = 'dsh-matugen'
export const DEFAULT_ROUTE = '/dsh-matugen/palette'
export const DEFAULT_POLL_MS = 1000

function routePath(value) {
  const route = value ?? DEFAULT_ROUTE
  if (typeof route !== 'string' || route.length < 2 || !route.startsWith('/') || route.endsWith('/') || route.includes('?') || route.includes('#')) {
    throw new TypeError('dsh-matugen: route must be an absolute non-root pathname without a trailing slash, query, or fragment')
  }
  return route
}

function pollInterval(value) {
  const interval = value ?? DEFAULT_POLL_MS
  if (!Number.isSafeInteger(interval) || interval < 250 || interval > 60_000) {
    throw new TypeError('dsh-matugen: pollMs must be an integer between 250 and 60000')
  }
  return interval
}

export function normalizeClientConfig(config = {}) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('dsh-matugen: config must be an object')
  return Object.freeze({ route: routePath(config.route), pollMs: pollInterval(config.pollMs) })
}

/** Browser half: poll the same-origin read-only bridge and replace one ThemeRuntime override layer. */
export function apply(ctx, config = {}) {
  const normalized = normalizeClientConfig(config)
  ctx.effect(() => {
    let stopped = false
    let timer
    let inFlight
    let revision
    let disposeLayer

    const schedule = () => {
      if (!stopped) timer = setTimeout(() => { void sync() }, normalized.pollMs)
    }

    const sync = async () => {
      const controller = new AbortController()
      inFlight = controller
      try {
        const response = await fetch(normalized.route, {
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
