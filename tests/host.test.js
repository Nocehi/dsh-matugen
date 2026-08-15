import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  BRIDGE_ROUTE,
  createPaletteHandler,
  normalizeHostConfig,
  readDmsSnapshot,
} from '../src/index.js'

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

test('host transport route is fixed and fake cross-face config fails closed', () => {
  assert.equal(BRIDGE_ROUTE, '/dsh-matugen/palette')
  assert.throws(() => normalizeHostConfig({ route: '/other' }), /unknown Host config field "route"/u)
  assert.throws(() => normalizeHostConfig({ pollMs: 250 }), /unknown Host config field "pollMs"/u)
})

test('environment palette path goes through the same normalization as explicit config', () => {
  const before = process.env.DSH_MATUGEN_PALETTE
  try {
    process.env.DSH_MATUGEN_PALETTE = '~/dsh-matugen-test.json'
    assert.equal(
      normalizeHostConfig().palettePath,
      join(homedir(), 'dsh-matugen-test.json'),
    )
    process.env.DSH_MATUGEN_PALETTE = ''
    assert.throws(() => normalizeHostConfig(), /non-empty string/u)
  } finally {
    if (before === undefined) delete process.env.DSH_MATUGEN_PALETTE
    else process.env.DSH_MATUGEN_PALETTE = before
  }
})

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

test('palette read is bounded before JSON parsing and rejects non-regular paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-matugen-'))
  const oversized = join(root, 'oversized.json')
  const directory = join(root, 'directory')
  try {
    await writeFile(oversized, Buffer.alloc(4097, 0x20))
    await assert.rejects(
      readDmsSnapshot(oversized, 4096),
      error => error?.code === 'palette-too-large',
    )
    await mkdir(directory)
    await assert.rejects(
      readDmsSnapshot(directory, 4096),
      error => error?.code === 'palette-not-regular-file',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('read-only route returns normalized palette, supports HEAD, and honors If-None-Match', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-matugen-'))
  const path = join(root, 'dms-colors.json')
  try {
    await writeFile(path, JSON.stringify(palette()))
    const handler = createPaletteHandler({ palettePath: path })

    const get = fakeResponse()
    await handler({ method: 'GET', headers: {} }, get)
    assert.equal(get.status, 200)
    assert.equal(get.headers['cache-control'], 'no-store')
    assert.match(get.headers.etag, /^"[0-9a-f]{64}"$/u)
    const body = JSON.parse(get.body.toString('utf8'))
    assert.equal(body.ok, true)
    assert.equal(body.provider, 'dms')
    assert.equal(body.tokens['--dsw-alias-bg-base'].light, '#ffffff')

    const unchanged = fakeResponse()
    await handler({
      method: 'GET',
      headers: { 'if-none-match': get.headers.etag },
    }, unchanged)
    assert.equal(unchanged.status, 304)
    assert.equal(unchanged.headers.etag, get.headers.etag)
    assert.equal(unchanged.body.byteLength, 0)

    const weak = fakeResponse()
    await handler({
      method: 'GET',
      headers: { 'if-none-match': `W/${get.headers.etag}` },
    }, weak)
    assert.equal(weak.status, 304)

    const head = fakeResponse()
    await handler({ method: 'HEAD', headers: {} }, head)
    assert.equal(head.status, 200)
    assert.equal(head.body.byteLength, 0)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('route fails closed without leaking the configured path', async () => {
  const handler = createPaletteHandler({ palettePath: '/definitely/missing/dms-colors.json' })
  const response = fakeResponse()
  await handler({ method: 'GET', headers: {} }, response)
  assert.equal(response.status, 503)
  const bodyText = response.body.toString('utf8')
  assert.equal(JSON.parse(bodyText).code, 'palette-not-found')
  assert.doesNotMatch(bodyText, /definitely\/missing/u)
})

test('HEAD failures have no response body', async () => {
  const handler = createPaletteHandler({ palettePath: '/definitely/missing/dms-colors.json' })
  const response = fakeResponse()
  await handler({ method: 'HEAD', headers: {} }, response)
  assert.equal(response.status, 503)
  assert.equal(response.body.byteLength, 0)
})

test('route is read-only', async () => {
  const handler = createPaletteHandler({ palettePath: '/unused' })
  const response = fakeResponse()
  await handler({ method: 'POST', headers: {} }, response)
  assert.equal(response.status, 405)
  assert.equal(response.headers.allow, 'GET, HEAD')
})
