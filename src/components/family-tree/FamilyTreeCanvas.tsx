import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent, PointerEvent, ReactNode } from 'react'
import { Crosshair, GitBranch, Plus } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { getChildCounts, getHiddenIds, getSiblingConnectorPairs } from '../../lib/tree-logic'
import { computeTreeLayout, getImmediateFamilyIds, getParentChildConnectorPaths, getRootBranchMap, getSiblingConnectorPath, type TreeNodeMode } from '../../lib/tree-layout'
import { PersonCard } from './PersonCard'
import { useLanguage } from '../../i18n/useLanguage'

type FamilyTreeCanvasProps = {
  members: FamilyMember[]
  collapsedIds: Set<string>
  zoom: number
  selectedId: string | null
  onSelect: (member: FamilyMember) => void
  onToggleBranch: (id: string) => void
  onAddRelative: (member: FamilyMember, kind: RelationshipKind) => void
  onProposeRelationship: (source: FamilyMember, target: FamilyMember) => void
  onEmptyAdd: () => void
  mode: TreeNodeMode
  focusId: string | null
  showBranchColors: boolean
  readOnly?: boolean
}

export function FamilyTreeCanvas({ members, collapsedIds, zoom, selectedId, onSelect, onToggleBranch, onAddRelative, onProposeRelationship, onEmptyAdd, mode, focusId, showBranchColors, readOnly = false }: FamilyTreeCanvasProps) {
  const { t } = useLanguage()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const previousViewport = useRef<{ zoom: number; offsetX: number; offsetY: number; width: number; height: number } | null>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const hiddenIds = getHiddenIds(members, collapsedIds)
  const visibleMembers = members.filter((member) => !hiddenIds.has(member.id))
  const childCounts = getChildCounts(members)
  const focusedIds = focusId ? getImmediateFamilyIds(members, focusId) : null
  const branchColors = showBranchColors ? getRootBranchMap(members) : null
  const layout = computeTreeLayout(visibleMembers, mode)
  const { positions, width, height, nodeWidth, nodeHeight } = layout
  const zoomedWidth = width * zoom
  const zoomedHeight = height * zoom
  const spaceWidth = Math.max(zoomedWidth, viewportSize.width)
  const spaceHeight = Math.max(zoomedHeight, viewportSize.height)
  const offsetX = Math.max(0, (spaceWidth - zoomedWidth) / 2)
  const offsetY = Math.max(0, (spaceHeight - zoomedHeight) / 2)
  const positionedIds = new Set(positions.keys())

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => {
      const { width: nextWidth, height: nextHeight } = entry.contentRect
      setViewportSize((current) => current.width === nextWidth && current.height === nextHeight ? current : { width: nextWidth, height: nextHeight })
    })
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const previous = previousViewport.current
    if (previous) {
      const centerX = (viewport.scrollLeft + previous.width / 2 - previous.offsetX) / previous.zoom
      const centerY = (viewport.scrollTop + previous.height / 2 - previous.offsetY) / previous.zoom
      viewport.scrollLeft = centerX * zoom + offsetX - viewport.clientWidth / 2
      viewport.scrollTop = centerY * zoom + offsetY - viewport.clientHeight / 2
    } else {
      viewport.scrollLeft = Math.max(0, (spaceWidth - viewport.clientWidth) / 2)
      viewport.scrollTop = Math.max(0, (spaceHeight - viewport.clientHeight) / 2)
    }
    previousViewport.current = { zoom, offsetX, offsetY, width: viewport.clientWidth, height: viewport.clientHeight }
  }, [zoom, width, height, offsetX, offsetY, spaceWidth, spaceHeight])

  function handleDragStart(event: DragEvent<HTMLButtonElement>, member: FamilyMember) {
    setDropTargetId(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', member.id)
  }
  function handleDrop(event: DragEvent<HTMLElement>, target: FamilyMember) {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain')
    const source = members.find((member) => member.id === sourceId)
    if (source && source.id !== target.id) onProposeRelationship(source, target)
    setDropTargetId(null)
  }
  function endDrag() { setDropTargetId(null) }
  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.person-node, .canvas-center-button')) return
    const viewport = viewportRef.current
    if (!viewport) return
    pan.current = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function movePan(event: PointerEvent<HTMLDivElement>) {
    if (!pan.current || !viewportRef.current) return
    viewportRef.current.scrollLeft = pan.current.left - (event.clientX - pan.current.x)
    viewportRef.current.scrollTop = pan.current.top - (event.clientY - pan.current.y)
  }
  function stopPan() { pan.current = null }
  function centerView() {
    const viewport = viewportRef.current
    if (!viewport) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    viewport.scrollTo({
      left: Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2),
      top: Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2),
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <div className="tree-viewport" ref={viewportRef} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onPointerLeave={stopPan}>
      {members.length > 0 && <button className="canvas-center-button" type="button" onClick={centerView} title={t('Center tree')} aria-label={t('Center tree')}><Crosshair size={17} /><span>{t('Center tree')}</span></button>}
      {members.length === 0 ? <div className="tree-empty"><span><GitBranch size={27} /></span><h2>{t('Your family tree starts here')}</h2><p>{t('Add a family member to plant the first branch.')}</p><button onClick={onEmptyAdd}><Plus size={16} /> {t('Add first member')}</button></div> : <div className="tree-zoom-space" style={{ width: spaceWidth, height: spaceHeight }}>
        <div className="tree-world" style={{ width, height, left: offsetX / zoom, top: offsetY / zoom, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <svg className="tree-lines" width={width} height={height} aria-hidden="true">
            {(() => {
              const links: ReactNode[] = []
              const parentGroups = new Map<string, FamilyMember[]>()
              visibleMembers.forEach((child) => {
                const parentIds = child.parentIds.filter((id) => positions.has(id)).sort()
                if (!parentIds.length) return
                const key = parentIds.join('|')
                parentGroups.set(key, [...(parentGroups.get(key) ?? []), child])
              })
              for (const [key, children] of parentGroups) {
                const parentIds = key.split('|')
                const parents = parentIds.map((id) => positions.get(id)).filter((point): point is NonNullable<typeof point> => Boolean(point))
                const childPoints = children.map((child) => positions.get(child.id)).filter((point): point is NonNullable<typeof point> => Boolean(point))
                if (!parents.length || !childPoints.length) continue
                const color = branchColors ? getUnambiguousBranchColor(children.map((child) => child.id), branchColors) : null
                getParentChildConnectorPaths(parents, childPoints, nodeWidth, nodeHeight).forEach((path, index) => {
                  links.push(<path className={color === null ? undefined : 'branch-line'} style={color === null ? undefined : { stroke: color }} key={`${key}-parent-child-${index}`} d={path} />)
                })
              }
              visibleMembers.forEach((member) => member.spouseIds.forEach((spouseId) => {
                const a = positions.get(member.id); const b = positions.get(spouseId)
                if (!a || !b || a.generation !== b.generation || a.x >= b.x) return
                const startX = a.x + nodeWidth
                const endX = b.x
                const startY = a.y + nodeHeight / 2
                const route = endX - startX > 100
                  ? `M ${startX} ${startY} V ${a.y + nodeHeight + 16} H ${endX} V ${startY}`
                  : `M ${startX} ${startY} H ${endX}`
                const color = branchColors?.get(member.id) ?? null
                const sharedColor = color !== null && branchColors?.get(spouseId) === color ? color : null
                links.push(<path className={sharedColor === null ? 'spouse-line' : 'spouse-line branch-line'} style={sharedColor === null ? undefined : { stroke: sharedColor }} key={`spouse-${member.id}-${spouseId}`} d={route} />)
              }))
              getSiblingConnectorPairs(visibleMembers, positionedIds).forEach(([first, second]) => {
                const a = positions.get(first.id); const b = positions.get(second.id)
                if (!a || !b) return
                const route = getSiblingConnectorPath(a, b, nodeWidth, nodeHeight)
                const color = branchColors?.get(first.id) ?? null
                const sharedColor = color !== null && branchColors?.get(second.id) === color ? color : null
                if (route) links.push(<path className={`sibling-line${sharedColor === null ? '' : ' branch-line'}`} style={sharedColor === null ? undefined : { stroke: sharedColor }} key={`sibling-${first.id}-${second.id}`} d={route} />)
              })
              return links
            })()}
          </svg>
          {visibleMembers.map((member) => {
            const point = positions.get(member.id)
            if (!point) return null
            return <div className="tree-node-position" key={member.id} style={{ left: point.x, top: point.y }}><PersonCard member={member} mode={mode} branchColor={branchColors?.get(member.id) ?? null} isSelected={selectedId === member.id} isFocused={!focusedIds || focusedIds.has(member.id)} childCount={childCounts.get(member.id) ?? 0} isCollapsed={collapsedIds.has(member.id)} isDropTarget={dropTargetId === member.id} readOnly={readOnly} onSelect={onSelect} onToggleBranch={onToggleBranch} onAddRelative={onAddRelative} onDragStart={handleDragStart} onDragEnd={endDrag} onDrop={handleDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId(member.id) }} /></div>
          })}
        </div>
      </div>}
    </div>
  )
}

function getUnambiguousBranchColor(ids: string[], branches: Map<string, string | null>): string | null {
  const colors = new Set(ids.map((id) => branches.get(id) ?? null))
  if (colors.size !== 1) return null
  const [color] = colors
  return color ?? null
}
