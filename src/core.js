export const BRIDGE_VERSION = 2

/**
 * Direct DMS Material-role -> DSH semantic-token mappings.
 *
 * This table deliberately targets DSH alias/specific tokens only. The stock
 * --dsw-static-* palette remains an implementation detail of the built-in
 * theme and is never rewritten by the bridge.
 */
export const DSH_TOKEN_ROLE_MAP = Object.freeze({
  // Surface hierarchy.
  '--dsw-alias-bg-base': 'background',
  '--dsw-alias-bg-layer-1': 'surface_container_low',
  '--dsw-alias-bg-layer-2': 'surface_container',
  '--dsw-alias-bg-layer-3': 'surface_container_high',
  '--dsw-alias-bg-overlay': 'surface_container_highest',
  '--dsw-alias-bg-module-platform': 'surface_container_low',
  '--dsw-alias-bg-multi-select': 'secondary_container',
  '--dsw-alias-button-contrast-fill': 'inverse_surface',
  '--dsw-alias-button-elevated-fill': 'surface_container_low',
  '--dsw-alias-button-floating-fill': 'surface_container_high',
  '--dsw-alias-button-primary-dimmed': 'primary_container',
  '--dsw-alias-interactive-bg-hover-solid': 'surface_container_high',
  '--dsw-alias-markdown-citation': 'on_surface_variant',
  '--dsw-alias-markdown-code-block-banner': 'surface_container_high',
  '--dsw-alias-markdown-code-block': 'surface_container',
  '--dsw-alias-markdown-code-segment-selected': 'surface_container_high',
  '--dsw-alias-markdown-code-segment-unselected': 'surface_container',
  '--dsw-alias-markdown-inline-code': 'surface_container_high',
  '--dsw-alias-markdown-placeholder': 'surface_container_high',
  '--dsw-alias-markdown-tag': 'surface_container_high',
  '--dsw-alias-toast-bg': 'inverse_surface',
  '--dsw-alias-tooltip-bg': 'inverse_surface',
  '--dsw-specific-bubble-highlight': 'primary_container',
  '--dsw-specific-bubble': 'surface_container_high',
  '--dsw-specific-input-major': 'surface_container_high',
  '--dsw-specific-login-input': 'surface_container',
  '--dsw-specific-menu': 'surface_container_high',
  '--dsw-specific-selector': 'secondary_container',
  '--dsw-specific-sidebar-fill': 'surface_container_low',
  '--dsw-specific-sidebar-nav-item-active-accent': 'primary_container',
  '--dsw-specific-sidebar-nav-item-active': 'secondary_container',
  '--dsw-specific-sidebar-nav-item-hover': 'surface_container_high',
  '--dsw-specific-tip': 'surface_container_high',

  // Foreground and outline hierarchy.
  '--dsw-alias-border-l1': 'outline_variant',
  '--dsw-alias-border-l2-darkmode-thin': 'outline_variant',
  '--dsw-alias-border-l2': 'outline',
  '--dsw-alias-brand-primary-invert': 'on_primary',
  '--dsw-alias-label-caption': 'outline',
  '--dsw-alias-label-dimmed': 'on_surface_variant',
  '--dsw-alias-label-primary-bluish': 'primary',
  '--dsw-alias-label-primary-dimmed': 'on_surface_variant',
  '--dsw-alias-label-primary-foreground': 'on_primary',
  '--dsw-alias-label-primary-inverted': 'inverse_on_surface',
  '--dsw-alias-label-primary': 'on_surface',
  '--dsw-alias-label-secondary': 'on_surface_variant',
  '--dsw-alias-label-tertiary': 'outline',

  // Primary / secondary / tertiary accent families.
  '--dsw-alias-brand-primary-new-colorprimary-new-color': 'primary',
  '--dsw-alias-brand-primary': 'primary',
  '--dsw-alias-brand-text': 'primary',
  '--dsw-alias-button-ghost-active-border': 'secondary',
  '--dsw-alias-button-ghost-active-fill': 'secondary_container',
  '--dsw-alias-button-info-fill': 'primary',
  '--dsw-alias-button-primary-fill': 'primary',
  '--dsw-alias-state-business-primary': 'primary',
  '--dsw-alias-state-business-tertiary': 'tertiary',

  // Operational error semantics remain error semantics.
  '--dsw-alias-state-error-primary': 'error',
  '--dsw-alias-state-error-secondary': 'error',
})

/**
 * Compatibility fallbacks for DMS palettes that expose the original v1 role
 * floor but not every newer Material 3 family. Exact roles always win.
 */
