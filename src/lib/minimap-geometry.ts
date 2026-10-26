export type MiniMapViewportInput = {
  mapWidth: number
  mapHeight: number
  padding: number
  worldWidth: number
  worldHeight: number
  zoom: number
  offsetX: number
  offsetY: number
  scrollLeft: number
  scrollTop: number
  viewportWidth: number
  viewportHeight: number
}

export type MiniMapViewportGeometry = {
  scale: number
  offsetMapX: number
  offsetMapY: number
  worldMapWidth: number
  worldMapHeight: number
  rect: { x: number; y: number; width: number; height: number }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function getMiniMapViewportGeometry(input: MiniMapViewportInput): MiniMapViewportGeometry {
  const worldWidth = Math.max(input.worldWidth, 1)
  const worldHeight = Math.max(input.worldHeight, 1)
  const innerWidth = Math.max(input.mapWidth - input.padding * 2, 1)
  const innerHeight = Math.max(input.mapHeight - input.padding * 2, 1)
  const scale = Math.min(innerWidth / worldWidth, innerHeight / worldHeight)
  const worldMapWidth = worldWidth * scale
  const worldMapHeight = worldHeight * scale
  const offsetMapX = (input.mapWidth - worldMapWidth) / 2
  const offsetMapY = (input.mapHeight - worldMapHeight) / 2
  const zoom = Math.max(input.zoom, Number.EPSILON)
  const visibleWidth = Math.min(worldWidth, Math.max(input.viewportWidth, 0) / zoom)
  const visibleHeight = Math.min(worldHeight, Math.max(input.viewportHeight, 0) / zoom)
  const visibleLeft = clamp((input.scrollLeft - input.offsetX) / zoom, 0, worldWidth - visibleWidth)
  const visibleTop = clamp((input.scrollTop - input.offsetY) / zoom, 0, worldHeight - visibleHeight)

  return {
    scale,
    offsetMapX,
    offsetMapY,
    worldMapWidth,
    worldMapHeight,
    rect: {
      x: offsetMapX + visibleLeft * scale,
      y: offsetMapY + visibleTop * scale,
      width: visibleWidth * scale,
      height: visibleHeight * scale,
    },
  }
}

export function getMiniMapWorldPoint(x: number, y: number, geometry: MiniMapViewportGeometry, worldWidth: number, worldHeight: number) {
  return {
    x: clamp((x - geometry.offsetMapX) / geometry.scale, 0, worldWidth),
    y: clamp((y - geometry.offsetMapY) / geometry.scale, 0, worldHeight),
  }
}
