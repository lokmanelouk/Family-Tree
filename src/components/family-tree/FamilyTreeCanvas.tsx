import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, PointerEvent, ReactNode, SVGProps } from 'react'
import { GitBranch, Plus } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { getBranchFocusIds, getHiddenAncestorIds, getHiddenIds } from '../../lib/tree-logic'
import { computeTreeLayout, getImmediateFamilyIds, getParentalCoupleColors, getParentChildBranchJunction, getParentChildConnectorPaths, getRootBranchMap, getSpouseConnector, MARRIAGE_ANCHOR_RADIUS, CIRCULAR_AVATAR_CENTER_Y, CIRCULAR_AVATAR_RADIUS, type TreeNodeMode } from '../../lib/tree-layout'
import { PersonCard } from './PersonCard'
import { PersonContextMenu } from './PersonContextMenu'
import { useLanguage } from '../../i18n/useLanguage'
import { getTreeContentBounds } from '../../lib/canvas-fit'
import { getRelationshipTooltipPosition } from '../../lib/relationship-tooltip-position'
import { createSvgPathInterpolator, getExitAnimationIds, getRemovedMemberIds, getStableConnectorSegments, removeMotionArtifactOnFinishOrCancel } from '../../lib/tree-motion'
import { getCanvasLocalOrigin, getScrollPreservingCanvasCenter } from '../../lib/canvas-viewport'

type NodeMotionSnapshot = { x: number; y: number; width: number; height: number }
type ShapeMotionSnapshot = { tagName: string; attributes: Record<string, string>; clone?: SVGElement }
type LayoutMotionSnapshot = { nodes: Map<string, NodeMotionSnapshot>; shapes: Map<string, ShapeMotionSnapshot>; removedNode?: HTMLElement; mode: TreeNodeMode; origin: { left: number; top: number; viewLeft: number; viewTop: number } }
type ViewportMotionSnapshot = { scrollLeft: number; scrollTop: number; viewportWidth: number; viewportHeight: number; worldLeft: number; worldTop: number; zoomX: number; zoomY: number }
type MotionBoundaryProps = { motionKey: { members: FamilyMember[] }; viewportKey: object; mode: TreeNodeMode; capture: (mode: TreeNodeMode, removedIds: string[]) => void; captureViewport: () => void; children: ReactNode }

class MotionSnapshotBoundary extends Component<MotionBoundaryProps> {
  getSnapshotBeforeUpdate(previousProps: MotionBoundaryProps) {
    if (previousProps.motionKey !== this.props.motionKey) {
      const removedIds = getRemovedMemberIds(previousProps.motionKey.members.map((member) => member.id), this.props.motionKey.members.map((member) => member.id))
      this.props.capture(previousProps.mode, removedIds)
    }
    if (previousProps.viewportKey !== this.props.viewportKey) this.props.captureViewport()
    return null
  }

  componentDidUpdate() {}

  render() {
    return this.props.children
  }
}

const layoutMotionDuration = 320

function getTransformMatrix(element: HTMLElement) {
  const transform = window.getComputedStyle(element).transform
  return transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform)
}

