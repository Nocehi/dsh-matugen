import { defineConfig } from 'tsdown'

const id = 'dsh-matugen'

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
  outputOptions: {
    exports: 'named',
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
