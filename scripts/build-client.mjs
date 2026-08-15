import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const corePath = resolve(root, 'src/core.js')
const clientPath = resolve(root, 'src/client.js')
const outputPath = resolve(root, 'lib/client.js')
const CLIENT_IMPORT = "import { verifyBridgePayload } from './core.js'\n"
const DECLARATION_EXPORT = /^export (?:const|class|function|async function) [A-Za-z_$][A-Za-z0-9_$]*/u

function assertKnownExports(source, label) {
  for (const line of source.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('export ')) continue
    if (DECLARATION_EXPORT.test(trimmed)) continue
    throw new Error(`dsh-matugen build: unsupported export syntax in ${label}: ${JSON.stringify(trimmed)}`)
  }
}

function stripModuleSyntax(source, label) {
  assertKnownExports(source, label)
  const transformed = source.replace(/^export\s+/gmu, '')
  if (/^\s*(?:import|export)\s/mu.test(transformed)) {
    throw new Error(`dsh-matugen build: unsupported ESM syntax remains in ${label}`)
  }
  return transformed.trimEnd()
}

const [coreSource, clientSource] = await Promise.all([
  readFile(corePath, 'utf8'),
  readFile(clientPath, 'utf8'),
])

if (/^\s*import\s/mu.test(coreSource)) {
  throw new Error('dsh-matugen build: src/core.js must remain dependency-free')
}
if (!clientSource.startsWith(CLIENT_IMPORT)) {
  throw new Error(
    'dsh-matugen build: src/client.js must import only verifyBridgePayload from ./core.js as its first statement',
  )
}

const clientBodySource = clientSource.slice(CLIENT_IMPORT.length)
if (/^\s*import\s/mu.test(clientBodySource)) {
  throw new Error('dsh-matugen build: browser client contains an additional import')
}

const core = stripModuleSyntax(coreSource, 'src/core.js')
const client = stripModuleSyntax(clientBodySource, 'src/client.js')
const publicNames = [
  'inject',
  'SOURCE_ID',
  'BRIDGE_ROUTE',
  'POLL_MS',
  'DIAGNOSTIC_INTERVAL_MS',
  'apply',
]

const artifact = [
  'window.__ModuleLoader__.load({ id: "dsh-matugen", factory: (require) => {',
  "'use strict'",
  'var module = { exports: {} }; var exports = module.exports;',
  '',
  core,
  '',
  client,
  '',
  `module.exports = { ${publicNames.join(', ')} };`,
  'return module.exports;',
  '} });',
  '',
].join('\n')

if (/\brequire\s*\(/u.test(artifact)) {
  throw new Error('dsh-matugen build: generated browser artifact unexpectedly contains require()')
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, artifact, 'utf8')
