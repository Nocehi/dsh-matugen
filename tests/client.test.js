import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeClientConfig } from '../src/client.js'

test('client config defaults to same-origin route with one-second polling', () => {
  assert.deepEqual(normalizeClientConfig(), {
    route: '/dsh-matugen/palette',
    pollMs: 1000,
  })
})

test('client config rejects route ambiguity and pathological polling', () => {
  assert.throws(() => normalizeClientConfig({ route: 'https://example.com/palette' }), /absolute non-root pathname/u)
  assert.throws(() => normalizeClientConfig({ pollMs: 1 }), /between 250 and 60000/u)
})
