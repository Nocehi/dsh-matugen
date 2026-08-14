import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import {
  BRIDGE_VERSION,
  PaletteError,
  canonicalTokenJson,
  dmsPaletteToDshTokens,
} from './core.js'

export const inject = ['webServer']
export const BRIDGE_ROUTE = '/dsh-matugen/palette'
export const DEFAULT_MAX_BYTES = 256 * 1024
export const DEFAULT_DMS_PALETTE = join(homedir(), '.cache', 'DankMaterialShell', 'dms-colors.json')

function palettePath(value) {
  if (value === undefined) return process.env.DSH_MATUGEN_PALETTE || DEFAULT_DMS_PALETTE
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError('dsh-matugen: palettePath must be a non-empty string')
  if (value === '~') return homedir()
  if (value.startsWith('~/')) return join(homedir(), value.slice(2))
  return isAbsolute(value) ? value : resolve(value)
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

export async function readDmsSnapshot(path, maxBytes = DEFAULT_MAX_BYTES) {
  const raw = await readFile(path)
  if (raw.byteLength > maxBytes) {
    throw new PaletteError('palette-too-large', `DMS palette exceeds ${maxBytes} bytes`)
  }
  let document
  try {
    document = JSON.parse(raw.toString('utf8'))
  } catch {
    throw new PaletteError('invalid-json', 'DMS palette is not valid JSON')
  }
  const tokens = dmsPaletteToDshTokens(document)
  const revision = createHash('sha256').update(canonicalTokenJson(tokens)).digest('hex')
  return Object.freeze({ version: BRIDGE_VERSION, provider: 'dms', revision, tokens })
}

function responseJson(res, status, body, headers = {}) {
  const bytes = Buffer.from(`${JSON.stringify(body)}\n`, 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(bytes.byteLength),
    ...headers,
  })
  res.end(bytes)
}

function unavailableCode(error) {
  if (error instanceof PaletteError) return error.code
  if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return 'palette-not-found'
  return 'palette-unavailable'
}

export function createPaletteHandler(config = {}) {
  const normalized = normalizeHostConfig(config)
  return async (req, res) => {
    const method = req.method ?? 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
      responseJson(res, 405, { ok: false, code: 'method-not-allowed' }, { allow: 'GET, HEAD' })
      return
    }

    let snapshot
    try {
      snapshot = await readDmsSnapshot(normalized.palettePath, normalized.maxPaletteBytes)
    } catch (error) {
      responseJson(res, 503, { ok: false, code: unavailableCode(error) })
      return
    }

    const body = { ok: true, ...snapshot }
    const bytes = Buffer.from(`${JSON.stringify(body)}\n`, 'utf8')
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': String(bytes.byteLength),
      etag: `"${snapshot.revision}"`,
    }
    res.writeHead(200, headers)
    res.end(method === 'HEAD' ? undefined : bytes)
  }
}

/** Host half: expose only normalized palette tokens on the fixed browser contract route. */
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

export default apply
