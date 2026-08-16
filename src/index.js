import { createHash } from 'node:crypto'
import { open } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import {
  BRIDGE_VERSION,
  PaletteError,
  canonicalTokenJson,
  dmsPaletteToDshTokens,
} from './core.js'
import { contextCategoryPalette } from './context-categories.js'

export const inject = ['webServer']
export const BRIDGE_ROUTE = '/dsh-matugen/palette'
export const DEFAULT_MAX_BYTES = 256 * 1024
export const DEFAULT_DMS_PALETTE = join(homedir(), '.cache', 'DankMaterialShell', 'dms-colors.json')

function palettePath(value) {
  const selected = value === undefined
    ? (process.env.DSH_MATUGEN_PALETTE ?? DEFAULT_DMS_PALETTE)
    : value
  if (typeof selected !== 'string' || selected.trim() === '') {
    throw new TypeError('dsh-matugen: palettePath must be a non-empty string')
  }
  if (selected === '~') return homedir()
  if (selected.startsWith('~/')) return join(homedir(), selected.slice(2))
  return isAbsolute(selected) ? selected : resolve(selected)
}

function byteLimit(value) {
  const limit = value ?? DEFAULT_MAX_BYTES
  if (!Number.isSafeInteger(limit) || limit < 4096 || limit > 1024 * 1024) {
    throw new TypeError('dsh-matugen: maxPaletteBytes must be an integer between 4096 and 1048576')
  }
  return limit
}

export function normalizeHostConfig(config = {}) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) throw new TypeError('dsh-matugen: config must be an object')
  const unknown = Object.keys(config).filter(key => key !== 'palettePath' && key !== 'maxPaletteBytes')
  if (unknown.length > 0) {
    throw new TypeError(`dsh-matugen: unknown Host config field ${JSON.stringify(unknown[0])}`)
  }
  return Object.freeze({
    palettePath: palettePath(config.palettePath),
    maxPaletteBytes: byteLimit(config.maxPaletteBytes),
  })
}

async function readBoundedRegularFile(path, maxBytes) {
  const handle = await open(path, 'r')
  try {
    const stat = await handle.stat()
    if (!stat.isFile()) {
      throw new PaletteError('palette-not-regular-file', 'DMS palette must be a regular file')
    }
    if (stat.size > maxBytes) {
      throw new PaletteError('palette-too-large', `DMS palette exceeds ${maxBytes} bytes`)
    }

    // The file may grow after stat(). Read through the already-open descriptor
    // and cap the total bytes independently of pathname races or producer
    // replacement. DMS's atomic rename therefore yields either old or new
    // complete bytes, never an unbounded follow-up read through the pathname.
    const buffer = Buffer.allocUnsafe(maxBytes + 1)
    let total = 0
    while (total <= maxBytes) {
      const { bytesRead } = await handle.read(
        buffer,
        total,
        maxBytes + 1 - total,
        total,
      )
      if (bytesRead === 0) break
      total += bytesRead
      if (total > maxBytes) {
        throw new PaletteError('palette-too-large', `DMS palette exceeds ${maxBytes} bytes`)
      }
    }
    return buffer.subarray(0, total)
  } finally {
    await handle.close()
  }
}

export async function readDmsSnapshot(path, maxBytes = DEFAULT_MAX_BYTES) {
  const limit = byteLimit(maxBytes)
  const raw = await readBoundedRegularFile(path, limit)
  let document
  try {
    document = JSON.parse(raw.toString('utf8'))
  } catch {
    throw new PaletteError('invalid-json', 'DMS palette is not valid JSON')
  }
  const tokens = dmsPaletteToDshTokens(document)
  const revision = createHash('sha256').update(canonicalTokenJson(tokens)).digest('hex')
  // Extended data colors are intentionally outside ThemeRuntime's --dsw-*
  // layer. Their hue/chroma identity is fixed; HCT tone supplies the light /
  // dark adaptation and the client scopes them to compatible data-viz surfaces.
  const contextCategories = contextCategoryPalette()
  return Object.freeze({ version: BRIDGE_VERSION, provider: 'dms', revision, tokens, contextCategories })
}

function responseJson(res, status, body, headers = {}, head = false) {
  const bytes = Buffer.from(`${JSON.stringify(body)}\n`, 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(bytes.byteLength),
    ...headers,
  })
  res.end(head ? undefined : bytes)
}

function unavailableCode(error) {
  if (error instanceof PaletteError) return error.code
  if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return 'palette-not-found'
  return 'palette-unavailable'
}

function requestHeader(req, name) {
  const value = req.headers?.[name]
  if (Array.isArray(value)) return value.join(',')
  return typeof value === 'string' ? value : undefined
}

function etagMatches(value, etag) {
  if (value === undefined) return false
  return value.split(',').some(candidate => {
    const tag = candidate.trim()
    return tag === '*' || tag === etag || tag === `W/${etag}`
  })
}

export function createPaletteHandler(config = {}) {
  const normalized = normalizeHostConfig(config)
  return async (req, res) => {
    const method = req.method ?? 'GET'
    const head = method === 'HEAD'
    if (method !== 'GET' && !head) {
      responseJson(res, 405, { ok: false, code: 'method-not-allowed' }, { allow: 'GET, HEAD' })
      return
    }

    let snapshot
    try {
      snapshot = await readDmsSnapshot(normalized.palettePath, normalized.maxPaletteBytes)
    } catch (error) {
      responseJson(res, 503, { ok: false, code: unavailableCode(error) }, {}, head)
      return
    }

    const etag = `"${snapshot.revision}"`
    if (etagMatches(requestHeader(req, 'if-none-match'), etag)) {
      res.writeHead(304, {
        'cache-control': 'no-store',
        etag,
      })
      res.end()
      return
    }

    const body = { ok: true, ...snapshot }
    const bytes = Buffer.from(`${JSON.stringify(body)}\n`, 'utf8')
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': String(bytes.byteLength),
      etag,
    }
    res.writeHead(200, headers)
    res.end(head ? undefined : bytes)
  }
}

/** Host half: expose normalized palette tokens and bounded extended data colors. */
export function apply(ctx, config = {}) {
  const normalized = normalizeHostConfig(config)
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: BRIDGE_ROUTE,
      handler: createPaletteHandler(normalized),
    }),
    'dsh-matugen: palette route',
  )
}
