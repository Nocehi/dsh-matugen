import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
  BRIDGE_VERSION,
  DSH_TOKEN_DERIVATION_MAP,
  DSH_TOKEN_ROLE_MAP,
  OPTIONAL_DSH_TOKENS,
  REQUIRED_DSH_TOKENS,
  canonicalTokenJson,
  dmsPaletteToDshTokens,
  validateBridgePayload,
  verifyBridgePayload,
} from '../src/core.js'

function makeDms({ dank16 = true } = {}) {
  const light = {
    background: '#fff8f6',
    surface_container_low: '#fff0ed',
    surface_container: '#fbe9e6',
    surface_container_high: '#f5e3e0',
    surface_container_highest: '#efddda',
    primary: '#825500',
    on_primary: '#ffffff',
    primary_container: '#ffddb0',
    secondary: '#6f5b40',
    secondary_container: '#f9debc',
    on_secondary_container: '#281805',
    tertiary: '#516440',
    inverse_surface: '#352f2b',
    inverse_on_surface: '#faefe8',
    inverse_primary: '#ffb95c',
    on_surface: '#211a17',
    on_surface_variant: '#51443d',
    outline: '#83746c',
    outline_variant: '#d6c3bb',
    error: '#ba1a1a',
    error_container: '#ffdad6',
  }
  const dark = {
    background: '#1f1b16',
    surface_container_low: '#27231e',
    surface_container: '#2b2722',
    surface_container_high: '#36312c',
    surface_container_highest: '#413c37',
    primary: '#ffb95c',
    on_primary: '#452b00',
    primary_container: '#634000',
    secondary: '#dbc2a0',
    secondary_container: '#57442b',
    on_secondary_container: '#f9debc',
    tertiary: '#b8cca5',
    inverse_surface: '#eae1d9',
    inverse_on_surface: '#352f2b',
    inverse_primary: '#825500',
    on_surface: '#eae1d9',
    on_surface_variant: '#d6c3bb',
    outline: '#9f8d84',
    outline_variant: '#51443d',
    error: '#ffb4ab',
    error_container: '#93000a',
  }
  const result = { colors: { light, dark } }
  if (dank16) {
    result.dank16 = {
      color2: { light: '#207a42', dark: '#73da8c' },
      color3: { light: '#8a5700', dark: '#ffba47' },
    }
  }
  return result
}

function revision(tokens) {
  return createHash('sha256').update(canonicalTokenJson(tokens)).digest('hex')
}

test('semantic bridge v2 covers Material surfaces and accent families without rewriting static DSH palette', () => {
  assert.equal(BRIDGE_VERSION, 2)
  assert(REQUIRED_DSH_TOKENS.length > 40)
  assert.equal(REQUIRED_DSH_TOKENS.some(token => token.startsWith('--dsw-static-')), false)
  assert.equal(OPTIONAL_DSH_TOKENS.some(token => token.startsWith('--dsw-static-')), false)

  const tokens = dmsPaletteToDshTokens(makeDms())
  assert.equal(Object.keys(tokens).length, REQUIRED_DSH_TOKENS.length + OPTIONAL_DSH_TOKENS.length)

  assert.deepEqual(tokens['--dsw-alias-bg-base'], { light: '#fff8f6', dark: '#1f1b16' })
  assert.deepEqual(tokens['--dsw-alias-bg-layer-3'], { light: '#f5e3e0', dark: '#36312c' })
  assert.deepEqual(tokens['--dsw-alias-bg-overlay'], { light: '#efddda', dark: '#413c37' })
  assert.deepEqual(tokens['--dsw-specific-input-major'], { light: '#f5e3e0', dark: '#36312c' })
  assert.deepEqual(tokens['--dsw-specific-sidebar-fill'], { light: '#fff0ed', dark: '#27231e' })

  assert.deepEqual(tokens['--dsw-alias-state-business-primary'], { light: '#825500', dark: '#ffb95c' })
  assert.deepEqual(tokens['--dsw-alias-button-info-fill'], { light: '#825500', dark: '#ffb95c' })
  assert.deepEqual(tokens['--dsw-alias-button-ghost-active-border'], { light: '#6f5b40', dark: '#dbc2a0' })
  assert.deepEqual(tokens['--dsw-specific-selector'], { light: '#f9debc', dark: '#57442b' })
  assert.deepEqual(tokens['--dsw-alias-state-business-tertiary'], { light: '#516440', dark: '#b8cca5' })

  assert.deepEqual(tokens['--dsw-alias-state-error-primary'], { light: '#ba1a1a', dark: '#ffb4ab' })
  assert.deepEqual(tokens['--dsw-alias-state-success-primary'], { light: '#207a42', dark: '#73da8c' })
  assert.deepEqual(tokens['--dsw-alias-state-warn-primary'], { light: '#8a5700', dark: '#ffba47' })
})

