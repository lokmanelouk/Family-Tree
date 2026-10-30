export type CanvasViewportSnapshot = {
  scrollLeft: number
  scrollTop: number
  viewportWidth: number
  viewportHeight: number
  worldLeft: number
  worldTop: number
  zoomX: number
  zoomY: number
}

export type CanvasViewportSize = { width: number; height: number }
export type CanvasViewportTarget = { zoomX: number; zoomY: number; offsetX: number; offsetY: number }

export function getScrollPreservingCanvasCenter(previous: CanvasViewportSnapshot, viewport: CanvasViewportSize, next: CanvasViewportTarget) {
  const centerX = (previous.scrollLeft + previous.viewportWidth / 2 - previous.worldLeft) / previous.zoomX
  const centerY = (previous.scrollTop + previous.viewportHeight / 2 - previous.worldTop) / previous.zoomY
  return {
    left: next.offsetX + centerX * next.zoomX - viewport.width / 2,
    top: next.offsetY + centerY * next.zoomY - viewport.height / 2,
  }
}

export function getCanvasLocalOrigin(worldLeft: number, worldTop: number, zoomX: number, zoomY: number) {
  return { left: worldLeft / (Math.abs(zoomX) || 1), top: worldTop / (Math.abs(zoomY) || 1) }
}
