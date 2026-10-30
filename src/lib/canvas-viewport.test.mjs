import assert from 'node:assert/strict'
import test from 'node:test'
import { getCanvasLocalOrigin, getScrollPreservingCanvasCenter } from './canvas-viewport.ts'

test('zoom keeps the same canvas point at the viewport center after offset and size changes', () => {
  const previous = {
    scrollLeft: 230,
    scrollTop: 175,
    viewportWidth: 800,
    viewportHeight: 560,
    worldLeft: 36,
    worldTop: 48,
    zoomX: 0.8,
    zoomY: 0.8,
  }
  const next = { zoomX: 1.1, zoomY: 1.1, offsetX: 44, offsetY: 52 }
  const viewport = { width: 780, height: 540 }
  const scroll = getScrollPreservingCanvasCenter(previous, viewport, next)
  const previousCenter = {
    x: (previous.scrollLeft + previous.viewportWidth / 2 - previous.worldLeft) / previous.zoomX,
    y: (previous.scrollTop + previous.viewportHeight / 2 - previous.worldTop) / previous.zoomY,
  }
  const nextCenter = {
    x: (scroll.left + viewport.width / 2 - next.offsetX) / next.zoomX,
    y: (scroll.top + viewport.height / 2 - next.offsetY) / next.zoomY,
  }

  assert.ok(Math.abs(nextCenter.x - previousCenter.x) < 1e-9)
  assert.ok(Math.abs(nextCenter.y - previousCenter.y) < 1e-9)
})

test('canvas local origin converts screen-pixel positioning into the scaled world coordinate space', () => {
  assert.deepEqual(getCanvasLocalOrigin(48, 72, 1.2, 0.8), { left: 40, top: 90 })
  assert.deepEqual(getCanvasLocalOrigin(48, 72, 0, 0), { left: 48, top: 72 })
})
