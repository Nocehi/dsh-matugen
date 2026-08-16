import { verifyBridgePayload } from './core.js'

export const inject = ['theme']
export const SOURCE_ID = 'dsh-matugen'
export const BRIDGE_ROUTE = '/dsh-matugen/palette'
export const POLL_MS = 1000
export const DIAGNOSTIC_INTERVAL_MS = 60_000
export const CONTEXT_CATEGORY_STYLE_ATTRIBUTE = 'data-dsh-matugen-context-categories'

const CONTEXT_CATEGORY_SEEDS = Object.freeze({
  system: '#6366f1',
  tools: '#f59e0b',
  user: '#22c55e',
  inject: '#a855f7',
  assistant: '#3b82f6',
  tool: '#14b8a6',
})
const CONTEXT_CATEGORY_KEYS = Object.freeze(Object.keys(CONTEXT_CATEGORY_SEEDS))
const CATEGORY_HEX = /^#[0-9a-f]{6}$/u
const SHA256 = /^[0-9a-f]{64}$/u
const CATEGORY_SCOPE = ':where(.lc-root,.lc-modal-card)'
const CATEGORY_TARGETS = Object.freeze([
  '.lc-stacked-seg',
  '.lc-chip > i',
  '.lc-detail-row > i',
  '.lc-bar-fill',
  '.lc-bar-stack > div',
  '.lc-node > i',
])

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

function categoryColor(value, label) {
  if (typeof value !== 'string' || !CATEGORY_HEX.test(value)) {
    throw new TypeError(`dsh-matugen: ${label} must be a lowercase #RRGGBB color`)
  }
  return value
}

/** Validate the optional extended-color payload independently of ThemeRuntime. */
export function normalizeContextCategories(value) {
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('dsh-matugen: contextCategories must be an object')
  }
  const keys = Object.keys(value).sort()
  const expected = [...CONTEXT_CATEGORY_KEYS].sort()
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    throw new TypeError('dsh-matugen: contextCategories must contain exactly the six dsh-context categories')
  }
  const result = {}
  for (const key of CONTEXT_CATEGORY_KEYS) {
    const entry = value[key]
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`dsh-matugen: contextCategories.${key} must be an object`)
    }
    const entryKeys = Object.keys(entry).sort()
    if (JSON.stringify(entryKeys) !== JSON.stringify(['dark', 'light', 'seed'])) {
      throw new TypeError(`dsh-matugen: contextCategories.${key} must contain exactly seed/light/dark`)
    }
    const seed = categoryColor(entry.seed, `contextCategories.${key}.seed`)
    if (seed !== CONTEXT_CATEGORY_SEEDS[key]) {
      throw new TypeError(`dsh-matugen: contextCategories.${key}.seed does not match the compatibility contract`)
    }
    result[key] = Object.freeze({
      seed,
      light: categoryColor(entry.light, `contextCategories.${key}.light`),
      dark: categoryColor(entry.dark, `contextCategories.${key}.dark`),
    })
  }
  return Object.freeze(result)
}

function rgbSignatures(hex) {
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  return [hex, `rgb(${red}, ${green}, ${blue})`, `rgb(${red},${green},${blue})`]
}

/**
 * Optional dsh-context compatibility sheet. Seed guards are deliberate: if
 * dsh-context changes a category identity, dsh-matugen stops overriding that
 * mark instead of silently assigning the old semantic color to a new one.
 */
export function contextCategoryCss(value) {
  const categories = normalizeContextCategories(value)
  if (categories === undefined) return ''

  const light = []
  const dark = []
  const rules = []
  for (const key of CONTEXT_CATEGORY_KEYS) {
    const entry = categories[key]
    const variable = `--dsh-matugen-context-${key}`
    light.push(`${variable}:${entry.light};`)
    dark.push(`${variable}:${entry.dark};`)

    const selectors = []
    for (const target of CATEGORY_TARGETS) {
      for (const signature of rgbSignatures(entry.seed)) {
        selectors.push(`${CATEGORY_SCOPE} ${target}[style*="${signature}"]`)
      }
    }
    rules.push(`${selectors.join(',\n')}{background:var(${variable}) !important;}`)
  }

  // DSH ui-theme owns the resolved light/dark DOM marker. The light values
  // live on :root; the dark body overrides them through ordinary inheritance.
  return `:root{${light.join('')}}\nbody[data-ds-dark-theme]{${dark.join('')}}\n${rules.join('\n')}`
}

function snapshotRevisionOf(body, fallback) {
  if (body.snapshotRevision === undefined) return fallback
  if (typeof body.snapshotRevision !== 'string' || !SHA256.test(body.snapshotRevision)) {
    throw new TypeError('dsh-matugen: snapshotRevision must be a lowercase SHA-256')
  }
  return body.snapshotRevision
}

/** Browser half: poll the fixed same-origin bridge and replace one ThemeRuntime override layer. */
export function apply(ctx) {
  ctx.effect(() => {
    let stopped = false
    let timer
    let inFlight
    let tokenRevision
    let transportRevision
    let disposeLayer
    let categoryStyle
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

    const setContextCategories = categories => {
      if (typeof document === 'undefined') return
      if (categories === undefined) {
        categoryStyle?.remove()
        categoryStyle = undefined
        return
      }
      if (categoryStyle === undefined) {
        categoryStyle = document.createElement('style')
        categoryStyle.setAttribute(CONTEXT_CATEGORY_STYLE_ATTRIBUTE, '')
        document.head.appendChild(categoryStyle)
      }
      categoryStyle.textContent = contextCategoryCss(categories)
    }

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
          headers: transportRevision === undefined ? undefined : { 'if-none-match': `"${transportRevision}"` },
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

        let nextTransportRevision
        let transportValid = true
        try {
          nextTransportRevision = snapshotRevisionOf(body, payload.revision)
        } catch (error) {
          transportValid = false
          report('snapshot-revision:invalid', error)
        }

        let categories
        let categoriesValid = true
        try {
          categories = normalizeContextCategories(body.contextCategories)
        } catch (error) {
          categoriesValid = false
          report('context-categories:invalid', error)
        }

        if (payload.revision !== tokenRevision) {
          // ThemeRuntime validates the whole layer before replacing the existing
          // source. If disposal races this synchronous install, immediately
          // retire the just-created layer rather than leaving an orphan effect.
          const nextDispose = ctx.theme.overrideTokens(SOURCE_ID, payload.tokens)
          if (!active(controller)) {
            nextDispose()
            return
          }
          disposeLayer = nextDispose
          tokenRevision = payload.revision
        }

        if (categoriesValid) setContextCategories(categories)
        // Only acknowledge the whole-response ETag after every optional
        // extension in that response validated. Invalid metadata therefore
        // gets another 200 on the next poll instead of being cached forever.
        if (transportValid && categoriesValid) transportRevision = nextTransportRevision
        if (transportValid && categoriesValid) recovered()
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
      categoryStyle?.remove()
    }
  }, 'dsh-matugen: palette sync')
}
