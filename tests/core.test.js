import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
  canonicalTokenJson,
  dmsPaletteToDshTokens,
  validateBridgePayload,
} from '../src/core.js'

function palette() {
  const light = {
    background: '#fff8fb',
    surface_container_low: '#fff0f5',
    surface_container: '#f9e8ee',
    surface_container_high: '#f3e2e8',
    outline_variant: '#d9c1c8',
    outline: '#887078',
    primary: '#8d4961',
    on_surface: '#211a1d',
    on_surface_variant: '#514348',
    error: '#ba1a1a',
  }
  const dark = {
    background: '#181114',
    surface_container_low: '#21191d',
    surface_container: '#251d21',
    surface_container_high: '#30282c',
    outline_variant: '#544149',
    outline: '#a88b95',
    primary: '#ffb1c8',
    on_surface: '#eee0e4',
    on_surface_variant: '#d8c1c8',
    error: '#ffb4ab',
  }
  return {
    colors: { light, dark },
    dank16: {
      color2: { light: '#397a3f', dark: '#83d883', default: '#83d883' },
      color3: { light: '#78590a', dark: '#edc35b', default: '#edc35b' },
    },
  }
}

test('maps DMS Material roles into DSH light/dark token overrides', () => {
  const tokens = dmsPaletteToDshTokens(palette())
  assert.deepEqual(tokens['--dsw-alias-bg-base'], { light: '#fff8fb', dark: '#181114' })
  assert.deepEqual(tokens['--dsw-alias-brand-primary'], { light: '#8d4961', dark: '#ffb1c8' })
  assert.deepEqual(tokens['--dsw-alias-state-success-primary'], { light: '#397a3f', dark: '#83d883' })
  assert.deepEqual(tokens['--dsw-alias-state-warn-primary'], { light: '#78590a', dark: '#edc35b' })
})

test('dank16 success/warn roles are optional', () => {
  const value = palette()
  delete value.dank16
  const tokens = dmsPaletteToDshTokens(value)
  assert.equal(tokens['--dsw-alias-state-success-primary'], undefined)
  assert.equal(tokens['--dsw-alias-state-warn-primary'], undefined)
})

test('missing required Material roles fail closed', () => {
  const value = palette()
  delete value.colors.dark.primary
  assert.throws(() => dmsPaletteToDshTokens(value), /primary is required/u)
})

test('invalid colors fail closed before ThemeRuntime', () => {
  const value = palette()
  value.colors.light.background = 'rgb(1 2 3)'
  assert.throws(() => dmsPaletteToDshTokens(value), /#RRGGBB/u)
})

test('canonical token JSON is stable across object insertion order', () => {
  const tokens = dmsPaletteToDshTokens(palette())
  const reversed = Object.fromEntries(Object.entries(tokens).reverse())
  assert.equal(canonicalTokenJson(tokens), canonicalTokenJson(reversed))
})

test('bridge payload requires a SHA-256 revision and validates both modes', () => {
  const tokens = dmsPaletteToDshTokens(palette())
  const revision = createHash('sha256').update(canonicalTokenJson(tokens)).digest('hex')
  const payload = validateBridgePayload({ version: 1, provider: 'dms', revision, tokens, ok: true })
  assert.equal(payload.revision, revision)
  assert.deepEqual(payload.tokens['--dsw-alias-label-primary'], {
    light: '#211a1d',
    dark: '#eee0e4',
  })
})
