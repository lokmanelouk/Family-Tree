import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent, PointerEvent, ReactNode } from 'react'
import { Crosshair, GitBranch, Plus, WandSparkles } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { getChildCounts, getHiddenAncestorIds, getHiddenIds, getLineageFocusIds } from '../../lib/tree-logic'
import { computeTreeLayout, getImmediateFamilyIds, getParentalCoupleColors, getParentChildConnectorPaths, getRootBranchMap, getSpouseConnector, MARRIAGE_ANCHOR_RADIUS, type TreeNodeMode } from '../../lib/tree-layout'
import { PersonCard } from './PersonCard'
import { useLanguage } from '../../i18n/useLanguage'

type FamilyTreeCanvasProps = {
  members: FamilyMember[]
  collapsedIds: Set<string>
  collapsedAncestorIds: Set<string>
  zoom: number
  selectedId: string | null
  onSelect: (member: FamilyMember) => void
  onToggleBranch: (id: string) => void
  onToggleAncestors: (id: string) => void
  onAddRelative: (member: FamilyMember, kind: RelationshipKind) => void
  onProposeRelationship: (source: FamilyMember, target: FamilyMember) => void
  onEmptyAdd: () => void
  mode: TreeNodeMode
  focusId: string | null
  showBranchColors: boolean
  layoutRevision: number
  onAutoOrganize: () => void
}

