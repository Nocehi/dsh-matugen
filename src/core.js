export const BRIDGE_VERSION = 1

export const DSH_TOKEN_ROLE_MAP = Object.freeze({
  '--dsw-alias-bg-base': 'background',
  '--dsw-alias-bg-layer-1': 'surface_container_low',
  '--dsw-alias-bg-layer-2': 'surface_container',
  '--dsw-alias-bg-overlay': 'surface_container_high',
  '--dsw-alias-border-l1': 'outline_variant',
  '--dsw-alias-border-l2': 'outline',
  '--dsw-alias-brand-primary': 'primary',
  '--dsw-alias-label-primary': 'on_surface',
  '--dsw-alias-label-secondary': 'on_surface_variant',
  '--dsw-alias-state-error-primary': 'error',
  '--dsw-specific-sidebar-fill': 'surface_container_low',
})

const OPTIONAL_DANK16_MAP = Object.freeze({
  '--dsw-alias-state-success-primary': 'color2',
  '--dsw-alias-state-warn-primary': 'color3',
})

const HEX_COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu
const DSH_TOKEN = /^--dsw-[a-z0-9-]+$/u

export class PaletteError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'PaletteError'
    this.code = code
  }
}

function record(value, code, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PaletteError(code, `${label} must be an object`)
  }
  return value
}

function color(value, label) {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) {
    throw new PaletteError('invalid-color', `${label} must be a #RRGGBB or #RRGGBBAA color`)
  }
  return value.toLowerCase()
}

function mode(document, name) {
  const root = record(document, 'invalid-root', 'DMS palette')
  const colors = record(root.colors, 'missing-colors', 'DMS palette.colors')
  return record(colors[name], 'missing-mode', `DMS palette.colors.${name}`)
}

function materialRole(document, role, name) {
  const value = mode(document, name)[role]
  if (value === undefined) {
    throw new PaletteError('missing-role', `DMS palette.colors.${name}.${role} is required`)
  }
  return color(value, `DMS palette.colors.${name}.${role}`)
}

function optionalDank16(document, role, name) {
  if (document === null || typeof document !== 'object' || Array.isArray(document)) return undefined
  const dank16 = document.dank16
  if (dank16 === null || typeof dank16 !== 'object' || Array.isArray(dank16)) return undefined
  const entry = dank16[role]
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return undefined
  if (entry[name] === undefined) return undefined
  return color(entry[name], `DMS palette.dank16.${role}.${name}`)
}

/** Convert one DMS dms-colors.json document into a DSH light/dark override layer. */
export function dmsPaletteToDshTokens(document) {
  mode(document, 'light')
  mode(document, 'dark')

  const tokens = {}
  for (const [token, role] of Object.entries(DSH_TOKEN_ROLE_MAP)) {
    tokens[token] = Object.freeze({
      light: materialRole(document, role, 'light'),
      dark: materialRole(document, role, 'dark'),
    })
  }

  for (const [token, role] of Object.entries(OPTIONAL_DANK16_MAP)) {
    const light = optionalDank16(document, role, 'light')
    const dark = optionalDank16(document, role, 'dark')
    if (light !== undefined && dark !== undefined) {
      tokens[token] = Object.freeze({ light, dark })
    }
  }

  return Object.freeze(tokens)
}

/** Stable JSON used for semantic revision hashes; input key order is irrelevant. */
export function canonicalTokenJson(tokens) {
  const validated = validateTokenLayer(tokens)
  const ordered = {}
  for (const name of Object.keys(validated).sort()) {
    ordered[name] = { light: validated[name].light, dark: validated[name].dark }
  }
  return JSON.stringify(ordered)
}

/** Validate the exact shape accepted by DSH ThemeRuntime.overrideTokens(). */
export function validateTokenLayer(value) {
  const layer = record(value, 'invalid-token-layer', 'token layer')
  const result = {}
  for (const [name, modes] of Object.entries(layer)) {
    if (!DSH_TOKEN.test(name)) {
      throw new PaletteError('invalid-token-name', `invalid DSH theme token ${JSON.stringify(name)}`)
    }
    const pair = record(modes, 'invalid-token-modes', `token ${name}`)
    const keys = Object.keys(pair).sort()
    if (keys.length !== 2 || keys[0] !== 'dark' || keys[1] !== 'light') {
      throw new PaletteError('invalid-token-modes', `token ${name} must contain exactly light and dark`)
    }
    result[name] = Object.freeze({
      light: color(pair.light, `${name}.light`),
      dark: color(pair.dark, `${name}.dark`),
    })
  }
  if (Object.keys(result).length === 0) {
    throw new PaletteError('empty-token-layer', 'token layer must not be empty')
  }
  return Object.freeze(result)
}

/** Validate the host-to-browser bridge payload before it reaches ThemeRuntime. */
export function validateBridgePayload(value) {
  const payload = record(value, 'invalid-payload', 'bridge payload')
  if (payload.version !== BRIDGE_VERSION) {
    throw new PaletteError('unsupported-version', `unsupported bridge version ${String(payload.version)}`)
  }
  if (payload.provider !== 'dms') {
    throw new PaletteError('unsupported-provider', `unsupported palette provider ${String(payload.provider)}`)
  }
  if (typeof payload.revision !== 'string' || !/^[0-9a-f]{64}$/u.test(payload.revision)) {
    throw new PaletteError('invalid-revision', 'bridge revision must be a lowercase SHA-256')
  }
  return Object.freeze({
    version: BRIDGE_VERSION,
    provider: 'dms',
    revision: payload.revision,
    tokens: validateTokenLayer(payload.tokens),
  })
}
