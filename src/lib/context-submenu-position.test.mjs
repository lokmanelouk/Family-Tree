import test from 'node:test'
import assert from 'node:assert/strict'
import { getContextSubmenuPosition } from './context-submenu-position.ts'

test('context submenu opens to the right when there is room', () => {
  const position = getContextSubmenuPosition({ left: 240, right: 454, top: 140, bottom: 420 }, 1100, 800)
  assert.equal(position.placement, 'inline')
  assert.equal(position.left, 460)
  assert.equal(position.top, 140)
})

test('context submenu flips to the left when the right side is too narrow', () => {
  const position = getContextSubmenuPosition({ left: 650, right: 864, top: 100, bottom: 400 }, 1024, 768)
  assert.equal(position.placement, 'inline')
  assert.equal(position.left, 332)
})

test('context submenu uses a viewport-safe stacked position when neither side fits', () => {
  const position = getContextSubmenuPosition({ left: 140, right: 354, top: 120, bottom: 380 }, 600, 800)
  assert.equal(position.placement, 'stacked')
  assert.ok(position.left >= 8)
  assert.ok(position.top >= 8)
  assert.ok(position.left + position.width <= 592)
  assert.ok(position.top + position.maxHeight <= 792)
})

test('context submenu clamps its height and position to a short viewport', () => {
  const position = getContextSubmenuPosition({ left: 300, right: 514, top: 5, bottom: 55 }, 800, 320)
  assert.equal(position.maxHeight, 304)
  assert.ok(position.top >= 8)
  assert.ok(position.top + position.maxHeight <= 312)
})

test('context submenu avoids an open details panel by opening on the opposite side', () => {
  const panel = { left: 780, right: 1100, top: 0, bottom: 800 }
  const position = getContextSubmenuPosition({ left: 560, right: 760, top: 120, bottom: 390 }, 1100, 800, 312, 420, 6, [panel])
  assert.equal(position.placement, 'inline')
  assert.equal(position.left, 242)
  assert.ok(position.left + position.width <= panel.left)
})

test('context submenu opens to the right when an RTL-side details panel occupies the left edge', () => {
  const panel = { left: 0, right: 320, top: 0, bottom: 800 }
  const position = getContextSubmenuPosition({ left: 350, right: 550, top: 120, bottom: 390 }, 1100, 800, 312, 420, 6, [panel])
  assert.equal(position.placement, 'inline')
  assert.equal(position.left, 556)
  assert.ok(position.left >= panel.right)
})

test('context submenu keeps its viewport-safe fallback when the panel takes both sides', () => {
  const panel = { left: 0, right: 1100, top: 0, bottom: 800 }
  const position = getContextSubmenuPosition({ left: 400, right: 600, top: 100, bottom: 360 }, 1100, 800, 312, 420, 6, [panel])
  assert.ok(position.placement === 'inline' || position.placement === 'stacked')
  assert.ok(position.left >= 8)
  assert.ok(position.top >= 8)
})
