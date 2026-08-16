import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
  apply,
  BRIDGE_ROUTE,
  contextCategoryCss,
  DIAGNOSTIC_INTERVAL_MS,
  normalizeContextCategories,
  POLL_MS,
  SOURCE_ID,
} from '../src/client.js'
import { contextCategoryPalette } from '../src/context-categories.js'
import { BRIDGE_VERSION, canonicalTokenJson, dmsPaletteToDshTokens } from '../src/core.js'

function palette() {
  const light = {
    background: '#ffffff',
    surface_container_low: '#f5f5f5',
    surface_container: '#eeeeee',
    surface_container_high: '#e5e5e5',
    outline_variant: '#cccccc',
    outline: '#777777',
    primary: '#123456',
    on_surface: '#111111',
    on_surface_variant: '#444444',
    error: '#ba1a1a',
  }
  const dark = {
    background: '#101010',
    surface_container_low: '#181818',
    surface_container: '#202020',
    surface_container_high: '#282828',
    outline_variant: '#505050',
    outline: '#999999',
    primary: '#abcdef',
    on_surface: '#eeeeee',
    on_surface_variant: '#cccccc',
    error: '#ffb4ab',
  }
  return { colors: { light, dark } }
}

function payload({ snapshotRevision = 'a'.repeat(64), categories = contextCategoryPalette() } = {}) {
  const tokens = dmsPaletteToDshTokens(palette())
  const revision = createHash('sha256').update(canonicalTokenJson(tokens)).digest('hex')
  return {
    ok: true,
    version: BRIDGE_VERSION,
    provider: 'dms',
    revision,
    snapshotRevision,
    tokens,
    contextCategories: categories,
  }
}

function tick() {
  return new Promise(resolve => setImmediate(resolve))
}

function timeout(ms, message) {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    timer.unref?.()
  })
}

test('browser transport geometry is a fixed package contract', () => {
  assert.equal(BRIDGE_ROUTE, '/dsh-matugen/palette')
  assert.equal(POLL_MS, 1000)
  assert.equal(SOURCE_ID, 'dsh-matugen')
  assert.equal(DIAGNOSTIC_INTERVAL_MS, 60_000)
})

