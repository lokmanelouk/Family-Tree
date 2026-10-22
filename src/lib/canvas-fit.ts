import type { TreeLayout } from './tree-layout.ts'

export type TreeContentBounds = { left: number; top: number; width: number; height: number }

export function getTreeContentBounds(layout: TreeLayout, padding = 12): TreeContentBounds {
  const positions = [...layout.positions.values()]
  if (!positions.length) return { left: 0, top: 0, width: layout.width, height: layout.height }
  const left = Math.min(...positions.map((position) => position.x)) - padding
  const top = Math.min(...positions.map((position) => position.y)) - padding
  const right = Math.max(...positions.map((position) => position.x + layout.nodeWidth)) + padding
  const bottom = Math.max(...positions.map((position) => position.y + layout.nodeHeight)) + padding
  return { left, top, width: right - left, height: bottom - top }
}

export function getFitZoom(bounds: TreeContentBounds, viewportWidth: number, viewportHeight: number, options: { padding?: number; minZoom?: number; maxZoom?: number } = {}): number {
  const padding = options.padding ?? 44
  const minZoom = options.minZoom ?? 0.25
  const maxZoom = options.maxZoom ?? 1.4
  const availableWidth = Math.max(1, viewportWidth - padding * 2)
  const availableHeight = Math.max(1, viewportHeight - padding * 2)
  return Math.max(minZoom, Math.min(maxZoom, availableWidth / bounds.width, availableHeight / bounds.height))
}
