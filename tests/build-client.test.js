import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

async function copyFixture(temp) {
  const files = [
    'scripts/build-client.mjs',
    'src/core.js',
    'src/client.js',
  ]
  for (const relative of files) {
    const source = new URL(`../${relative}`, import.meta.url)
    const target = join(temp, relative)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, await readFile(source, 'utf8'))
  }
}

test('deterministic builder rejects dynamic import()', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'dsh-matugen-build-'))
  try {
    await copyFixture(temp)
    const clientPath = join(temp, 'src/client.js')
    const source = await readFile(clientPath, 'utf8')
    await writeFile(clientPath, `${source}\nvoid import('./escape.js')\n`)

    const result = spawnSync(
      process.execPath,
      [join(temp, 'scripts/build-client.mjs')],
      { cwd: temp, encoding: 'utf8' },
    )

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /dynamic import\(\) is forbidden in src\/client\.js/u)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
