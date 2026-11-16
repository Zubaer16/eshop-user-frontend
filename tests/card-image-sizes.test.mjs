import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cardImageSizes } from '../lib/card-image-sizes.ts'

test('card source hints follow two, three and four-column grids with inner padding', () => {
  const sizes = cardImageSizes({ width: 6000, height: 4000 })
  assert.match(sizes, /min-width: 768px/)
  assert.match(sizes, /100vw - 104px/)
  assert.match(sizes, /1240px/)
  assert.match(sizes, /32\.0000px/)
  const catalog = cardImageSizes(null, 'catalog')
  assert.match(catalog, /100vw - 367px/)
  assert.match(catalog, /303px/)
})

test('portrait cards request the visible contained width without changing their geometry', () => {
  const portrait = cardImageSizes({ width: 4000, height: 6000 })
  assert.match(portrait, /0\.6472/)
  assert.match(portrait, /21\.3333px/)
  assert.doesNotMatch(portrait, /NaN|Infinity/)
})