function readLayoutMotionSnapshot(world: HTMLDivElement, viewport: HTMLDivElement, selectedId: string | null, removedIds: string[], mode: TreeNodeMode) {
  const nodes = new Map<string, NodeMotionSnapshot>()
  const shapes = new Map<string, ShapeMotionSnapshot>()
  const worldMatrix = getTransformMatrix(world)
  const worldScaleX = Math.abs(worldMatrix.a) || 1
  const worldScaleY = Math.abs(worldMatrix.d) || 1
  const lineLayer = world.querySelector<SVGSVGElement>('.tree-lines:not(.tree-exit-lines)')
  const viewBox = (lineLayer?.getAttribute('viewBox') ?? '0 0 0 0').split(/[ ,]+/).map(Number)
  const localOrigin = getCanvasLocalOrigin(Number.parseFloat(world.style.left) || 0, Number.parseFloat(world.style.top) || 0, worldScaleX, worldScaleY)
  const origin = {
    left: localOrigin.left,
    top: localOrigin.top,
    viewLeft: viewBox[0] || 0,
    viewTop: viewBox[1] || 0,
  }
  const exitIds = new Set(getExitAnimationIds(removedIds, selectedId))
  let removedNode: HTMLElement | undefined

  world.querySelectorAll<HTMLElement>('.tree-node-position[data-person-id]').forEach((wrapper) => {
    const id = wrapper.dataset.personId
    const card = wrapper.querySelector<HTMLElement>('.person-node')
    if (!id || !card) return
    const matrix = getTransformMatrix(wrapper)
    const x = Number.parseFloat(wrapper.style.left) || 0
    const y = Number.parseFloat(wrapper.style.top) || 0
    nodes.set(id, {
      x: x + origin.left + matrix.e,
      y: y + origin.top + matrix.f,
      width: card.offsetWidth * Math.abs(matrix.a),
      height: card.offsetHeight * Math.abs(matrix.d),
    })
    if (id && exitIds.has(id)) {
      const clone = wrapper.cloneNode(true) as HTMLElement
      const wrapperBounds = wrapper.getBoundingClientRect()
      const viewportBounds = viewport.getBoundingClientRect()
      clone.classList.add('tree-node-exit-clone')
      clone.setAttribute('aria-hidden', 'true')
      clone.style.animation = 'none'
      clone.style.opacity = window.getComputedStyle(wrapper).opacity
      clone.style.left = `${wrapperBounds.left - viewportBounds.left - viewport.clientLeft}px`
      clone.style.top = `${wrapperBounds.top - viewportBounds.top - viewport.clientTop}px`
      clone.style.transform = `scale(${Math.abs(worldMatrix.a * matrix.a)}, ${Math.abs(worldMatrix.d * matrix.d)})`
      clone.style.transformOrigin = 'top left'
      clone.querySelectorAll<HTMLElement>('button, [tabindex]').forEach((control) => control.setAttribute('tabindex', '-1'))
      removedNode = clone
    }
  })

  world.querySelectorAll<SVGElement>('.tree-lines:not(.tree-exit-lines) [data-layout-key]').forEach((element) => {
    const key = element.dataset.layoutKey
    if (!key) return
    const attributes: Record<string, string> = {}
    const names = element.tagName.toLowerCase() === 'path'
      ? ['d', 'transform']
      : element.tagName.toLowerCase() === 'rect'
        ? ['x', 'y', 'width', 'height']
        : ['transform']
    names.forEach((name) => {
      const value = element.getAttribute(name)
      if (value !== null) attributes[name] = value
    })
    shapes.set(key, {
      tagName: element.tagName.toLowerCase(),
      attributes,
      clone: element.cloneNode(true) as SVGElement,
    })
  })

  return { nodes, shapes, removedNode, mode, origin }
}

function animateSvgOpacity(element: SVGElement, from: number, to: number, duration: number) {
  const animation = element.animate([{ opacity: from }, { opacity: to }], {
    duration,
    easing: 'ease-out',
    fill: 'forwards',
  })
  removeMotionArtifactOnFinishOrCancel(animation, element)
}

function animateExitNode(layer: HTMLDivElement, viewport: HTMLDivElement, clone: HTMLElement) {
  clone.style.left = `${(Number.parseFloat(clone.style.left) || 0) + viewport.scrollLeft}px`
  clone.style.top = `${(Number.parseFloat(clone.style.top) || 0) + viewport.scrollTop}px`
  layer.replaceChildren(clone)
  const scaleMatch = clone.style.transform.match(/^scale\(([-\d.]+),\s*([-\d.]+)\)$/)
  const scaleX = Number(scaleMatch?.[1]) || 1
  const scaleY = Number(scaleMatch?.[2]) || 1
  const animation = clone.animate([
    { opacity: Number(clone.style.opacity) || 1, transform: clone.style.transform },
    { opacity: 0, transform: `scale(${scaleX * 0.94}, ${scaleY * 0.94})` },
  ], { duration: 190, easing: 'ease-in', fill: 'forwards' })
  removeMotionArtifactOnFinishOrCancel(animation, clone)
  return animation
}

function appendExitShape(layer: SVGSVGElement | null, snapshot: ShapeMotionSnapshot | undefined, offsetX = 0, offsetY = 0) {
  if (!layer || !snapshot?.clone) return
  const clone = snapshot.clone
  clone.setAttribute('aria-hidden', 'true')
  clone.setAttribute('pointer-events', 'none')
  if (clone.hasAttribute('tabindex')) clone.setAttribute('tabindex', '-1')
  clone.querySelectorAll('[tabindex]').forEach((element) => element.setAttribute('tabindex', '-1'))
  if (clone.tagName.toLowerCase() === 'g') {
    const translation = parseTranslate(snapshot.attributes.transform)
    if (translation) clone.setAttribute('transform', `translate(${translation.x + offsetX} ${translation.y + offsetY})`)
  } else if (offsetX || offsetY) {
    clone.setAttribute('transform', `translate(${offsetX} ${offsetY})`)
  }
  layer.appendChild(clone)
  animateSvgOpacity(clone, Number(window.getComputedStyle(clone).opacity) || 1, 0, 190)
}

function parseTranslate(value: string | undefined) {
  const match = value?.match(/^translate\(\s*(-?[\d.]+)(?:[ ,]+)(-?[\d.]+)\s*\)$/)
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null
}

function relationshipPairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join('|')
}

