import { verifyBridgePayload } from './core.js'

export const inject = ['theme']
export const SOURCE_ID = 'dsh-matugen'
export const BRIDGE_ROUTE = '/dsh-matugen/palette'
export const POLL_MS = 1000
export const DIAGNOSTIC_INTERVAL_MS = 60_000

function diagnosticKey(error) {
  if (error !== null && typeof error === 'object') {
    if ('code' in error && typeof error.code === 'string') return `code:${error.code}`
    if ('name' in error && typeof error.name === 'string') return `name:${error.name}`
  }
  return `value:${String(error)}`
}

function abortError(error) {
  return typeof DOMException !== 'undefined'
    && error instanceof DOMException
    && error.name === 'AbortError'
}

/** Browser half: poll the fixed same-origin bridge and replace one ThemeRuntime override layer. */
export function apply(ctx) {
  ctx.effect(() => {
    let stopped = false
    let timer
    let inFlight
    let revision
    let disposeLayer
    let lastDiagnosticKey
    let lastDiagnosticAt = -Infinity
    let degraded = false

    const report = (key, error) => {
      const now = Date.now()
      if (key === lastDiagnosticKey && now - lastDiagnosticAt < DIAGNOSTIC_INTERVAL_MS) return
      lastDiagnosticKey = key
      lastDiagnosticAt = now
      degraded = true
      console.warn(`dsh-matugen: palette sync degraded (${key})`, error)
    }

    const reportError = error => report(diagnosticKey(error), error)

    const recovered = () => {
      if (!degraded) return
      degraded = false
      lastDiagnosticKey = undefined
      console.info('dsh-matugen: palette sync recovered')
    }

    const active = controller => (
      !stopped
      && !controller.signal.aborted
      && inFlight === controller
    )

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
          headers: revision === undefined ? undefined : { 'if-none-match': `"${revision}"` },
          signal: controller.signal,
        })
        if (!active(controller)) return

        if (response.status === 304) {
          recovered()
          return
        }
        if (!response.ok) {
          report(`http:${String(response.status)}`, new Error(`bridge HTTP ${String(response.status)}`))
          return
        }

        const body = await response.json()
        if (!active(controller)) return
        if (body?.ok !== true) {
          report(`bridge:${String(body?.code ?? 'not-ok')}`, new Error('bridge response was not ok'))
          return
        }

        const payload = await verifyBridgePayload(body)
        if (!active(controller)) return
        if (payload.revision === revision) {
          recovered()
          return
        }

        // ThemeRuntime validates the whole layer before replacing the existing
        // source. If disposal races this synchronous install, immediately
        // retire the just-created layer rather than leaving an orphan effect.
        const nextDispose = ctx.theme.overrideTokens(SOURCE_ID, payload.tokens)
        if (!active(controller)) {
          nextDispose()
          return
        }
        disposeLayer = nextDispose
        revision = payload.revision
        recovered()
      } catch (error) {
        if (stopped || !active(controller) || abortError(error)) return
        reportError(error)
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
