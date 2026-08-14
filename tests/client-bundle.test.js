import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { test } from 'node:test'

test('built client registers one DSH lazy module factory', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  let registration
  const window = {
    __ModuleLoader__: {
      load(value) {
        assert.equal(registration, undefined, 'client bundle registered more than once')
        registration = value
      },
    },
  }

  vm.runInNewContext(source, { window }, { filename: 'lib/client.js' })
  assert.equal(registration?.id, 'dsh-matugen')
  assert.equal(typeof registration?.factory, 'function')

  const exports = registration.factory((specifier) => {
    throw new Error(`unexpected external client dependency: ${specifier}`)
  })
  assert.equal(typeof exports.apply, 'function')
  assert.equal(exports.default, exports.apply)
  assert.deepEqual(Array.from(exports.inject), ['theme'])
  assert.equal(exports.SOURCE_ID, 'dsh-matugen')
})

test('package client export points at the built artifact', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.exports['./client'], './lib/client.js')
  assert.equal(manifest.dsh.client.platform, 'web')
  assert.deepEqual(manifest.dsh.client.inject, ['@deepseek-ai/dsh-client-ui-theme'])
})
