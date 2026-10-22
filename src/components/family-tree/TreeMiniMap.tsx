import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CSSProperties, MouseEvent, PointerEvent } from 'react'
import type { FamilyMember } from '../../types/family'
import type { TreePosition } from '../../lib/tree-layout'
import { useLanguage } from '../../i18n/useLanguage'

type TreeMiniMapProps = {
  members: FamilyMember[]
  positions: Map<string, TreePosition>
  colors: Map<string, string>
  width: number
  height: number
  nodeWidth: number
  nodeHeight: number
  zoom: number
  offsetX: number
  offsetY: number
  scrollLeft: number
  scrollTop: number
  viewportWidth: number
  viewportHeight: number
  onNavigate: (x: number, y: number) => void
}

type MiniMapDrag = { pointerId: number; offsetX: number; offsetY: number; startX: number; startY: number }

export function TreeMiniMap({ members, positions, colors, width, height, nodeWidth, nodeHeight, zoom, offsetX, offsetY, scrollLeft, scrollTop, viewportWidth, viewportHeight, onNavigate }: TreeMiniMapProps) {
  const { t } = useLanguage()
  const drag = useRef<MiniMapDrag | null>(null)
  const handledPointerClick = useRef(false)
  const pointerMoved = useRef(false)
  const [collapsed, setCollapsed] = useState(false)
  const mapWidth = 168
  const mapHeight = 110
  const padding = 9
  const innerWidth = mapWidth - padding * 2
  const innerHeight = mapHeight - padding * 2
  const scale = Math.min(innerWidth / Math.max(width, 1), innerHeight / Math.max(height, 1))
  const offsetMapX = (mapWidth - width * scale) / 2
  const offsetMapY = (mapHeight - height * scale) / 2
  const visibleWidth = Math.min(width, viewportWidth / zoom)
  const visibleHeight = Math.min(height, viewportHeight / zoom)
  const visibleLeft = Math.max(0, Math.min(width - visibleWidth, (scrollLeft - offsetX) / zoom))
  const visibleTop = Math.max(0, Math.min(height - visibleHeight, (scrollTop - offsetY) / zoom))
  const rect = {
    x: offsetMapX + visibleLeft * scale,
    y: offsetMapY + visibleTop * scale,
    width: Math.max(8, visibleWidth * scale),
    height: Math.max(8, visibleHeight * scale),
  }

  function getLocalPoint(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.querySelector('svg')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - bounds.left) * mapWidth / bounds.width, y: (event.clientY - bounds.top) * mapHeight / bounds.height }
  }

  function navigateToMapPoint(x: number, y: number) {
    const worldX = Math.max(0, Math.min(width, (x - offsetMapX) / scale))
    const worldY = Math.max(0, Math.min(height, (y - offsetMapY) / scale))
    onNavigate(worldX, worldY)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    handledPointerClick.current = true
    const point = getLocalPoint(event)
    const withinViewport = point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
    pointerMoved.current = !withinViewport
    drag.current = {
      pointerId: event.pointerId,
      offsetX: withinViewport ? point.x - rect.x : rect.width / 2,
      offsetY: withinViewport ? point.y - rect.y : rect.height / 2,
      startX: point.x,
      startY: point.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    if (!withinViewport) navigateToMapPoint(point.x, point.y)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return
    const point = getLocalPoint(event)
    if (!pointerMoved.current && Math.hypot(point.x - drag.current.startX, point.y - drag.current.startY) < 2) return
    pointerMoved.current = true
    event.preventDefault()
    const mapX = Math.max(offsetMapX, Math.min(offsetMapX + width * scale, point.x - drag.current.offsetX + rect.width / 2))
    const mapY = Math.max(offsetMapY, Math.min(offsetMapY + height * scale, point.y - drag.current.offsetY + rect.height / 2))
    navigateToMapPoint(mapX, mapY)
  }

  function stopDragging() {
    drag.current = null
  }

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (handledPointerClick.current && event.detail > 0) {
      handledPointerClick.current = false
      if (!pointerMoved.current) {
        const bounds = event.currentTarget.querySelector('svg')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect()
        navigateToMapPoint((event.clientX - bounds.left) * mapWidth / bounds.width, (event.clientY - bounds.top) * mapHeight / bounds.height)
      }
      return
    }
    const bounds = event.currentTarget.querySelector('svg')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) * mapWidth / bounds.width
    const y = (event.clientY - bounds.top) * mapHeight / bounds.height
    navigateToMapPoint(x, y)
  }

  return (
    <div className={`tree-minimap${collapsed ? ' is-collapsed' : ''}`} role="group" aria-label={t('Family tree overview')}>
      <button
        className="tree-minimap-toggle"
        type="button"
        aria-label={collapsed ? t('Expand minimap') : t('Collapse minimap')}
        aria-expanded={!collapsed}
        title={collapsed ? t('Expand minimap') : t('Collapse minimap')}
        onClick={() => setCollapsed((value) => !value)}
      >{collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
      {!collapsed && <div
        className="tree-minimap-map"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onLostPointerCapture={stopDragging}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onNavigate(width / 2, height / 2)
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={t('Drag or click to navigate the family tree')}
      >
        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} aria-hidden="true">
          <rect className="tree-minimap-surface" x="0.5" y="0.5" width={mapWidth - 1} height={mapHeight - 1} rx="10" />
          {members.map((member) => {
            const point = positions.get(member.id)
            if (!point) return null
            return <rect key={member.id} className="tree-minimap-node" style={colors.get(member.id) ? { '--minimap-node-color': colors.get(member.id) } as CSSProperties : undefined} x={offsetMapX + point.x * scale} y={offsetMapY + point.y * scale} width={Math.max(2, nodeWidth * scale)} height={Math.max(2, nodeHeight * scale)} rx={Math.max(1, 2 * scale)} />
          })}
          <rect className="tree-minimap-window" x={rect.x} y={rect.y} width={rect.width} height={rect.height} rx="3" />
        </svg>
        <span className="sr-only">{t('Drag or click to navigate the family tree')}</span>
      </div>}
    </div>
  )
}