export const MATERIAL_ROLE_FALLBACKS = Object.freeze({
  surface_container_highest: Object.freeze(['surface_container_high']),
  primary_container: Object.freeze(['primary']),
  on_primary: Object.freeze(['on_surface']),
  secondary: Object.freeze(['primary']),
  secondary_container: Object.freeze(['surface_container_high']),
  on_secondary_container: Object.freeze(['on_surface_variant', 'on_surface']),
  tertiary: Object.freeze(['secondary', 'primary']),
  inverse_surface: Object.freeze(['surface_container_high']),
  inverse_on_surface: Object.freeze(['on_surface']),
})

/**
 * DSH state-layer tokens do not have one-to-one Material scheme roles. They
 * are derived from Material role pairs so hover/active chrome follows the
 * wallpaper without inventing new static palette entries.
 */
export const DSH_TOKEN_DERIVATION_MAP = Object.freeze({
  '--dsw-alias-bg-skeleton': Object.freeze({ kind: 'alpha', role: 'on_surface', opacity: 0.08 }),
  '--dsw-alias-button-floating-hover': Object.freeze({ kind: 'mix', base: 'surface_container_high', overlay: 'on_surface', opacity: 0.08 }),
  '--dsw-alias-button-ghost-active-hover': Object.freeze({ kind: 'mix', base: 'secondary_container', overlay: 'on_secondary_container', opacity: 0.08 }),
  '--dsw-alias-button-info-hover': Object.freeze({ kind: 'mix', base: 'primary', overlay: 'on_primary', opacity: 0.08 }),
  '--dsw-alias-button-primary-hover': Object.freeze({ kind: 'mix', base: 'primary', overlay: 'on_primary', opacity: 0.08 }),
  '--dsw-alias-interactive-bg-active': Object.freeze({ kind: 'alpha', role: 'on_surface', opacity: 0.14 }),
  '--dsw-alias-interactive-bg-hover-accent': Object.freeze({ kind: 'alpha', role: 'primary', opacity: 0.16 }),
  '--dsw-alias-interactive-bg-hover-danger': Object.freeze({ kind: 'alpha', role: 'error', opacity: 0.15 }),
  '--dsw-alias-interactive-bg-hover': Object.freeze({ kind: 'alpha', role: 'on_surface', opacity: 0.08 }),
})

const OPTIONAL_DANK16_MAP = Object.freeze({
  '--dsw-alias-state-success-primary': 'color2',
  '--dsw-alias-state-warn-label': 'color3',
  '--dsw-alias-state-warn-primary': 'color3',
})

export const REQUIRED_DSH_TOKENS = Object.freeze([
  ...Object.keys(DSH_TOKEN_ROLE_MAP),
  ...Object.keys(DSH_TOKEN_DERIVATION_MAP),
].sort())
export const OPTIONAL_DSH_TOKENS = Object.freeze(Object.keys(OPTIONAL_DANK16_MAP).sort())

const BRIDGE_TOKEN_SET = new Set([...REQUIRED_DSH_TOKENS, ...OPTIONAL_DSH_TOKENS])
const HEX_COLOR = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/iu
const DSH_TOKEN = /^--dsw-[a-z0-9-]+$/u
const SHA256 = /^[0-9a-f]{64}$/u
const SHA256_K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

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
  const palette = mode(document, name)
  const candidates = [role, ...(MATERIAL_ROLE_FALLBACKS[role] ?? [])]
  for (const candidate of candidates) {
    if (palette[candidate] !== undefined) {
      return color(palette[candidate], `DMS palette.colors.${name}.${candidate}`)
    }
  }
  throw new PaletteError('missing-role', `DMS palette.colors.${name}.${role} is required`)
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

function parseColor(value) {
  const hex = value.slice(1)
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
    alpha: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255,
  }
}

function byteHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

function formatColor({ red, green, blue, alpha }) {
  const roundedAlpha = Math.max(0, Math.min(255, Math.round(alpha)))
  const rgb = `#${byteHex(red)}${byteHex(green)}${byteHex(blue)}`
  return roundedAlpha === 255 ? rgb : `${rgb}${byteHex(roundedAlpha)}`
}

function mixColor(base, overlay, opacity) {
  const a = parseColor(base)
  const b = parseColor(overlay)
  const inverse = 1 - opacity
  return formatColor({
    red: a.red * inverse + b.red * opacity,
    green: a.green * inverse + b.green * opacity,
    blue: a.blue * inverse + b.blue * opacity,
    alpha: a.alpha * inverse + b.alpha * opacity,
  })
}

