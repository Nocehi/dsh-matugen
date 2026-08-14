import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createPaletteHandler, readDmsSnapshot } from '../src/index.js'

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
      light: { ...shared, background: '#ffffff', on_surface: '#111111' },
      dark: shared,
    },
  }
}

function fakeResponse() {
  return {
    status: undefined,
    headers: undefined,
    body: Buffer.alloc(0),
    writeHead(status, headers) {
      this.status = status
      this.headers = headers
    },
    end(chunk) {
      if (chunk !== undefined) this.body = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    },
  }
}

test('host snapshot hashes normalized semantic tokens', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-matugen-'))
  const path = join(root, 'dms-colors.json')
  try {
    await writeFile(path, JSON.stringify(palette()))
    const first = await readDmsSnapshot(path)
    await writeFile(path, JSON.stringify(palette(), null, 2))
    const second = await readDmsSnapshot(path)
    assert.equal(first.revision, second.revision)
    assert.equal(first.tokens['--dsw-alias-brand-primary'].dark, '#abcdef')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('read-only route returns normalized palette and supports HEAD', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-matugen-'))
  const path = join(root, 'dms-colors.json')
  try {
    await writeFile(path, JSON.stringify(palette()))
    const handler = createPaletteHandler({ palettePath: path })

    const get = fakeResponse()
    await handler({ method: 'GET' }, get)
    assert.equal(get.status, 200)
    assert.equal(get.headers['cache-control'], 'no-store')
    assert.match(get.headers.etag, /^"[0-9a-f]{64}"$/u)
    const body = JSON.parse(get.body.toString('utf8'))
    assert.equal(body.ok, true)
    assert.equal(body.provider, 'dms')
    assert.equal(body.tokens['--dsw-alias-bg-base'].light, '#ffffff')

    const head = fakeResponse()
    await handler({ method: 'HEAD' }, head)
    assert.equal(head.status, 200)
    assert.equal(head.body.byteLength, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('route fails closed without leaking the configured path', async () => {
  const handler = createPaletteHandler({ palettePath: '/definitely/missing/dms-colors.json' })
  const response = fakeResponse()
  await handler({ method: 'GET' }, response)
  assert.equal(response.status, 503)
  const bodyText = response.body.toString('utf8')
  assert.equal(JSON.parse(bodyText).code, 'palette-not-found')
  assert.doesNotMatch(bodyText, /definitely\/missing/u)
})

test('route is read-only', async () => {
  const handler = createPaletteHandler({ palettePath: '/unused' })
  const response = fakeResponse()
  await handler({ method: 'POST' }, response)
  assert.equal(response.status, 405)
  assert.equal(response.headers.allow, 'GET, HEAD')
})