type FamilyTreeCanvasProps = {
  members: FamilyMember[]
  collapsedIds: Set<string>
  collapsedAncestorIds: Set<string>
  zoom: number
  selectedId: string | null
  onSelect: (member: FamilyMember) => void
  onAddRelative: (member: FamilyMember, kind: RelationshipKind) => void
  onProposeRelationship: (source: FamilyMember, target: FamilyMember) => void
  onEmptyAdd: () => void
  onEditPerson: (member: FamilyMember) => void
  onDeletePerson: (member: FamilyMember) => void
  onLinkRelative: (sourceId: string, relativeId: string, kind: RelationshipKind) => void
  onFocusMember: (member: FamilyMember) => void
  branchFocusId: string | null
  onResetBranchFocus: () => void
  mode: TreeNodeMode
  compactCards: boolean
  focusId: string | null
  relationshipPathIds: string[] | null
  layoutRevision: number
  navigationTarget: { id: string; pathIds?: string[]; sequence: number } | null
}

export function FamilyTreeCanvas({ members, collapsedIds, collapsedAncestorIds, zoom, selectedId, onSelect, onAddRelative, onProposeRelationship, onEmptyAdd, onEditPerson, onDeletePerson, onLinkRelative, onFocusMember, branchFocusId, onResetBranchFocus, mode, compactCards, focusId, relationshipPathIds, layoutRevision, navigationTarget }: FamilyTreeCanvasProps) {
  const { t } = useLanguage()
  const viewportRef = useRef<HTMLDivElement>(null)
  const treeWorldRef = useRef<HTMLDivElement>(null)
  const exitNodeLayerRef = useRef<HTMLDivElement>(null)
  const exitLinesRef = useRef<SVGSVGElement>(null)
  const exitCandidateIdRef = useRef<string | null>(selectedId)
  const pendingMotionRef = useRef<LayoutMotionSnapshot | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const runningAnimationsRef = useRef<Animation[]>([])
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [emptyStateInteracted, setEmptyStateInteracted] = useState(false)
  const [pulseId, setPulseId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ member: FamilyMember; x: number; y: number } | null>(null)
  const [relationshipTooltip, setRelationshipTooltip] = useState<{ label: string; left: number; top: number; placement: 'above' | 'below' } | null>(null)
  const hasRelationshipTooltip = relationshipTooltip !== null
  const relationshipTooltipAnchor = useRef<SVGGElement | null>(null)
  const relationshipTooltipLabel = useRef<string | null>(null)
  const relationshipTooltipRef = useRef<HTMLDivElement>(null)
  const tooltipFrame = useRef<number | null>(null)
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const previousViewport = useRef<ViewportMotionSnapshot | null>(null)
  const previousLayoutRevision = useRef(layoutRevision)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const hiddenIds = useMemo(() => new Set([...getHiddenIds(members, collapsedIds), ...getHiddenAncestorIds(members, collapsedAncestorIds)]), [members, collapsedIds, collapsedAncestorIds])
  const visibleMembers = useMemo(() => members.filter((member) => !hiddenIds.has(member.id)), [members, hiddenIds])
  const spotlightId = hoveredId ?? selectedId ?? focusId
  const branchFocusedIds = useMemo(() => branchFocusId ? getBranchFocusIds(members, branchFocusId) : null, [members, branchFocusId])
  const relationshipFocusedIds = useMemo(() => relationshipPathIds?.length ? new Set(relationshipPathIds) : null, [relationshipPathIds])
  const relationshipPathEdges = useMemo(() => relationshipPathIds?.length
    ? new Set(relationshipPathIds.slice(1).map((id, index) => relationshipPairKey(relationshipPathIds[index], id)))
    : null, [relationshipPathIds])
  const spotlightFamilyIds = useMemo(() => spotlightId ? getImmediateFamilyIds(members, spotlightId) : null, [members, spotlightId])
  const focusedIds = branchFocusedIds ?? relationshipFocusedIds ?? spotlightFamilyIds
  const branchColors = useMemo(() => getRootBranchMap(members), [members])
  const coupleColors = useMemo(() => getParentalCoupleColors(members), [members])
  const activeLineMemberId = hoveredId ?? selectedId
  const activeLineFamilyIds = useMemo(() => activeLineMemberId ? getImmediateFamilyIds(members, activeLineMemberId) : null, [members, activeLineMemberId])
  const activeLineIds = branchFocusedIds ?? relationshipFocusedIds ?? activeLineFamilyIds
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members])
  const closeContextMenu = useCallback(() => setContextMenu(null), [])
  const handleContextDelete = useCallback((member: FamilyMember) => {
    exitCandidateIdRef.current = member.id
    onDeletePerson(member)
  }, [onDeletePerson])

  useLayoutEffect(() => {
    if (selectedId) exitCandidateIdRef.current = selectedId
  }, [selectedId])

  const layout = useMemo(() => computeTreeLayout(visibleMembers, mode, { compactCards }), [visibleMembers, mode, compactCards])
  const layoutMotionKey = useMemo(() => ({ positions: layout.positions, nodeWidth: layout.nodeWidth, nodeHeight: layout.nodeHeight, members, mode }), [layout.positions, layout.nodeWidth, layout.nodeHeight, members, mode])
  const { positions, width, height, nodeWidth, nodeHeight } = layout
  const contentBounds = useMemo(() => getTreeContentBounds(layout), [layout])
  const canvasPadding = 44
  const zoomedWidth = contentBounds.width * zoom
  const zoomedHeight = contentBounds.height * zoom
  const spaceWidth = Math.max(zoomedWidth + canvasPadding * 2, viewportSize.width)
  const spaceHeight = Math.max(zoomedHeight + canvasPadding * 2, viewportSize.height)
  const offsetX = (spaceWidth - zoomedWidth) / 2
  const offsetY = (spaceHeight - zoomedHeight) / 2
  const viewportMotionKey = useMemo(() => ({ zoom, offsetX, offsetY, spaceWidth, spaceHeight, viewportSize, layoutRevision, layoutMotionKey }), [zoom, offsetX, offsetY, spaceWidth, spaceHeight, viewportSize, layoutRevision, layoutMotionKey])
  const captureMotionSnapshot = useCallback((previousMode: TreeNodeMode, removedIds: string[]) => {
    const world = treeWorldRef.current
    const viewport = viewportRef.current
    if (world && viewport) pendingMotionRef.current = readLayoutMotionSnapshot(world, viewport, exitCandidateIdRef.current, removedIds, previousMode)
  }, [])
  const captureViewportSnapshot = useCallback(() => {
    const world = treeWorldRef.current
    const viewport = viewportRef.current
    if (!world || !viewport) return
    const matrix = getTransformMatrix(world)
    previousViewport.current = {
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
      worldLeft: Number.parseFloat(world.style.left) || 0,
      worldTop: Number.parseFloat(world.style.top) || 0,
      zoomX: Math.abs(matrix.a) || 1,
      zoomY: Math.abs(matrix.d) || 1,
    }
  }, [])
  const contentPositions = useMemo(() => new Map([...positions].map(([id, point]) => [id, { ...point, x: point.x - contentBounds.left, y: point.y - contentBounds.top }])), [positions, contentBounds])

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
    const world = treeWorldRef.current
    const viewport = viewportRef.current
    if (!world) {
      const pending = pendingMotionRef.current
      pendingMotionRef.current = null
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!reducedMotion && pending?.removedNode && exitNodeLayerRef.current && viewport) {
        runningAnimationsRef.current.push(animateExitNode(exitNodeLayerRef.current, viewport, pending.removedNode))
      }
      return
    }
    const pending = pendingMotionRef.current
    pendingMotionRef.current = null
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wrapperById = new Map([...world.querySelectorAll<HTMLElement>('.tree-node-position[data-person-id]')].map((node) => [node.dataset.personId!, node]))
    const shapeByKey = new Map([...world.querySelectorAll<SVGElement>('.tree-lines:not(.tree-exit-lines) [data-layout-key]')].map((shape) => [shape.dataset.layoutKey!, shape]))
    const currentLineLayer = world.querySelector<SVGSVGElement>('.tree-lines:not(.tree-exit-lines)')
    const currentViewBox = (currentLineLayer?.getAttribute('viewBox') ?? '0 0 0 0').split(/[ ,]+/).map(Number)
    const worldMatrix = getTransformMatrix(world)
    const currentOrigin = getCanvasLocalOrigin(Number.parseFloat(world.style.left) || 0, Number.parseFloat(world.style.top) || 0, worldMatrix.a, worldMatrix.d)
    const currentOriginLeft = currentOrigin.left
    const currentOriginTop = currentOrigin.top
    const frameOffsetX = pending ? pending.origin.left - currentOriginLeft + (currentViewBox[0] || 0) - pending.origin.viewLeft : 0
    const frameOffsetY = pending ? pending.origin.top - currentOriginTop + (currentViewBox[1] || 0) - pending.origin.viewTop : 0
    const animations: Animation[] = []
    const tasks: Array<(progress: number) => void> = []

    const modeChanged = pending !== null && pending.mode !== mode

    if (pending && !reducedMotion) {
      pending.nodes.forEach((previous, id) => {
        const wrapper = wrapperById.get(id)
        if (!wrapper) return
        const card = wrapper.querySelector<HTMLElement>('.person-node')
        if (!card) return
        const x = (Number.parseFloat(wrapper.style.left) || 0) + currentOriginLeft
        const y = (Number.parseFloat(wrapper.style.top) || 0) + currentOriginTop
        const dx = previous.x - x
        const dy = previous.y - y
        const scaleX = previous.width > 0 && card.offsetWidth > 0 ? previous.width / card.offsetWidth : 1
        const scaleY = previous.height > 0 && card.offsetHeight > 0 ? previous.height / card.offsetHeight : 1
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5 || Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
          animations.push(wrapper.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})` },
            { transform: 'translate(0, 0) scale(1, 1)' },
          ], { duration: layoutMotionDuration, easing: 'cubic-bezier(0.22, 0.72, 0.2, 1)' }))
        }
        if (modeChanged) {
          const content = wrapper.querySelector<HTMLElement>('.member-main')
          if (content) animations.push(content.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 210, easing: 'ease-out' }))
        }
      })

      const appendFadeOut = (snapshot: ShapeMotionSnapshot | undefined) => appendExitShape(exitLinesRef.current, snapshot, frameOffsetX, frameOffsetY)
      shapeByKey.forEach((shape, key) => {
        const previous = pending.shapes.get(key)
        if (!previous) {
          animations.push(shape.animate([{ opacity: 0 }, { opacity: Number(window.getComputedStyle(shape).opacity) || 1 }], { duration: 190, easing: 'ease-out' }))
          return
        }

        if (previous.tagName !== shape.tagName.toLowerCase()) {
          appendFadeOut(previous)
          animations.push(shape.animate([{ opacity: 0 }, { opacity: Number(window.getComputedStyle(shape).opacity) || 1 }], { duration: 190, easing: 'ease-out' }))
          return
        }

        if (shape.tagName.toLowerCase() === 'path') {
          const from = previous.attributes.d
          const to = shape.getAttribute('d')
          if (from === to && !frameOffsetX && !frameOffsetY) return
          const interpolatePath = from && to ? createSvgPathInterpolator(from, to) : null
          if (from && to && interpolatePath) {
            shape.setAttribute('d', from)
            if (frameOffsetX || frameOffsetY) shape.setAttribute('transform', `translate(${frameOffsetX} ${frameOffsetY})`)
            tasks.push((progress) => {
              if (from !== to) shape.setAttribute('d', interpolatePath(progress))
              if (frameOffsetX || frameOffsetY) {
                if (progress >= 1) shape.removeAttribute('transform')
                else shape.setAttribute('transform', `translate(${frameOffsetX * (1 - progress)} ${frameOffsetY * (1 - progress)})`)
              }
            })
          } else if (from !== to) {
            appendFadeOut(previous)
            animations.push(shape.animate([{ opacity: 0 }, { opacity: Number(window.getComputedStyle(shape).opacity) || 1 }], { duration: 190, easing: 'ease-out' }))
          }
          return
        }

        if (shape.tagName.toLowerCase() === 'rect') {
          const names = ['x', 'y', 'width', 'height']
          const values = names.map((name) => ({ name, from: Number(previous.attributes[name]), to: Number(shape.getAttribute(name)) }))
          if ((values.some((value) => value.from !== value.to) || frameOffsetX || frameOffsetY) && values.every((value) => Number.isFinite(value.from) && Number.isFinite(value.to))) {
            values.forEach(({ name, from }) => shape.setAttribute(name, String(from)))
            if (frameOffsetX || frameOffsetY) shape.setAttribute('transform', `translate(${frameOffsetX} ${frameOffsetY})`)
            tasks.push((progress) => {
              values.forEach(({ name, from, to }) => shape.setAttribute(name, String(from + (to - from) * progress)))
              if (frameOffsetX || frameOffsetY) {
                if (progress >= 1) shape.removeAttribute('transform')
                else shape.setAttribute('transform', `translate(${frameOffsetX * (1 - progress)} ${frameOffsetY * (1 - progress)})`)
              }
            })
          }
          return
        }

        const from = parseTranslate(previous.attributes.transform)
        const to = parseTranslate(shape.getAttribute('transform') ?? undefined)
        if (from && to && (from.x !== to.x || from.y !== to.y || frameOffsetX || frameOffsetY)) {
          shape.setAttribute('transform', `translate(${from.x + frameOffsetX} ${from.y + frameOffsetY})`)
          tasks.push((progress) => shape.setAttribute('transform', `translate(${from.x + frameOffsetX * (1 - progress) + (to.x - from.x) * progress} ${from.y + frameOffsetY * (1 - progress) + (to.y - from.y) * progress})`))
        }
      })

      pending.shapes.forEach((snapshot, key) => {
        if (!shapeByKey.has(key)) appendFadeOut(snapshot)
      })

      const removedNodeId = pending.removedNode?.dataset.personId
      if (pending.removedNode && removedNodeId && !wrapperById.has(removedNodeId) && exitNodeLayerRef.current && viewport) {
        animations.push(animateExitNode(exitNodeLayerRef.current, viewport, pending.removedNode))
      }
    }

    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
    if (tasks.length && !reducedMotion) {
      const startedAt = performance.now()
      const animateFrame = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / layoutMotionDuration)
        const eased = 1 - Math.pow(1 - progress, 3)
        tasks.forEach((task) => task(eased))
        if (progress < 1) animationFrameRef.current = window.requestAnimationFrame(animateFrame)
        else animationFrameRef.current = null
      }
      animationFrameRef.current = window.requestAnimationFrame(animateFrame)
    }
    runningAnimationsRef.current.push(...animations)
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      runningAnimationsRef.current.forEach((animation) => animation.cancel())
      runningAnimationsRef.current = []
    }
  }, [positions, nodeWidth, nodeHeight, members, mode])

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
    const tooltip = relationshipTooltipRef.current
    const tooltipWidth = tooltip?.offsetWidth || Math.min(220, Math.max(0, viewport.clientWidth - 24))
    const tooltipHeight = tooltip?.offsetHeight || 34
    const position = getRelationshipTooltipPosition(
      { x: point.x - visibleLeft, y: point.y - visibleTop },
      { width: tooltipWidth, height: tooltipHeight },
      { width: viewport.clientWidth, height: viewport.clientHeight, scrollLeft: viewport.scrollLeft, scrollTop: viewport.scrollTop },
    )
    setRelationshipTooltip((current) => current && current.label === label && current.left === position.left && current.top === position.top && current.placement === position.placement
      ? current
      : { label, ...position })
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
    if (hasRelationshipTooltip) refreshRelationshipTooltipPosition()
  }, [hasRelationshipTooltip, refreshRelationshipTooltipPosition])

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
      const scroll = getScrollPreservingCanvasCenter(previous, { width: viewport.clientWidth, height: viewport.clientHeight }, { zoomX: zoom, zoomY: zoom, offsetX, offsetY })
      viewport.scrollLeft = Math.max(0, scroll.left)
      viewport.scrollTop = Math.max(0, scroll.top)
    } else {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      viewport.scrollTo({
        left: Math.max(0, (spaceWidth - viewport.clientWidth) / 2),
        top: Math.max(0, (spaceHeight - viewport.clientHeight) / 2),
        behavior: shouldCenter && !reducedMotion ? 'smooth' : 'auto',
      })
    }
    previousLayoutRevision.current = layoutRevision
  }, [zoom, width, height, offsetX, offsetY, spaceWidth, spaceHeight, layoutRevision])

  useLayoutEffect(() => {
    if (!navigationTarget) return
    const viewport = viewportRef.current
    if (!viewport) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const localPoint = contentPositions.get(navigationTarget.id)
    const pathPoints = (navigationTarget.pathIds ?? []).flatMap((id) => {
      const point = contentPositions.get(id)
      return point ? [point] : []
    })
    const targetPoints = pathPoints.length ? pathPoints : localPoint ? [localPoint] : []
    if (!targetPoints.length) return
    const left = Math.min(...targetPoints.map((point) => point.x))
    const right = Math.max(...targetPoints.map((point) => point.x + nodeWidth))
    const top = Math.min(...targetPoints.map((point) => point.y))
    const bottom = Math.max(...targetPoints.map((point) => point.y + nodeHeight))
    const centerX = (left + right) / 2
    const centerY = (top + bottom) / 2
    const scrollLeft = offsetX + centerX * zoom - viewport.clientWidth / 2
    const scrollTop = offsetY + centerY * zoom - viewport.clientHeight / 2
    viewport.scrollTo({ left: Math.max(0, scrollLeft), top: Math.max(0, scrollTop), behavior: reducedMotion ? 'auto' : 'smooth' })
    const revealTimer = window.setTimeout(() => setPulseId(navigationTarget.id), reducedMotion ? 0 : 420)
    const clearTimer = window.setTimeout(() => setPulseId((current) => current === navigationTarget.id ? null : current), reducedMotion ? 1150 : 1650)
    return () => {
      window.clearTimeout(revealTimer)
      window.clearTimeout(clearTimer)
    }
  }, [navigationTarget, contentPositions, nodeWidth, nodeHeight, zoom, offsetX, offsetY, viewportSize])

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
    if (event.button !== 0 || (event.target as HTMLElement).closest('.person-node, button, a, [role="button"], .relationship-badge-tooltip')) return
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
    setRelationshipTooltip({ label, left: 0, top: 0, placement: 'above' })
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
    <div className="tree-canvas-frame">
    {branchFocusId && <button type="button" className="tree-branch-focus-reset" onClick={onResetBranchFocus}><GitBranch size={16} />{t('Reset View')}</button>}
    <div className="tree-viewport" ref={viewportRef} onWheel={() => { if (members.length === 0) setEmptyStateInteracted(true) }} onPointerDownCapture={() => { if (members.length === 0) setEmptyStateInteracted(true) }} onFocusCapture={() => { if (members.length === 0) setEmptyStateInteracted(true) }} onKeyDownCapture={() => { if (members.length === 0) setEmptyStateInteracted(true) }} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} onPointerLeave={stopPan}>
      <MotionSnapshotBoundary motionKey={layoutMotionKey} viewportKey={viewportMotionKey} mode={mode} capture={captureMotionSnapshot} captureViewport={captureViewportSnapshot}>
      {members.length === 0 ? <div className="tree-empty"><div className="tree-empty-card" onPointerEnter={() => setEmptyStateInteracted(true)} onFocusCapture={() => setEmptyStateInteracted(true)} onKeyDownCapture={() => setEmptyStateInteracted(true)}><span className="tree-empty-illustration"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 11v11M24 22H12v11M24 22h12v11" /><circle cx="24" cy="9" r="4" /><circle cx="12" cy="35" r="4" /><circle cx="36" cy="35" r="4" /><circle cx="24" cy="22" r="3" /></svg></span><h2>{t('Your family tree starts here')}</h2><p>{t('Every family begins with someone. Add your first family member to start growing your tree.')}</p><button type="button" className={`empty-state-primary${emptyStateInteracted ? '' : ' has-attention'}`} onClick={() => { setEmptyStateInteracted(true); onEmptyAdd() }}><Plus size={17} aria-hidden="true" /> {t('Add your first family member')}</button></div></div> : <div className="tree-zoom-space" style={{ width: spaceWidth, height: spaceHeight }}>
        <div ref={treeWorldRef} className="tree-world" style={{ width: contentBounds.width, height: contentBounds.height, left: offsetX, top: offsetY, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
          <svg className={`tree-lines${activeLineIds ? ' has-active-line-focus' : ''}${branchFocusedIds ? ' is-branch-focus' : ''}`} width={contentBounds.width} height={contentBounds.height} viewBox={`${contentBounds.left} ${contentBounds.top} ${contentBounds.width} ${contentBounds.height}`}>
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
                const focusedChildren = relationshipFocusedIds ? children.filter((child) => relationshipFocusedIds.has(child.id)) : []
                const pathUsesParentEdge = Boolean(relationshipPathEdges && focusedChildren.some((child) => parentIds.some((parentId) => relationshipPathEdges.has(relationshipPairKey(parentId, child.id)))))
                const pathUsesSiblingBus = focusedChildren.length > 1
                const groupActive = relationshipFocusedIds
                  ? pathUsesParentEdge || pathUsesSiblingBus
                  : Boolean(activeLineIds && (parentIds.some((id) => activeLineIds.has(id)) || children.some((child) => activeLineIds.has(child.id))))
                const connectorSegments = getStableConnectorSegments(getParentChildConnectorPaths(parents, childPoints, nodeWidth, nodeHeight, lane, coupleAnchorOffset), children.map((child) => child.id))
                connectorSegments.forEach(({ key, path, childId }) => {
                  const pathSegmentActive = groupActive && (!relationshipFocusedIds || !childId || relationshipFocusedIds.has(childId))
                  links.push(<path className={`relationship-line parent-child-line${adopted ? ' adopted-parent-line' : ''}${pathSegmentActive ? ' is-active-line' : ''}`} style={color === null ? undefined : { stroke: color }} key={`${groupKey}-${key}`} data-layout-key={`${groupKey}-${key}`} d={path} />)
                })
                if (adopted) {
                  const junction = getParentChildBranchJunction(parents, childPoints, nodeWidth, nodeHeight, lane, coupleAnchorOffset)
                  if (junction) links.push(<g className={`adoption-anchor${groupActive ? ' is-active-line' : ''}`} key={`${groupKey}-adoption-anchor`} data-layout-key={`${groupKey}-adoption-anchor`} transform={`translate(${junction.x} ${junction.y})`} role="img" aria-label={t('Adopted child')} tabIndex={0} {...relationshipTooltipEvents(t('Adopted child'))}>
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
                const spouse = membersById.get(spouseId)
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
                const active = relationshipPathEdges
                  ? relationshipPathEdges.has(relationshipPairKey(member.id, spouseId))
                  : Boolean(activeLineIds && (activeLineIds.has(member.id) || activeLineIds.has(spouseId)))
                const selectedCouple = selectedId === member.id || selectedId === spouseId
                const selectedClass = selectedCouple ? ' is-selected-couple' : ''
                if (mode === 'circle') {
                  const [left, right] = first.x < second.x ? [first, second] : [second, first]
                  const leftCenter = left.x + nodeWidth / 2
                  const rightCenter = right.x + nodeWidth / 2
                  links.push(<rect className={`spouse-circle-rail${divorced ? ' is-divorced' : ''}${active ? ' is-active-line' : ''}${selectedClass}`} key={`spouse-rail-${pairKey}`} data-layout-key={`spouse-rail-${pairKey}`} x={leftCenter - CIRCULAR_AVATAR_RADIUS - 4} y={connector.anchorY - CIRCULAR_AVATAR_RADIUS - 4} width={rightCenter - leftCenter + (CIRCULAR_AVATAR_RADIUS + 4) * 2} height={(CIRCULAR_AVATAR_RADIUS + 4) * 2} rx={CIRCULAR_AVATAR_RADIUS + 4} />)
                }
                links.push(<path className={`relationship-line ${divorced ? 'former-spouse-line' : 'spouse-line'}${active ? ' is-active-line' : ''}${selectedClass}`} key={`spouse-${pairKey}`} data-layout-key={`spouse-${pairKey}`} d={connector.path} />)
                if (divorced) links.push(<g className={`divorce-anchor${active ? ' is-active-line' : ''}${selectedClass}`} key={`divorce-anchor-${pairKey}`} data-layout-key={`divorce-anchor-${pairKey}`} transform={`translate(${connector.anchorX} ${connector.anchorY})`} role="img" aria-label={t('Divorced or separated')} tabIndex={0} {...relationshipTooltipEvents(t('Divorced or separated'))}>
                  <circle className="divorce-badge-backdrop" r={MARRIAGE_ANCHOR_RADIUS} />
                  <text x="0" y="5" textAnchor="middle" aria-hidden="true">💔</text>
                </g>)
                else links.push(<g className={`marriage-anchor${active ? ' is-active-line' : ''}${selectedClass}`} key={`marriage-anchor-${pairKey}`} data-layout-key={`marriage-anchor-${pairKey}`} transform={`translate(${connector.anchorX} ${connector.anchorY})`} role="img" aria-label={t('Married')} tabIndex={0} {...relationshipTooltipEvents(t('Married'))}>
                  <circle className="marriage-anchor-backdrop" r={MARRIAGE_ANCHOR_RADIUS} />
                  <circle className="marriage-ring" cx="-2" cy="0" r="3.3" />
                  <circle className="marriage-ring" cx="2" cy="0" r="3.3" />
                </g>)
              }))
              return links
            })()}
          </svg>
          <svg ref={exitLinesRef} className="tree-lines tree-exit-lines" width={contentBounds.width} height={contentBounds.height} viewBox={`${contentBounds.left} ${contentBounds.top} ${contentBounds.width} ${contentBounds.height}`} aria-hidden="true" />
          {visibleMembers.map((member) => {
            const point = positions.get(member.id)
            if (!point) return null
            const coupleKey = member.parentIds.slice().sort().join('|')
            const localPoint = contentPositions.get(member.id)
            if (!localPoint) return null
            return <div className="tree-node-position" key={member.id} data-person-id={member.id} style={{ left: localPoint.x, top: localPoint.y }}><PersonCard member={member} mode={mode} nodeWidth={nodeWidth} nodeHeight={nodeHeight} branchColor={coupleColors?.get(coupleKey) ?? branchColors?.get(member.id) ?? null} isSelected={selectedId === member.id} isFocused={!focusedIds || focusedIds.has(member.id)} isBranchFocusDimmed={Boolean(branchFocusedIds && !branchFocusedIds.has(member.id))} isSpotlighted={Boolean(focusedIds?.has(member.id))} isPulsing={pulseId === member.id} isDropTarget={dropTargetId === member.id} onHoverChange={(id) => setHoveredId(id)} onSelect={(person) => { exitCandidateIdRef.current = person.id; onSelect(person) }} onOpenContextMenu={(person, x, y) => { exitCandidateIdRef.current = person.id; setContextMenu({ member: person, x, y }) }} onDragStart={handleDragStart} onDragEnd={endDrag} onDrop={handleDrop} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId(member.id) }} /></div>
          })}
        </div>
      </div>}
      </MotionSnapshotBoundary>
      <div ref={exitNodeLayerRef} className="tree-node-exit-layer" aria-hidden="true" />
      {relationshipTooltip && <div ref={relationshipTooltipRef} className={`relationship-badge-tooltip is-${relationshipTooltip.placement}`} role="tooltip" style={{ left: relationshipTooltip.left, top: relationshipTooltip.top }}>{relationshipTooltip.label}</div>}
      {contextMenu && <PersonContextMenu member={contextMenu.member} members={members} x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu} onOpenDetails={onFocusMember} onEdit={onEditPerson} onDelete={handleContextDelete} onAddRelative={(sourceId, kind) => { const source = members.find((person) => person.id === sourceId); if (source) onAddRelative(source, kind) }} onLinkRelative={onLinkRelative} />}
    </div>
    </div>
  )
}
