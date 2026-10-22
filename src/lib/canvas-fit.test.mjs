import test from 'node:test'
import assert from 'node:assert/strict'
import { getFitZoom, getTreeContentBounds } from './canvas-fit.ts'

test('fit bounds use visible node extents with room for relationship anchors', () => {
  const bounds = getTreeContentBounds({
    positions: new Map([
      ['first', { x: 70, y: 32, generation: 0 }],
      ['last', { x: 344, y: 238, generation: 1 }],
    ]),
    width: 940,
    height: 380,
    nodeWidth: 240,
    nodeHeight: 106,
  })
  assert.deepEqual(bounds, { left: 58, top: 20, width: 538, height: 336 })
})

test('fit zoom includes all content and comfortable viewport padding', () => {
  const zoom = getFitZoom({ left: 0, top: 0, width: 1000, height: 500 }, 900, 600)
  assert.equal(zoom, 0.812)
})

test('fit zoom respects configured lower and upper limits', () => {
  assert.equal(getFitZoom({ left: 0, top: 0, width: 5000, height: 3000 }, 600, 400), 0.25)
  assert.equal(getFitZoom({ left: 0, top: 0, width: 100, height: 80 }, 1200, 900), 1.4)
})
