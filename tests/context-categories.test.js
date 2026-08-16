import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Hct, argbFromHex, hexFromArgb } from '@material/material-color-utilities'
import {
  CONTEXT_CATEGORY_SEEDS,
  CONTEXT_CATEGORY_TONES,
  contextCategoryPalette,
} from '../src/context-categories.js'

function hueDistance(a, b) {
  const raw = Math.abs(a - b) % 360
  return Math.min(raw, 360 - raw)
}

test('context categories keep seed hue/chroma intent and adapt with HCT tone', () => {
  const palette = contextCategoryPalette()
  assert.deepEqual(Object.keys(palette), Object.keys(CONTEXT_CATEGORY_SEEDS))
  assert.deepEqual(CONTEXT_CATEGORY_TONES, { light: 40, dark: 80 })

  for (const [key, seed] of Object.entries(CONTEXT_CATEGORY_SEEDS)) {
    const source = Hct.fromInt(argbFromHex(seed))
    const lightExpected = hexFromArgb(Hct.from(source.hue, source.chroma, 40).toInt())
    const darkExpected = hexFromArgb(Hct.from(source.hue, source.chroma, 80).toInt())
    assert.deepEqual(palette[key], { seed, light: lightExpected, dark: darkExpected })

    const light = Hct.fromInt(argbFromHex(palette[key].light))
    const dark = Hct.fromInt(argbFromHex(palette[key].dark))
    assert(Math.abs(light.tone - 40) < 1, `${key} light tone should be HCT 40`)
    assert(Math.abs(dark.tone - 80) < 1, `${key} dark tone should be HCT 80`)
    assert(hueDistance(light.hue, source.hue) < 3, `${key} light hue should preserve category identity`)
    assert(hueDistance(dark.hue, source.hue) < 3, `${key} dark hue should preserve category identity`)
  }
})

test('context category palette is immutable and deterministic', () => {
  const first = contextCategoryPalette()
  const second = contextCategoryPalette()
  assert.deepEqual(first, second)
  assert.equal(Object.isFrozen(first), true)
  for (const entry of Object.values(first)) assert.equal(Object.isFrozen(entry), true)
})
