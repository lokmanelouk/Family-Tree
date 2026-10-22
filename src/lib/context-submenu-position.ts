export type ContextMenuRect = {
  left: number
  right: number
  top: number
  bottom: number
}

export type ContextSubmenuPosition = {
  left: number
  top: number
  width: number
  maxHeight: number
  placement: 'inline' | 'stacked'
}

export function getContextSubmenuPosition(menu: ContextMenuRect, viewportWidth: number, viewportHeight: number, requestedWidth = 312, requestedHeight = 420, gap = 6, avoid: ContextMenuRect[] = []): ContextSubmenuPosition {
  const padding = 8
  const width = Math.min(requestedWidth, Math.max(0, viewportWidth - padding * 2))
  const maxHeight = Math.min(requestedHeight, Math.max(0, viewportHeight - padding * 2))
  const right = menu.right + gap
  const left = menu.left - width - gap
  const inlineTop = clamp(menu.top, padding, viewportHeight - maxHeight - padding)
  const inline = [right, left].map((candidateLeft) => ({
    left: candidateLeft,
    top: inlineTop,
    width,
    maxHeight,
    placement: 'inline' as const,
  })).filter((candidate) => candidate.left >= padding && candidate.left + width <= viewportWidth - padding)
  const clearInline = inline.filter((candidate) => !overlapsAny(candidate, avoid))
  if (clearInline.length) {
    const rightCandidate = clearInline.find((candidate) => candidate.left === right)
    return rightCandidate ?? clearInline[0]
  }
  const belowTop = menu.bottom + gap
  const aboveTop = menu.top - maxHeight - gap
  const stacked = [belowTop, aboveTop].map((candidateTop) => ({
    left: clamp(menu.left, padding, viewportWidth - width - padding),
    top: clamp(candidateTop, padding, viewportHeight - maxHeight - padding),
    width,
    maxHeight,
    placement: 'stacked' as const,
  }))
  const clearStacked = stacked.filter((candidate) => !overlapsAny(candidate, avoid))
  if (clearStacked.length) return clearStacked[0]
  return [...inline, ...stacked].sort((a, b) => overlapArea(a, avoid) - overlapArea(b, avoid) || Number(a.placement === 'stacked') - Number(b.placement === 'stacked'))[0]
}

function overlapsAny(position: ContextSubmenuPosition, avoid: ContextMenuRect[]) {
  return avoid.some((rect) => position.left < rect.right && position.left + position.width > rect.left && position.top < rect.bottom && position.top + position.maxHeight > rect.top)
}

function overlapArea(position: ContextSubmenuPosition, avoid: ContextMenuRect[]) {
  return avoid.reduce((total, rect) => {
    const width = Math.max(0, Math.min(position.left + position.width, rect.right) - Math.max(position.left, rect.left))
    const height = Math.max(0, Math.min(position.top + position.maxHeight, rect.bottom) - Math.max(position.top, rect.top))
    return total + width * height
  }, 0)
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)))
}
