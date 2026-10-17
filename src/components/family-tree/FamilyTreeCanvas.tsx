import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, PointerEvent, ReactNode, SVGProps } from 'react'
import { GitBranch, Plus } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { getChildCounts, getHiddenAncestorIds, getHiddenIds } from '../../lib/tree-logic'
import { computeTreeLayout, getImmediateFamilyIds, getParentalCoupleColors, getParentChildBranchJunction, getParentChildConnectorPaths, getRootBranchMap, getSpouseConnector, MARRIAGE_ANCHOR_RADIUS, CIRCULAR_AVATAR_CENTER_Y, CIRCULAR_AVATAR_RADIUS, type TreeNodeMode } from '../../lib/tree-layout'
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
  layoutRevision: number
  navigationTarget: { id: string; sequence: number } | null
}

export function FamilyTreeCanvas({ members, collapsedIds, collapsedAncestorIds, zoom, selectedId, onSelect, onToggleBranch, onToggleAncestors, onAddRelative, onProposeRelationship, onEmptyAdd, mode, focusId, layoutRevision, navigationTarget }: FamilyTreeCanvasProps) {
  const { t } = useLanguage()
  const viewportRef = useRef<HTMLDivElement>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pulseId, setPulseId] = useState<string | null>(null)
  const [relationshipTooltip, setRelationshipTooltip] = useState<{ label: string; left: number; top: number } | null>(null)
  const relationshipTooltipAnchor = useRef<SVGGElement | null>(null)
  const relationshipTooltipLabel = useRef<string | null>(null)
  const tooltipFrame = useRef<number | null>(null)
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const previousViewport = useRef<{ zoom: number; offsetX: number; offsetY: number; width: number; height: number } | null>(null)
  const previousLayoutRevision = useRef(layoutRevision)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const hiddenIds = useMemo(() => new Set([...getHiddenIds(members, collapsedIds), ...getHiddenAncestorIds(members, collapsedAncestorIds)]), [members, collapsedIds, collapsedAncestorIds])
  const visibleMembers = useMemo(() => members.filter((member) => !hiddenIds.has(member.id)), [members, hiddenIds])
  const childCounts = getChildCounts(members)
  const spotlightId = hoveredId ?? selectedId ?? focusId
  const focusedIds = spotlightId ? getImmediateFamilyIds(members, spotlightId) : null
  const branchColors = getRootBranchMap(members)
  const coupleColors = getParentalCoupleColors(members)
  const activeLineMemberId = hoveredId ?? selectedId
  const activeLineIds = activeLineMemberId ? getImmediateFamilyIds(members, activeLineMemberId) : null
  const layout = useMemo(() => computeTreeLayout(visibleMembers, mode), [visibleMembers, mode])
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

  const refreshRelationshipTooltipPosition = useCallback(() => {
    const anchor = relationshipTooltipAnchor.current
    const label = relationshipTooltipLabel.current
    const viewport = viewportRef.current
    const screenMatrix = anchor?.getScreenCTM()
    if (!anchor || !label || !viewport || !screenMatrix) return
    const point = new DOMPoint(0, 0).matrixTransform(screenMatrix)
    const viewportBounds = viewport.getBoundingClientRect()
    const anchorBounds = anchor.getBoundingClientRect()
    const visibleLeft = viewportBounds.left + viewport.clientLeft
    const visibleTop = viewportBounds.top + viewport.clientTop
    const isOutside = anchorBounds.right < visibleLeft || anchorBounds.left > visibleLeft + viewport.clientWidth || anchorBounds.bottom < visibleTop || anchorBounds.top > visibleTop + viewport.clientHeight
    if (isOutside) {
      relationshipTooltipAnchor.current = null
      relationshipTooltipLabel.current = null
      setRelationshipTooltip(null)
      return
    }
    const localX = point.x - visibleLeft
    const localY = point.y - visibleTop
    const minCenter = Math.min(108, viewport.clientWidth / 2)
    const maxCenter = Math.max(minCenter, viewport.clientWidth - minCenter)
    const left = Math.min(Math.max(localX, minCenter), maxCenter) + viewport.scrollLeft
    const top = Math.max(42, localY - 8) + viewport.scrollTop
    setRelationshipTooltip((current) => current && current.label === label && current.left === left && current.top === top ? current : { label, left, top })
  }, [])

  const scheduleRelationshipTooltipPosition = useCallback(() => {
    if (tooltipFrame.current !== null) window.cancelAnimationFrame(tooltipFrame.current)
    tooltipFrame.current = window.requestAnimationFrame(() => {
      tooltipFrame.current = null
      refreshRelationshipTooltipPosition()
    })
  }, [refreshRelationshipTooltipPosition])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.addEventListener('scroll', scheduleRelationshipTooltipPosition, { passive: true })
    window.addEventListener('resize', scheduleRelationshipTooltipPosition)
    return () => {
      viewport.removeEventListener('scroll', scheduleRelationshipTooltipPosition)
      window.removeEventListener('resize', scheduleRelationshipTooltipPosition)
      if (tooltipFrame.current !== null) window.cancelAnimationFrame(tooltipFrame.current)
    }
  }, [scheduleRelationshipTooltipPosition])

  useLayoutEffect(() => {
    refreshRelationshipTooltipPosition()
    if (!relationshipTooltipAnchor.current) return
    const startedAt = performance.now()
    let frame = 0
    const updateDuringZoom = (time: number) => {
      refreshRelationshipTooltipPosition()
      if (time - startedAt < 400) frame = window.requestAnimationFrame(updateDuringZoom)
    }
    frame = window.requestAnimationFrame(updateDuringZoom)
    return () => window.cancelAnimationFrame(frame)
  }, [zoom, viewportSize, refreshRelationshipTooltipPosition])

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

  useLayoutEffect(() => {
    if (!navigationTarget) return
    const viewport = viewportRef.current
    const point = positions.get(navigationTarget.id)
    if (!viewport || !point) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const left = offsetX + (point.x + nodeWidth / 2) * zoom - viewport.clientWidth / 2
    const top = offsetY + (point.y + nodeHeight / 2) * zoom - viewport.clientHeight / 2
    viewport.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' })
    const revealTimer = window.setTimeout(() => setPulseId(navigationTarget.id), reducedMotion ? 0 : 420)
    const clearTimer = window.setTimeout(() => setPulseId((current) => current === navigationTarget.id ? null : current), reducedMotion ? 1150 : 1650)
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(clearTimer)
    }
  }, [navigationTarget, positions, nodeWidth, nodeHeight, zoom, offsetX, offsetY, viewportSize])

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
    if (event.button !== 0 || (event.target as HTMLElement).closest('.person-node')) return
    const viewport = viewportRef.current
    if (!viewport) return
    pan.current = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function movePan(event: PointerEvent<HTMLDivElement>) {
    if (!pan.current || !viewportRef.current) return
    viewportRef.current.scrollLeft = pan.current.left - (event.clientX - pan.current.x)
    viewportRef.current.scrollTop = pan.current.top - (event.clientY - pan.current.y)
    scheduleRelationshipTooltipPosition()
  }
  function stopPan() { pan.current = null }
  function showRelationshipTooltip(target: SVGGElement, label: string) {
    relationshipTooltipAnchor.current = target
    relationshipTooltipLabel.current = label
    setRelationshipTooltip({ label, left: 0, top: 0 })
    scheduleRelationshipTooltipPosition()
  }
  function hideRelationshipTooltip() {
    relationshipTooltipAnchor.current = null
    relationshipTooltipLabel.current = null
    if (tooltipFrame.current !== null) window.cancelAnimationFrame(tooltipFrame.current)
    tooltipFrame.current = null
    setRelationshipTooltip(null)
  }
  function relationshipTooltipEvents(label: string): Pick<SVGProps<SVGGElement>, 'onPointerEnter' | 'onPointerLeave' | 'onFocus' | 'onBlur'> {
    return {
      onPointerEnter: (event) => showRelationshipTooltip(event.currentTarget, label),
      onPointerLeave: hideRelationshipTooltip,
      onFocus: (event) => showRelationshipTooltip(event.currentTarget, label),
      onBlur: hideRelationshipTooltip,
    }
  }
  return (
    <div className="tree-viewport" ref={viewportRef} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onPointerLeave={stopPan}>
      {members.length === 0 ? <div className="tree-empty"><div className="tree-empty-card"><span><GitBranch size={29} /></span><h2>{t('Start your family tree')}</h2><p>{t('Begin by adding your first ancestor or family founder')}</p><button onClick={onEmptyAdd}><Plus size={17} /> {t('Add first person')}</button></div></div> : <div className="tree-zoom-space" style={{ width: spaceWidth, height: spaceHeight }}>
        <div className="tree-world" style={{ width, height, left: offsetX / zoom, top: offsetY / zoom, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <svg className={`tree-lines${activeLineIds ? ' has-active-line-focus' : ''}`} width={width} height={height}>
            {(() => {
              const links: ReactNode[] = []
              const parentGroups = new Map<string, { parentIds: string[]; children: FamilyMember[]; adopted: boolean }>()
              visibleMembers.forEach((child) => {
                const parentIds = child.parentIds.filter((id) => positions.has(id)).sort()
                if (!parentIds.length) return
                const adopted = parentIds.every((id) => child.adoptedParentIds?.includes(id))
                const key = `${parentIds.join('|')}::${adopted ? 'adopted' : 'biological'}`
                const group = parentGroups.get(key) ?? { parentIds, children: [], adopted }
                group.children.push(child)
                parentGroups.set(key, group)
              })
              const orderedParentGroups = [...parentGroups.entries()].sort(([, first], [, second]) => {
                const firstParentGeneration = positions.get(first.parentIds[0])?.generation ?? 0
                const secondParentGeneration = positions.get(second.parentIds[0])?.generation ?? 0
                if (firstParentGeneration !== secondParentGeneration) return firstParentGeneration - secondParentGeneration
                const firstCenter = first.children.reduce((sum, child) => sum + (positions.get(child.id)?.x ?? 0) + nodeWidth / 2, 0) / first.children.length
                const secondCenter = second.children.reduce((sum, child) => sum + (positions.get(child.id)?.x ?? 0) + nodeWidth / 2, 0) / second.children.length
                return firstCenter - secondCenter
              })
              const lanesByGeneration = new Map<number, number>()
              orderedParentGroups.forEach(([groupKey, group]) => {
                const { parentIds, children, adopted } = group
                const parents = parentIds.map((id) => positions.get(id)).filter((point): point is NonNullable<typeof point> => Boolean(point))
                const childPoints = children.map((child) => positions.get(child.id)).filter((point): point is NonNullable<typeof point> => Boolean(point))
                if (!parents.length || !childPoints.length) return
                const parentGeneration = Math.min(...parents.map((point) => point.generation))
                const lane = lanesByGeneration.get(parentGeneration) ?? 0
                lanesByGeneration.set(parentGeneration, lane + 1)
                const coupleKey = parentIds.join('|')
                const color = coupleColors?.get(coupleKey) ?? null
                const coupleAnchorOffset = mode === 'circle' ? CIRCULAR_AVATAR_CENTER_Y : nodeHeight / 2
                const groupActive = Boolean(activeLineIds && (parentIds.some((id) => activeLineIds.has(id)) || children.some((child) => activeLineIds.has(child.id))))
                getParentChildConnectorPaths(parents, childPoints, nodeWidth, nodeHeight, lane, coupleAnchorOffset).forEach((path, index) => {
                  links.push(<path className={`relationship-line parent-child-line${adopted ? ' adopted-parent-line' : ''}${groupActive ? ' is-active-line' : ''}`} style={color === null ? undefined : { stroke: color }} key={`${groupKey}-parent-child-${index}`} d={path} />)
                })
                if (adopted) {
                  const junction = getParentChildBranchJunction(parents, childPoints, nodeWidth, nodeHeight, lane, coupleAnchorOffset)
                  if (junction) links.push(<g className={`adoption-anchor${groupActive ? ' is-active-line' : ''}`} key={`${groupKey}-adoption-anchor`} transform={`translate(${junction.x} ${junction.y})`} role="img" aria-label={t('Adopted child')} tabIndex={0} {...relationshipTooltipEvents(t('Adopted child'))}>
                    <circle className="adoption-badge-backdrop" r="10" />
                    <path className="adoption-shield" d="M0 -7L6 -4.5V0C6 3.5 3 6.2 0 8C-3 6.2-6 3.5-6 0V-4.5L0-7Z" />
                    <path className="adoption-heart" d="M0 3.4L-2.5 1.2C-4-.2-2.9-2.3-1.4-2.3C-.7-2.3-.2-1.9 0-1.4C.3-1.9.8-2.3 1.5-2.3C3-2.3 4.1-.2 2.5 1.2L0 3.4Z" />
                  </g>)
                }
              })
              // Marriage connectors are relationship data, never inferred from
              // cards merely being neighbors on the same generation row.
              const renderedSpousePairs = new Set<string>()
              visibleMembers.forEach((member) => [...member.spouseIds, ...(member.formerSpouseIds ?? [])].forEach((spouseId) => {
                const spouse = members.find((candidate) => candidate.id === spouseId)
                const pairKey = [member.id, spouseId].sort().join('|')
                // Imported or stale one-way references do not establish a
                // marriage. Require the exact reciprocal person ID as well.
                const divorced = Boolean(member.formerSpouseIds?.includes(spouseId) && spouse?.formerSpouseIds?.includes(member.id))
                const currentlyMarried = Boolean(member.spouseIds.includes(spouseId) && spouse?.spouseIds.includes(member.id))
                if (!spouse || (!currentlyMarried && !divorced) || renderedSpousePairs.has(pairKey)) return
                renderedSpousePairs.add(pairKey)
                const first = positions.get(member.id); const second = positions.get(spouseId)
                if (!first || !second || first.x === second.x) return
                const circularOptions = mode === 'circle'
                  ? { anchorOffsetY: CIRCULAR_AVATAR_CENTER_Y, edgeInset: CIRCULAR_AVATAR_RADIUS }
                  : undefined
                const connector = getSpouseConnector(first, second, nodeWidth, nodeHeight, circularOptions)
                if (!connector) return
                const active = Boolean(activeLineIds && (activeLineIds.has(member.id) || activeLineIds.has(spouseId)))
                const selectedCouple = selectedId === member.id || selectedId === spouseId
                const selectedClass = selectedCouple ? ' is-selected-couple' : ''
                if (mode === 'circle') {
                  const [left, right] = first.x < second.x ? [first, second] : [second, first]
                  const leftCenter = left.x + nodeWidth / 2
                  const rightCenter = right.x + nodeWidth / 2
                  links.push(<rect className={`spouse-circle-rail${divorced ? ' is-divorced' : ''}${active ? ' is-active-line' : ''}${selectedClass}`} key={`spouse-rail-${pairKey}`} x={leftCenter - CIRCULAR_AVATAR_RADIUS - 4} y={connector.anchorY - CIRCULAR_AVATAR_RADIUS - 4} width={rightCenter - leftCenter + (CIRCULAR_AVATAR_RADIUS + 4) * 2} height={(CIRCULAR_AVATAR_RADIUS + 4) * 2} rx={CIRCULAR_AVATAR_RADIUS + 4} />)
                }
                links.push(<path className={`relationship-line ${divorced ? 'former-spouse-line' : 'spouse-line'}${active ? ' is-active-line' : ''}${selectedClass}`} key={`spouse-${pairKey}`} d={connector.path} />)
                if (divorced) links.push(<g className={`divorce-anchor${active ? ' is-active-line' : ''}${selectedClass}`} key={`divorce-anchor-${pairKey}`} transform={`translate(${connector.anchorX} ${connector.anchorY})`} role="img" aria-label={t('Divorced or separated')} tabIndex={0} {...relationshipTooltipEvents(t('Divorced or separated'))}>
                  <circle className="divorce-badge-backdrop" r={MARRIAGE_ANCHOR_RADIUS} />
                  <text x="0" y="5" textAnchor="middle" aria-hidden="true">💔</text>
                </g>)
                else links.push(<g className={`marriage-anchor${active ? ' is-active-line' : ''}${selectedClass}`} key={`marriage-anchor-${pairKey}`} transform={`translate(${connector.anchorX} ${connector.anchorY})`} role="img" aria-label={t('Married')} tabIndex={0} {...relationshipTooltipEvents(t('Married'))}>
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
            return <div className="tree-node-position" key={member.id} style={{ left: point.x, top: point.y }}><PersonCard member={member} mode={mode} branchColor={coupleColors?.get(coupleKey) ?? branchColors?.get(member.id) ?? null} isSelected={selectedId === member.id} isFocused={!focusedIds || focusedIds.has(member.id)} isSpotlighted={Boolean(focusedIds?.has(member.id))} isPulsing={pulseId === member.id} childCount={childCounts.get(member.id) ?? 0} isCollapsed={collapsedIds.has(member.id)} hasParents={hasVisibleParents} areAncestorsCollapsed={collapsedAncestorIds.has(member.id)} isDropTarget={dropTargetId === member.id} onHoverChange={(id) => setHoveredId(id)} onSelect={onSelect} onToggleBranch={onToggleBranch} onToggleAncestors={onToggleAncestors} onAddRelative={onAddRelative} onDragStart={handleDragStart} onDragEnd={endDrag} onDrop={handleDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId(member.id) }} /></div>
          })}
        </div>
      </div>}
      {relationshipTooltip && <div className="relationship-badge-tooltip" role="tooltip" style={{ left: relationshipTooltip.left, top: relationshipTooltip.top }}>{relationshipTooltip.label}</div>}
    </div>
  )
}
