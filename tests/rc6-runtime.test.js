import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply as applyHost, BRIDGE_ROUTE } from '../src/index.js'
import { dmsPaletteToDshTokens } from '../src/core.js'

const require = createRequire(import.meta.url)

function palette() {
  const shared = {
    background: '#101010',
    surface_container_low: '#181818',
    surface_container: '#202020',
    surface_container_high: '#282828',
    outline_variant: '#505050',
    outline: '#808080',
    primary: '#abcdef',
    on_surface: '#eeeeee',
    on_surface_variant: '#cccccc',
    error: '#ffb4ab',
  }
  return {
    colors: {
      light: { ...shared, background: '#ffffff', primary: '#123456', on_surface: '#111111' },
      dark: shared,
    },
  }
}

test('exact DSH rc.6 Host WebServer serves the bridge route', async () => {
  const manifestPath = require.resolve('@deepseek-ai/dsh/package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.equal(manifest.version, '0.1.0-rc.6')

  const [{ Context }, { default: WebServer }] = await Promise.all([
    import('@deepseek-ai/cordis'),
    import('@deepseek-ai/dsh-host-webserver'),
  ])

  const temp = await mkdtemp(join(tmpdir(), 'dsh-matugen-rc6-'))
  const path = join(temp, 'dms-colors.json')
  const root = new Context()
  try {
    await writeFile(path, JSON.stringify(palette()))
    await root.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    applyHost(root, { palettePath: path })

    const response = await fetch(`http://127.0.0.1:${String(root.webServer.port)}${BRIDGE_ROUTE}`)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.version, 1)
    assert.equal(body.provider, 'dms')
    assert.equal(body.tokens['--dsw-alias-brand-primary'].light, '#123456')
  } finally {
    await root.fiber.dispose()
    await rm(temp, { recursive: true, force: true })
  }
})

test('exact DSH rc.6 ThemeRuntime accepts and reverses the bridge layer', async () => {
  const [{ Context }, { ThemeRuntime }] = await Promise.all([
    import('@deepseek-ai/cordis'),
    import('@deepseek-ai/dsh-client-ui-theme/client'),
  ])

  const root = new Context()
  const listeners = new Set()
  const settings = {
    getSnapshot() {
      return { value: undefined }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async set() {},
  }

  try {
    const theme = new ThemeRuntime(root, settings)
    const tokens = dmsPaletteToDshTokens(palette())
    const dispose = theme.overrideTokens('dsh-matugen-rc6-smoke', tokens)
    assert.equal(
      theme.getTheme().active.tokens['--dsw-alias-brand-primary'],
      '#123456',
    )
    dispose()
    assert.equal(
      theme.getTheme().active.tokens['--dsw-alias-brand-primary'],
      undefined,
    )
  } finally {
    await root.fiber.dispose()
  }
})
