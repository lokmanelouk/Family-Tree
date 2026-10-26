import test from 'node:test'
import assert from 'node:assert/strict'
import { getMiniMapViewportGeometry, getMiniMapWorldPoint } from './minimap-geometry.ts'

const base = {
  mapWidth: 168,
  mapHeight: 110,
  padding: 9,
  worldWidth: 1000,
  worldHeight: 600,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  scrollLeft: 0,
  scrollTop: 0,
  viewportWidth: 500,
  viewportHeight: 300,
}

test('minimap viewport matches the visible canvas fraction', () => {
  const geometry = getMiniMapViewportGeometry(base)
  assert.equal(geometry.scale, 0.15)
  assert.deepEqual(geometry.rect, { x: 9, y: 10, width: 75, height: 45 })
})

test('minimap viewport updates its size and position for zoom and pan', () => {
  const geometry = getMiniMapViewportGeometry({ ...base, zoom: 2, scrollLeft: 300, scrollTop: 180, viewportWidth: 500, viewportHeight: 300 })
  assert.deepEqual(geometry.rect, { x: 31.5, y: 23.5, width: 37.5, height: 22.5 })
})

test('minimap viewport tracks the unobscured canvas width when a details panel is open', () => {
  const geometry = getMiniMapViewportGeometry({ ...base, viewportWidth: 300 })
  assert.deepEqual(geometry.rect, { x: 9, y: 10, width: 45, height: 45 })
})

test('minimap viewport remains within content bounds when centered or scrolled past an edge', () => {
  const geometry = getMiniMapViewportGeometry({ ...base, offsetX: 200, offsetY: 100, scrollLeft: 0, scrollTop: 0, viewportWidth: 1400, viewportHeight: 900 })
  assert.deepEqual(geometry.rect, { x: 9, y: 10, width: 150, height: 90 })
})

test('minimap points map into clamped canvas coordinates', () => {
  const geometry = getMiniMapViewportGeometry(base)
  assert.deepEqual(getMiniMapWorldPoint(84, 55, geometry, base.worldWidth, base.worldHeight), { x: 500, y: 300 })
  assert.deepEqual(getMiniMapWorldPoint(-10, 300, geometry, base.worldWidth, base.worldHeight), { x: 0, y: base.worldHeight })
})
