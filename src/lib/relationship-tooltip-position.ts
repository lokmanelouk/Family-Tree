export type RelationshipTooltipPosition = {
  left: number
  top: number
  placement: 'above' | 'below'
}

export function getRelationshipTooltipPosition(anchor: { x: number; y: number }, tooltip: { width: number; height: number }, viewport: { width: number; height: number; scrollLeft?: number; scrollTop?: number }, margin = 12, gap = 8): RelationshipTooltipPosition {
  const width = Math.min(tooltip.width, Math.max(0, viewport.width - margin * 2))
  const height = Math.min(tooltip.height, Math.max(0, viewport.height - margin * 2))
  const minCenter = margin + width / 2
  const maxCenter = viewport.width - margin - width / 2
  const left = clamp(anchor.x, minCenter, maxCenter) + (viewport.scrollLeft ?? 0)
  const spaceAbove = anchor.y - margin
  const spaceBelow = viewport.height - margin - anchor.y
  const placement = spaceAbove >= height + gap || spaceAbove >= spaceBelow ? 'above' : 'below'
  const top = placement === 'above'
    ? clamp(anchor.y - gap, margin + height, viewport.height - margin)
    : clamp(anchor.y + gap, margin, viewport.height - margin - height)
  return { left, top: top + (viewport.scrollTop ?? 0), placement }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)))
}