test('context category CSS follows the DSH light/dark marker and only overrides known dsh-context seed marks', () => {
  const categories = contextCategoryPalette()
  assert.deepEqual(normalizeContextCategories(categories), categories)
  const css = contextCategoryCss(categories)

  assert.match(css, /:root\{--dsh-matugen-context-system:#[0-9a-f]{6};/u)
  assert.match(css, /body\[data-ds-dark-theme\]\{--dsh-matugen-context-system:#[0-9a-f]{6};/u)
  assert.match(css, /:where\(\.lc-root,\.lc-modal-card\) \.lc-stacked-seg\[style\*="#6366f1"\]/u)
  assert.match(css, /\.lc-bar-stack > div\[style\*="rgb\(99, 102, 241\)"\]/u)
  assert.match(css, /\.lc-node > i\[style\*="#14b8a6"\]/u)
  assert.match(css, /background:var\(--dsh-matugen-context-assistant\) !important/u)
  assert.doesNotMatch(css, /\.lc-turn/u)
})

test('context category payload rejects renamed or unknown identities without affecting the core bridge validator', () => {
  const categories = contextCategoryPalette()
  assert.throws(
    () => normalizeContextCategories({ ...categories, system: { ...categories.system, seed: '#000000' } }),
    /seed does not match/u,
  )
  assert.throws(
    () => normalizeContextCategories({ ...categories, extra: categories.system }),
    /exactly the six/u,
  )
})

test('browser applies one digest-verified reversible ThemeRuntime override layer', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  let effectCleanup
  let layerDisposed = false
  let resolveApplied
  const applied = new Promise(resolve => { resolveApplied = resolve })

  globalThis.fetch = async (input, init) => {
    calls.push({ input, init })
    return {
      ok: true,
      status: 200,
      async json() {
        return payload()
      },
    }
  }

  try {
    const ctx = {
      theme: {
        overrideTokens(source, layer) {
          calls.push({ source, layer })
          resolveApplied()
          return () => { layerDisposed = true }
        },
      },
      effect(setup) {
        effectCleanup = setup()
      },
    }
    apply(ctx)
    await Promise.race([
      applied,
      timeout(250, 'theme layer was not applied'),
    ])

    assert.equal(calls[0].input, BRIDGE_ROUTE)
    assert.equal(calls[0].init.method, 'GET')
    assert.equal(calls[0].init.headers, undefined)
    assert.equal(calls[1].source, SOURCE_ID)
    assert.deepEqual(calls[1].layer['--dsw-alias-brand-primary'], {
      light: '#123456',
      dark: '#abcdef',
    })
    assert.deepEqual(calls[1].layer['--dsw-alias-state-business-primary'], {
      light: '#123456',
      dark: '#abcdef',
    })
    assert.deepEqual(calls[1].layer['--dsw-alias-button-info-fill'], {
      light: '#123456',
      dark: '#abcdef',
    })

    effectCleanup()
    assert.equal(layerDisposed, true)
  } finally {
    globalThis.fetch = originalFetch
    effectCleanup?.()
  }
})

test('polling uses whole-snapshot revision and metadata-only changes do not reinstall ThemeRuntime tokens', async () => {
  const originalFetch = globalThis.fetch
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const requests = []
  const scheduled = []
  let effectCleanup
  let themeInstalls = 0
  let responseIndex = 0
  let resolveFirstInstall
  let resolveSecondFetch
  const firstInstall = new Promise(resolve => { resolveFirstInstall = resolve })
  const secondFetch = new Promise(resolve => { resolveSecondFetch = resolve })
  const responses = [
    payload({ snapshotRevision: 'a'.repeat(64) }),
    payload({ snapshotRevision: 'b'.repeat(64) }),
  ]

  globalThis.fetch = async (input, init) => {
    requests.push({ input, init })
    if (requests.length === 2) resolveSecondFetch()
    const body = responses[Math.min(responseIndex, responses.length - 1)]
    responseIndex += 1
    return { ok: true, status: 200, async json() { return body } }
  }
  globalThis.setTimeout = (fn) => {
    scheduled.push(fn)
    return scheduled.length
  }
  globalThis.clearTimeout = () => {}

  try {
    const ctx = {
      theme: {
        overrideTokens() {
          themeInstalls += 1
          if (themeInstalls === 1) resolveFirstInstall()
          return () => {}
        },
      },
      effect(setup) { effectCleanup = setup() },
    }
    apply(ctx)
    await firstInstall
    assert.equal(themeInstalls, 1)
    assert.equal(requests[0].init.headers, undefined)
    assert.equal(scheduled.length, 1)

    scheduled.shift()()
    await secondFetch
    await tick()
    assert.deepEqual(requests[1].init.headers, { 'if-none-match': `"${'a'.repeat(64)}"` })
    assert.equal(themeInstalls, 1, 'same semantic token revision must not reinstall ThemeRuntime layer')
  } finally {
    effectCleanup?.()
    globalThis.fetch = originalFetch
    globalThis.setTimeout = originalSetTimeout
    globalThis.clearTimeout = originalClearTimeout
  }
})

test('dispose while response.json is pending cannot install an orphan theme layer', async () => {
  const originalFetch = globalThis.fetch
  let releaseJson
  const pendingJson = new Promise(resolve => { releaseJson = resolve })
  let effectCleanup
  let applied = 0
  let disposed = 0

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => pendingJson,
  })

  try {
    const ctx = {
      theme: {
        overrideTokens() {
          applied += 1
          return () => { disposed += 1 }
        },
      },
      effect(setup) {
        effectCleanup = setup()
      },
    }

    apply(ctx)
    await tick()
    effectCleanup()
    releaseJson(payload())
    await tick()
    await tick()

    assert.equal(applied, 0)
    assert.equal(disposed, 0)
  } finally {
    globalThis.fetch = originalFetch
    effectCleanup?.()
  }
})

test('tampered payload is diagnosed and never reaches ThemeRuntime', async () => {
  const originalFetch = globalThis.fetch
  const originalWarn = console.warn
  const warnings = []
  let effectCleanup
  let applied = 0
  let resolveWarning
  const warningObserved = new Promise(resolve => { resolveWarning = resolve })
  const value = payload()
  value.tokens = {
    ...value.tokens,
    '--dsw-alias-brand-primary': {
      light: '#000000',
      dark: '#000000',
    },
  }

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    async json() { return value },
  })
  console.warn = (...args) => {
    warnings.push(args)
    resolveWarning()
  }

  try {
    const ctx = {
      theme: {
        overrideTokens() {
          applied += 1
          return () => {}
        },
      },
      effect(setup) {
        effectCleanup = setup()
      },
    }
    apply(ctx)
    await Promise.race([
      warningObserved,
      timeout(250, 'tampered payload diagnostic was not emitted'),
    ])

    assert.equal(applied, 0)
    assert.equal(warnings.length, 1)
    assert.match(String(warnings[0][0]), /palette sync degraded/u)
    effectCleanup()
  } finally {
    globalThis.fetch = originalFetch
    console.warn = originalWarn
    effectCleanup?.()
  }
})
