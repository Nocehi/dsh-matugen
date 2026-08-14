import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
  apply,
  BRIDGE_ROUTE,
  POLL_MS,
  SOURCE_ID,
} from '../src/client.js'
import { canonicalTokenJson, dmsPaletteToDshTokens } from '../src/core.js'

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

test('browser transport geometry is a fixed package contract', () => {
  assert.equal(BRIDGE_ROUTE, '/dsh-matugen/palette')
  assert.equal(POLL_MS, 1000)
  assert.equal(SOURCE_ID, 'dsh-matugen')
})

test('browser applies one reversible ThemeRuntime override layer', async () => {
  const originalFetch = globalThis.fetch
  const tokens = dmsPaletteToDshTokens(palette())
  const revision = createHash('sha256').update(canonicalTokenJson(tokens)).digest('hex')
  const calls = []
  let effectCleanup
  let layerDisposed = false

  globalThis.fetch = async (input, init) => {
    calls.push({ input, init })
    return {
      ok: true,
      async json() {
        return { ok: true, version: 1, provider: 'dms', revision, tokens }
      },
    }
  }

  try {
    const ctx = {
      theme: {
        overrideTokens(source, layer) {
          calls.push({ source, layer })
          return () => { layerDisposed = true }
        },
      },
      effect(setup) {
        effectCleanup = setup()
      },
    }
    apply(ctx)
    await new Promise(resolve => setTimeout(resolve, 0))

    assert.equal(calls[0].input, BRIDGE_ROUTE)
    assert.equal(calls[0].init.method, 'GET')
    assert.equal(calls[1].source, SOURCE_ID)
    assert.deepEqual(calls[1].layer['--dsw-alias-brand-primary'], {
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