function alphaColor(value, opacity) {
  const parsed = parseColor(value)
  return formatColor({ ...parsed, alpha: parsed.alpha * opacity })
}

function derivedMaterialColor(document, spec, name, token) {
  if (spec.kind === 'alpha') {
    return alphaColor(materialRole(document, spec.role, name), spec.opacity)
  }
  if (spec.kind === 'mix') {
    return mixColor(
      materialRole(document, spec.base, name),
      materialRole(document, spec.overlay, name),
      spec.opacity,
    )
  }
  throw new PaletteError('invalid-derivation', `unsupported derivation for ${token}`)
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

  for (const [token, spec] of Object.entries(DSH_TOKEN_DERIVATION_MAP)) {
    tokens[token] = Object.freeze({
      light: derivedMaterialColor(document, spec, 'light', token),
      dark: derivedMaterialColor(document, spec, 'dark', token),
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

function validateBridgeTokenSet(tokens) {
  for (const required of REQUIRED_DSH_TOKENS) {
    if (!(required in tokens)) {
      throw new PaletteError('missing-token', `bridge payload is missing required token ${required}`)
    }
  }
  for (const name of Object.keys(tokens)) {
    if (!BRIDGE_TOKEN_SET.has(name)) {
      throw new PaletteError('unsupported-token', `bridge payload contains unsupported token ${name}`)
    }
  }
}

/** Validate bridge protocol shape before any asynchronous digest work. */
export function validateBridgePayload(value) {
  const payload = record(value, 'invalid-payload', 'bridge payload')
  if (payload.version !== BRIDGE_VERSION) {
    throw new PaletteError('unsupported-version', `unsupported bridge version ${String(payload.version)}`)
  }
  if (payload.provider !== 'dms') {
    throw new PaletteError('unsupported-provider', `unsupported palette provider ${String(payload.provider)}`)
  }
  if (typeof payload.revision !== 'string' || !SHA256.test(payload.revision)) {
    throw new PaletteError('invalid-revision', 'bridge revision must be a lowercase SHA-256')
  }
  const tokens = validateTokenLayer(payload.tokens)
  validateBridgeTokenSet(tokens)
  return Object.freeze({
    version: BRIDGE_VERSION,
    provider: 'dms',
    revision: payload.revision,
    tokens,
  })
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('')
}

function rotateRight(value, bits) {
  return (value >>> bits) | (value << (32 - bits))
}

/** Dependency-free SHA-256 fallback for browser origins where SubtleCrypto is unavailable. */
function sha256Fallback(bytes) {
  const paddedLength = Math.ceil((bytes.byteLength + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.byteLength] = 0x80

  const bitLength = bytes.byteLength * 8
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const words = new Uint32Array(64)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false)
    }
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15]
      const y = words[index - 2]
      const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3)
      const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10)
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0
    }

    let a = hash[0]
    let b = hash[1]
    let c = hash[2]
    let d = hash[3]
    let e = hash[4]
    let f = hash[5]
    let g = hash[6]
    let h = hash[7]

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choose = (e & f) ^ (~e & g)
      const temp1 = (h + sum1 + choose + SHA256_K[index] + words[index]) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    hash[0] = (hash[0] + a) >>> 0
    hash[1] = (hash[1] + b) >>> 0
    hash[2] = (hash[2] + c) >>> 0
    hash[3] = (hash[3] + d) >>> 0
    hash[4] = (hash[4] + e) >>> 0
    hash[5] = (hash[5] + f) >>> 0
    hash[6] = (hash[6] + g) >>> 0
    hash[7] = (hash[7] + h) >>> 0
  }

  return [...hash].map(value => value.toString(16).padStart(8, '0')).join('')
}

/**
 * Validate the bridge payload and prove that revision is the SHA-256 digest of
 * its canonical token layer. Web Crypto is preferred, but ordinary HTTP
 * origins still verify through the dependency-free SHA-256 fallback.
 */
export async function verifyBridgePayload(value, cryptoImpl = globalThis.crypto) {
  const payload = validateBridgePayload(value)
  const encoded = new TextEncoder().encode(canonicalTokenJson(payload.tokens))
  const actual = cryptoImpl?.subtle !== undefined && typeof cryptoImpl.subtle.digest === 'function'
    ? bytesToHex(await cryptoImpl.subtle.digest('SHA-256', encoded))
    : sha256Fallback(encoded)
  if (actual !== payload.revision) {
    throw new PaletteError('revision-mismatch', 'bridge revision does not match canonical token bytes')
  }
  return payload
}