test('derived state layers follow Material role pairs rather than DeepSeek static blue', () => {
  const tokens = dmsPaletteToDshTokens(makeDms())
  assert.deepEqual(tokens['--dsw-alias-button-info-hover'], { light: '#8c6314', dark: '#f0ae55' })
  assert.deepEqual(tokens['--dsw-alias-interactive-bg-hover'], { light: '#211a1714', dark: '#eae1d914' })
  assert.deepEqual(tokens['--dsw-alias-interactive-bg-hover-accent'], { light: '#82550029', dark: '#ffb95c29' })
  assert.deepEqual(tokens['--dsw-alias-interactive-bg-hover-danger'], { light: '#ba1a1a26', dark: '#ffb4ab26' })
})

test('required role absence fails closed and optional Dank16 absence does not', () => {
  const missing = makeDms()
  delete missing.colors.dark.primary
  assert.throws(
    () => dmsPaletteToDshTokens(missing),
    error => error?.code === 'missing-role' && /primary/u.test(error.message),
  )

  const tokens = dmsPaletteToDshTokens(makeDms({ dank16: false }))
  assert.equal(Object.keys(tokens).length, REQUIRED_DSH_TOKENS.length)
  for (const token of OPTIONAL_DSH_TOKENS) assert.equal(token in tokens, false)
})

test('new Material families prefer exact roles but fall back to the legacy DMS role floor', () => {
  const value = makeDms()
  for (const palette of Object.values(value.colors)) {
    delete palette.surface_container_highest
    delete palette.primary_container
    delete palette.on_primary
    delete palette.secondary
    delete palette.secondary_container
    delete palette.on_secondary_container
    delete palette.tertiary
    delete palette.inverse_surface
    delete palette.inverse_on_surface
  }
  const tokens = dmsPaletteToDshTokens(value)
  assert.deepEqual(tokens['--dsw-alias-bg-overlay'], { light: '#f5e3e0', dark: '#36312c' })
  assert.deepEqual(tokens['--dsw-alias-button-ghost-active-border'], { light: '#825500', dark: '#ffb95c' })
  assert.deepEqual(tokens['--dsw-specific-selector'], { light: '#f5e3e0', dark: '#36312c' })
  assert.deepEqual(tokens['--dsw-alias-state-business-tertiary'], { light: '#825500', dark: '#ffb95c' })
})

test('invalid colors fail closed before ThemeRuntime', () => {
  const value = makeDms()
  value.colors.light.background = 'rgb(1 2 3)'
  assert.throws(() => dmsPaletteToDshTokens(value), /#RRGGBB/u)
})

test('canonical token JSON is independent of input key order', () => {
  const tokens = dmsPaletteToDshTokens(makeDms())
  const entries = Object.entries(tokens).reverse()
  assert.equal(canonicalTokenJson(Object.fromEntries(entries)), canonicalTokenJson(tokens))
})

test('bridge v2 accepts exactly the semantic token corpus and rejects v1 or unknown tokens', () => {
  const tokens = dmsPaletteToDshTokens(makeDms())
  const payload = { version: BRIDGE_VERSION, provider: 'dms', revision: revision(tokens), tokens }
  assert.equal(validateBridgePayload(payload).version, 2)
  assert.throws(
    () => validateBridgePayload({ ...payload, version: 1 }),
    error => error?.code === 'unsupported-version',
  )
  const missingTokens = { ...tokens }
  delete missingTokens['--dsw-alias-bg-base']
  assert.throws(
    () => validateBridgePayload({ ...payload, tokens: missingTokens }),
    error => error?.code === 'missing-token',
  )
  assert.throws(
    () => validateBridgePayload({ ...payload, tokens: { ...tokens, '--dsw-alias-made-up': { light: '#000000', dark: '#ffffff' } } }),
    error => error?.code === 'unsupported-token',
  )
})

test('digest verification works with WebCrypto and dependency-free fallback', async () => {
  const tokens = dmsPaletteToDshTokens(makeDms())
  const payload = { version: BRIDGE_VERSION, provider: 'dms', revision: revision(tokens), tokens }
  assert.equal((await verifyBridgePayload(payload)).revision, payload.revision)
  assert.equal((await verifyBridgePayload(payload, {})).revision, payload.revision)

  const tampered = { ...payload, tokens: { ...tokens, '--dsw-alias-brand-primary': { light: '#000000', dark: '#000000' } } }
  await assert.rejects(() => verifyBridgePayload(tampered, {}), error => error?.code === 'revision-mismatch')
})

test('exported maps are non-overlapping and every required token comes from one semantic mapping path', () => {
  const direct = new Set(Object.keys(DSH_TOKEN_ROLE_MAP))
  const derived = new Set(Object.keys(DSH_TOKEN_DERIVATION_MAP))
  for (const token of derived) assert.equal(direct.has(token), false)
  assert.deepEqual([...new Set([...direct, ...derived])].sort(), [...REQUIRED_DSH_TOKENS])
})
