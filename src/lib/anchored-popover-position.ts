export type AnchorRect = { left: number; right: number; top: number; bottom: number; width: number; height: number }

export type AnchoredPopoverPosition = {
  left: number
  top: number
  width: number
  arrowOffset: number
  side: 'top' | 'bottom'
}

export function getAnchoredPopoverArrowSide(placement: AnchoredPopoverPosition['side']): 'top' | 'bottom' {
  return placement === 'bottom' ? 'top' : 'bottom'
}

export function getAnchoredPopoverPosition(anchor: AnchorRect, popoverWidth: number, popoverHeight: number, viewportWidth: number, viewportHeight: number, margin = 12, gap = 8): AnchoredPopoverPosition {
  const width = Math.min(popoverWidth, Math.max(0, viewportWidth - margin * 2))
  const left = clamp(anchor.left + anchor.width / 2 - width / 2, margin, viewportWidth - width - margin)
  const below = anchor.bottom + gap
  const above = anchor.top - popoverHeight - gap
  const side = below + popoverHeight <= viewportHeight - margin || above < margin ? 'bottom' : 'top'
  const preferredTop = side === 'bottom' ? below : above
  const top = clamp(preferredTop, margin, viewportHeight - popoverHeight - margin)
  const arrowOffset = clamp(anchor.left + anchor.width / 2 - left, 16, width - 16)
  return { left, top, width, arrowOffset, side }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, Math.max(minimum, maximum)))
}
