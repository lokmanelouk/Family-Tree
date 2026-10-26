import assert from 'node:assert/strict'
import test from 'node:test'
import { getRelationshipTooltipPosition } from './relationship-tooltip-position.ts'

test('places the tooltip above its anchor when space is available', () => {
  const result = getRelationshipTooltipPosition({ x: 180, y: 100 }, { width: 140, height: 32 }, { width: 400, height: 300 })
  assert.deepEqual(result, { left: 180, top: 92, placement: 'above' })
})

test('flips below the anchor when there is not enough room above', () => {
  const result = getRelationshipTooltipPosition({ x: 180, y: 18 }, { width: 140, height: 32 }, { width: 400, height: 300 })
  assert.deepEqual(result, { left: 180, top: 26, placement: 'below' })
})

test('clamps horizontally near both viewport edges', () => {
  const left = getRelationshipTooltipPosition({ x: 2, y: 140 }, { width: 140, height: 32 }, { width: 400, height: 300 })
  const right = getRelationshipTooltipPosition({ x: 398, y: 140 }, { width: 140, height: 32 }, { width: 400, height: 300 })
  assert.equal(left.left, 82)
  assert.equal(right.left, 318)
})

test('keeps coordinates synchronized with a scrolled canvas viewport', () => {
  const result = getRelationshipTooltipPosition({ x: 180, y: 100 }, { width: 140, height: 32 }, { width: 400, height: 300, scrollLeft: 240, scrollTop: 90 })
  assert.deepEqual(result, { left: 420, top: 182, placement: 'above' })
})