export function FamilyTreeCanvas({ members, collapsedIds, collapsedAncestorIds, zoom, selectedId, onSelect, onToggleBranch, onToggleAncestors, onAddRelative, onProposeRelationship, onEmptyAdd, mode, focusId, showBranchColors, layoutRevision, onAutoOrganize }: FamilyTreeCanvasProps) {
  const { t } = useLanguage()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const previousViewport = useRef<{ zoom: number; offsetX: number; offsetY: number; width: number; height: number } | null>(null)
  const previousLayoutRevision = useRef(layoutRevision)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const hiddenIds = new Set([...getHiddenIds(members, collapsedIds), ...getHiddenAncestorIds(members, collapsedAncestorIds)])
  const visibleMembers = members.filter((member) => !hiddenIds.has(member.id))
  const childCounts = getChildCounts(members)
  const focusedIds = focusId ? getImmediateFamilyIds(members, focusId) : null
  const branchColors = showBranchColors ? getRootBranchMap(members) : null
  const coupleColors = showBranchColors ? getParentalCoupleColors(members) : null
  const activeLineMemberId = hoveredId ?? selectedId
  const activeLineIds = activeLineMemberId ? getLineageFocusIds(members, activeLineMemberId) : null
  const layout = computeTreeLayout(visibleMembers, mode)
  const { positions, width, height, nodeWidth, nodeHeight } = layout
  const zoomedWidth = width * zoom
  const zoomedHeight = height * zoom
  const spaceWidth = Math.max(zoomedWidth, viewportSize.width)
  const spaceHeight = Math.max(zoomedHeight, viewportSize.height)
  const offsetX = Math.max(0, (spaceWidth - zoomedWidth) / 2)
  const offsetY = Math.max(0, (spaceHeight - zoomedHeight) / 2)

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
    const shouldCenter = previousLayoutRevision.current !== layoutRevision
    if (previous && !shouldCenter) {
      const centerX = (viewport.scrollLeft + previous.width / 2 - previous.offsetX) / previous.zoom
      const centerY = (viewport.scrollTop + previous.height / 2 - previous.offsetY) / previous.zoom
      viewport.scrollLeft = centerX * zoom + offsetX - viewport.clientWidth / 2
      viewport.scrollTop = centerY * zoom + offsetY - viewport.clientHeight / 2
    } else {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      viewport.scrollTo({
        left: Math.max(0, (spaceWidth - viewport.clientWidth) / 2),
        top: Math.max(0, (spaceHeight - viewport.clientHeight) / 2),
        behavior: shouldCenter && !reducedMotion ? 'smooth' : 'auto',
      })
    }
    previousLayoutRevision.current = layoutRevision
    previousViewport.current = { zoom, offsetX, offsetY, width: viewport.clientWidth, height: viewport.clientHeight }
  }, [zoom, width, height, offsetX, offsetY, spaceWidth, spaceHeight, layoutRevision])

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
    if (event.button !== 0 || (event.target as HTMLElement).closest('.person-node, .canvas-view-controls')) return
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
      {members.length > 0 && <div className="canvas-view-controls">
        <button className="canvas-auto-organize-button" type="button" onClick={onAutoOrganize} title={t('Auto-organize tree')} aria-label={t('Auto-organize tree')}><WandSparkles size={16} /><span>{t('Auto-organize')}</span></button>
        <button className="canvas-center-button" type="button" onClick={centerView} title={t('Center tree')} aria-label={t('Center tree')}><Crosshair size={17} /><span>{t('Center tree')}</span></button>
      </div>}
      {members.length === 0 ? <div className="tree-empty"><span><GitBranch size={27} /></span><h2>{t('Your family tree starts here')}</h2><p>{t('Add a family member to plant the first branch.')}</p><button onClick={onEmptyAdd}><Plus size={16} /> {t('Add first member')}</button></div> : <div className="tree-zoom-space" style={{ width: spaceWidth, height: spaceHeight }}>
        <div className="tree-world" style={{ width, height, left: offsetX / zoom, top: offsetY / zoom, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <svg className={`tree-lines${activeLineIds ? ' has-active-line-focus' : ''}`} width={width} height={height} aria-hidden="true">
            {(() => {
              const links: ReactNode[] = []
              const parentGroups = new Map<string, FamilyMember[]>()
              visibleMembers.forEach((child) => {
                const parentIds = child.parentIds.filter((id) => positions.has(id)).sort()
                if (!parentIds.length) return
                const key = parentIds.join('|')
                parentGroups.set(key, [...(parentGroups.get(key) ?? []), child])
              })
              const orderedParentGroups = [...parentGroups.entries()].sort(([firstKey, first], [secondKey, second]) => {
                const firstParentGeneration = positions.get(firstKey.split('|')[0])?.generation ?? 0
                const secondParentGeneration = positions.get(secondKey.split('|')[0])?.generation ?? 0
                if (firstParentGeneration !== secondParentGeneration) return firstParentGeneration - secondParentGeneration
                const firstCenter = first.reduce((sum, child) => sum + (positions.get(child.id)?.x ?? 0) + nodeWidth / 2, 0) / first.length
                const secondCenter = second.reduce((sum, child) => sum + (positions.get(child.id)?.x ?? 0) + nodeWidth / 2, 0) / second.length
                return firstCenter - secondCenter
              })
              const lanesByGeneration = new Map<number, number>()
              orderedParentGroups.forEach(([key, children]) => {
                const parentIds = key.split('|')
                const parents = parentIds.map((id) => positions.get(id)).filter((point): point is NonNullable<typeof point> => Boolean(point))
                const childPoints = children.map((child) => positions.get(child.id)).filter((point): point is NonNullable<typeof point> => Boolean(point))
                if (!parents.length || !childPoints.length) return
                const parentGeneration = Math.min(...parents.map((point) => point.generation))
                const lane = lanesByGeneration.get(parentGeneration) ?? 0
                lanesByGeneration.set(parentGeneration, lane + 1)
                const color = coupleColors?.get(key) ?? null
                getParentChildConnectorPaths(parents, childPoints, nodeWidth, nodeHeight, lane).forEach((path, index) => {
                  const active = Boolean(activeLineIds && (parentIds.some((id) => activeLineIds.has(id)) || children.some((child) => activeLineIds.has(child.id))))
                  links.push(<path className={`relationship-line parent-child-line${active ? ' is-active-line' : ''}`} style={color === null ? undefined : { stroke: color }} key={`${key}-parent-child-${index}`} d={path} />)
                })
              })
              // Marriage connectors are relationship data, never inferred from
              // cards merely being neighbors on the same generation row.
              const renderedSpousePairs = new Set<string>()
              visibleMembers.forEach((member) => member.spouseIds.forEach((spouseId) => {
                const spouse = members.find((candidate) => candidate.id === spouseId)
                const pairKey = [member.id, spouseId].sort().join('|')
                // Imported or stale one-way references do not establish a
                // marriage. Require the exact reciprocal person ID as well.
                if (!spouse || !spouse.spouseIds.includes(member.id) || renderedSpousePairs.has(pairKey)) return
                renderedSpousePairs.add(pairKey)
                const first = positions.get(member.id); const second = positions.get(spouseId)
                if (!first || !second || first.x === second.x) return
                const connector = getSpouseConnector(first, second, nodeWidth, nodeHeight)
                if (!connector) return
                const active = Boolean(activeLineIds && (activeLineIds.has(member.id) || activeLineIds.has(spouseId)))
                links.push(<path className={`relationship-line spouse-line${active ? ' is-active-line' : ''}`} key={`spouse-${pairKey}`} d={connector.path} />)
                links.push(<g className={`marriage-anchor${active ? ' is-active-line' : ''}`} key={`marriage-anchor-${pairKey}`} transform={`translate(${connector.anchorX} ${connector.anchorY})`}>
                  <circle className="marriage-anchor-backdrop" r={MARRIAGE_ANCHOR_RADIUS} />
                  <circle className="marriage-ring" cx="-2" cy="0" r="3.3" />
                  <circle className="marriage-ring" cx="2" cy="0" r="3.3" />
                </g>)
              }))
              return links
            })()}
          </svg>
          {visibleMembers.map((member) => {
            const point = positions.get(member.id)
            if (!point) return null
            const coupleKey = member.parentIds.slice().sort().join('|')
            const hasVisibleParents = member.parentIds.some((parentId) => members.some((person) => person.id === parentId))
            return <div className="tree-node-position" key={member.id} style={{ left: point.x, top: point.y }}><PersonCard member={member} mode={mode} branchColor={coupleColors?.get(coupleKey) ?? branchColors?.get(member.id) ?? null} isSelected={selectedId === member.id} isFocused={!focusedIds || focusedIds.has(member.id)} childCount={childCounts.get(member.id) ?? 0} isCollapsed={collapsedIds.has(member.id)} hasParents={hasVisibleParents} areAncestorsCollapsed={collapsedAncestorIds.has(member.id)} isDropTarget={dropTargetId === member.id} onHoverChange={(id) => setHoveredId(id)} onSelect={onSelect} onToggleBranch={onToggleBranch} onToggleAncestors={onToggleAncestors} onAddRelative={onAddRelative} onDragStart={handleDragStart} onDragEnd={endDrag} onDrop={handleDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId(member.id) }} /></div>
          })}
        </div>
      </div>}
    </div>
  )
}
