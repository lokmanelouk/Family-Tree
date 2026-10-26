import assert from 'node:assert/strict'
import test from 'node:test'
import { getAnchoredPopoverArrowSide, getAnchoredPopoverPosition } from './anchored-popover-position.ts'

const anchor = { left: 450, right: 490, top: 18, bottom: 58, width: 40, height: 40 }

test('anchors below the trigger and aligns the arrow with it', () => {
  const result = getAnchoredPopoverPosition(anchor, 320, 280, 900, 700)
  assert.equal(result.side, 'bottom')
  assert.equal(result.left, 310)
  assert.equal(result.top, 66)
  assert.equal(result.arrowOffset, 160)
})

test('opens above the trigger when there is not enough room below', () => {
  const result = getAnchoredPopoverPosition({ ...anchor, top: 620, bottom: 660 }, 320, 280, 900, 700)
  assert.equal(result.side, 'top')
  assert.equal(result.top, 332)
})

test('clamps the popover and arrow within a narrow viewport', () => {
  const result = getAnchoredPopoverPosition({ left: 0, right: 30, top: 5, bottom: 35, width: 30, height: 30 }, 320, 500, 280, 400)
  assert.equal(result.left, 12)
  assert.equal(result.width, 256)
  assert.equal(result.top, 12)
  assert.equal(result.arrowOffset, 16)
})

test('places the guide arrow on the edge facing its trigger', () => {
  assert.equal(getAnchoredPopoverArrowSide('bottom'), 'top')
  assert.equal(getAnchoredPopoverArrowSide('top'), 'bottom')
})
