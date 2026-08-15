import { defineConfig } from 'tsdown'

const id = 'dsh-matugen'

function localClientImportOnly(source, importer) {
  if (importer === undefined) return null
  if (source.startsWith('.') || source.startsWith('/') || source.startsWith('\0')) return null
  throw new Error(
    `dsh-matugen client import boundary: bare value import ${JSON.stringify(source)} is forbidden; `
    + 'keep the browser bundle self-contained and collaborate with DSH through injected Cordis services',
  )
}

export default defineConfig({
  name: `${id}/client`,
  entry: { client: 'src/client.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: true,
  deps: {
    alwaysBundle: () => true,
  },
  plugins: [{
    name: 'dsh-matugen-client-import-boundary',
    resolveId: localClientImportOnly,
  }],
  outputOptions: {
    exports: 'named',
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
