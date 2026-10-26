import { createPortal } from 'react-dom'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Baby, Heart, Pencil, Trash2, UserRound, UsersRound } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'
import { getPersonContextActions, type PersonContextAction } from '../../lib/person-actions'
import { getContextSubmenuPosition } from '../../lib/context-submenu-position'
import { ExistingRelativePicker } from './ExistingRelativePicker'

type PersonContextMenuProps = {
  member: FamilyMember
  members: FamilyMember[]
  x: number
  y: number
  onClose: () => void
  onOpenDetails: (member: FamilyMember) => void
  onEdit: (member: FamilyMember) => void
  onDelete: (member: FamilyMember) => void
  onAddRelative: (sourceId: string, kind: RelationshipKind) => void
  onLinkRelative: (sourceId: string, relativeId: string, kind: RelationshipKind) => void
}

const themeProperties = ['--page', '--surface', '--surface-raised', '--surface-hover', '--surface-popover', '--line', '--line-soft', '--line-control', '--text', '--muted', '--subtle', '--accent', '--accent-soft', '--danger', '--danger-strong', '--shadow-popover', '--radius-popover', '--icon-primary', '--icon-tree', '--icon-relationship', '--icon-history', '--icon-info', '--icon-danger']
const personActionKinds = new Set<PersonContextAction['kind']>(['details', 'edit'])
const relationshipActionKinds = new Set<PersonContextAction['kind']>(['child', 'partner', 'parent', 'sibling'])
type ArrowSide = 'top' | 'right' | 'bottom' | 'left'

export function PersonContextMenu({ member, members, x, y, onClose, onOpenDetails, onEdit, onDelete, onAddRelative, onLinkRelative }: PersonContextMenuProps) {
  const { t } = useLanguage()
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [arrow, setArrow] = useState<{ side: ArrowSide; offset: number }>({ side: 'left', offset: 24 })
  const [positionReady, setPositionReady] = useState(false)
  const [themeStyle] = useState<Record<string, string>>(() => {
    const root = document.querySelector('.tree-app')
    if (!root) return {}
    const style = getComputedStyle(root)
    return { ...Object.fromEntries(themeProperties.map((property) => [property, style.getPropertyValue(property).trim()]).filter(([, value]) => Boolean(value))), direction: style.direction }
  })
  const [themeName] = useState(() => document.querySelector<HTMLElement>('.tree-app')?.dataset.theme ?? '')
  const [pickerKind, setPickerKind] = useState<RelationshipKind | null>(null)
  const [pickerAnchor, setPickerAnchor] = useState<HTMLButtonElement | null>(null)
  const closePicker = useCallback(() => {
    setPickerKind(null)
    setPickerAnchor(null)
  }, [])
  const pickerOpenRef = useRef(false)
  const [menuElement, setMenuElement] = useState<HTMLDivElement | null>(null)
  const buttonRefs = useRef<HTMLButtonElement[]>([])
  const actions = getPersonContextActions(member, members)

  useLayoutEffect(() => {
    const menu = menuElement
    if (!menu) return
    let frame = 0
    const positionMenu = (focus = false) => {
      const rect = menu.getBoundingClientRect()
      const padding = 8
      const candidates = [
        { x: x + 12, y: y + 10 },
        { x: x + 12, y: y - rect.height - 10 },
        { x: x - rect.width - 12, y: y + 10 },
        { x: x - rect.width - 12, y: y - rect.height - 10 },
      ]
      const personNode = [...document.querySelectorAll<HTMLElement>('.person-node')].find((node) => node.dataset.memberId === member.id)
      const nodeRect = personNode?.getBoundingClientRect()
      const detailsRect = document.querySelector<HTMLElement>('.details-panel')?.getBoundingClientRect()
      const avoidRects = detailsRect ? [{ left: detailsRect.left, right: detailsRect.right, top: detailsRect.top, bottom: detailsRect.bottom }] : []
      const isInBounds = (candidate: { x: number; y: number }) => candidate.x >= padding && candidate.y >= padding && candidate.x + rect.width <= window.innerWidth - padding && candidate.y + rect.height <= window.innerHeight - padding
      const overlapsPerson = (candidate: { x: number; y: number }) => Boolean(nodeRect && candidate.x < nodeRect.right + padding && candidate.x + rect.width > nodeRect.left - padding && candidate.y < nodeRect.bottom + padding && candidate.y + rect.height > nodeRect.top - padding)
      const overlapsDetails = (candidate: { x: number; y: number }) => avoidRects.some((avoid) => candidate.x < avoid.right && candidate.x + rect.width > avoid.left && candidate.y < avoid.bottom && candidate.y + rect.height > avoid.top)
      const available = candidates.filter((candidate) => isInBounds(candidate) && !overlapsPerson(candidate) && !overlapsDetails(candidate))
      const allowsInlinePicker = (candidate: { x: number; y: number }) => {
        const submenu = getContextSubmenuPosition({ left: candidate.x, right: candidate.x + rect.width, top: candidate.y, bottom: candidate.y + rect.height }, window.innerWidth, window.innerHeight, 312, 420, 6, avoidRects)
        return submenu.placement === 'inline' && !avoidRects.some((avoid) => submenu.left < avoid.right && submenu.left + submenu.width > avoid.left && submenu.top < avoid.bottom && submenu.top + submenu.maxHeight > avoid.top)
      }
      let next = available.find(allowsInlinePicker) ?? available[0]
      if (!next && nodeRect) {
        const aroundPerson = [
          { x: nodeRect.right + padding, y: nodeRect.top },
          { x: nodeRect.left - rect.width - padding, y: nodeRect.top },
          { x: nodeRect.left, y: nodeRect.bottom + padding },
          { x: nodeRect.left, y: nodeRect.top - rect.height - padding },
        ]
        const aroundAvailable = aroundPerson.filter((candidate) => isInBounds(candidate) && !overlapsPerson(candidate) && !overlapsDetails(candidate))
        next = aroundAvailable.find(allowsInlinePicker) ?? aroundAvailable[0]
      }
      if (!next) {
        const preferred = candidates[0]
        next = {
          x: Math.max(padding, Math.min(preferred.x, window.innerWidth - rect.width - padding)),
          y: Math.max(padding, Math.min(preferred.y, window.innerHeight - rect.height - padding)),
        }
      }
      const anchorX = nodeRect ? Math.max(nodeRect.left, Math.min(x, nodeRect.right)) : x
      const anchorY = nodeRect ? Math.max(nodeRect.top, Math.min(y, nodeRect.bottom)) : y
      let arrowSide: ArrowSide
      if (anchorX < next.x) arrowSide = 'left'
      else if (anchorX > next.x + rect.width) arrowSide = 'right'
      else if (anchorY < next.y) arrowSide = 'top'
      else if (anchorY > next.y + rect.height) arrowSide = 'bottom'
      else {
        const edgeDistances = [
          { side: 'left' as const, distance: Math.abs(anchorX - next.x) },
          { side: 'right' as const, distance: Math.abs(anchorX - (next.x + rect.width)) },
          { side: 'top' as const, distance: Math.abs(anchorY - next.y) },
          { side: 'bottom' as const, distance: Math.abs(anchorY - (next.y + rect.height)) },
        ]
        arrowSide = edgeDistances.sort((a, b) => a.distance - b.distance)[0].side
      }
      const arrowOffset = arrowSide === 'left' || arrowSide === 'right'
        ? Math.max(16, Math.min(anchorY - next.y, rect.height - 16))
        : Math.max(16, Math.min(anchorX - next.x, rect.width - 16))
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setPosition(next)
        setArrow({ side: arrowSide, offset: arrowOffset })
        setPositionReady(true)
        if (focus) buttonRefs.current.find((button) => button && !button.disabled)?.focus()
      })
    }
    positionMenu(true)
    const onResize = () => positionMenu()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [member.id, x, y, menuElement])

  useLayoutEffect(() => {
    pickerOpenRef.current = Boolean(pickerKind)
  }, [pickerKind])

  useLayoutEffect(() => {
    const menu = menuElement
    if (!menu) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menu.contains(target) || (target instanceof Element && target.closest('.existing-relative-picker'))) return
      onClose()
    }
    const onScroll = () => onClose()
    const onKeyDown = (event: KeyboardEvent) => {
      if (pickerOpenRef.current && event.target instanceof Element && event.target.closest('.existing-relative-picker')) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const current = buttonRefs.current.indexOf(document.activeElement as HTMLButtonElement)
        const step = event.key === 'ArrowDown' ? 1 : -1
        let next = current
        for (let attempts = 0; attempts < actions.length; attempts += 1) {
          next = (next + step + actions.length) % actions.length
          if (!buttonRefs.current[next]?.disabled) {
            buttonRefs.current[next]?.focus()
            break
          }
        }
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [actions.length, menuElement, onClose])

  function activate(action: PersonContextAction, anchor: HTMLButtonElement) {
    if (action.disabled) return
    if (action.relationship) {
      setPickerKind(action.relationship)
      setPickerAnchor(anchor)
      return
    }
    if (action.kind === 'details') onOpenDetails(member)
    if (action.kind === 'edit') onEdit(member)
    if (action.kind === 'delete') onDelete(member)
    onClose()
  }

  function iconFor(kind: PersonContextAction['kind']) {
    if (kind === 'details') return <UserRound size={16} />
    if (kind === 'edit') return <Pencil size={16} />
    if (kind === 'child') return <Baby size={16} />
    if (kind === 'partner') return <Heart size={16} />
    if (kind === 'parent') return <UserRound size={16} />
    if (kind === 'sibling') return <UsersRound size={16} />
    return <Trash2 size={16} />
  }

  function labelFor(kind: PersonContextAction['kind']) {
    if (kind === 'details') return t('View profile')
    if (kind === 'edit') return t('Edit person')
    if (kind === 'delete') return t('Delete person')
    return t(kind === 'child' ? 'Add child' : kind === 'partner' ? 'Add partner' : kind === 'parent' ? 'Add parent' : 'Add sibling')
  }

  const personActions = actions.filter((action) => personActionKinds.has(action.kind))
  const relationshipActions = actions.filter((action) => relationshipActionKinds.has(action.kind))
  const deleteAction = actions.find((action) => action.kind === 'delete')
  const renderAction = (action: PersonContextAction, index: number) => <button key={action.kind} ref={(element) => { if (element) buttonRefs.current[index] = element }} type="button" role="menuitem" disabled={action.disabled} aria-disabled={action.disabled || undefined} className={`person-context-menu-item is-${action.kind}${action.kind === 'delete' ? ' is-destructive' : ''}${action.disabled ? ' is-disabled' : ''}`} onClick={(event) => activate(action, event.currentTarget)}>{iconFor(action.kind)}<span className="person-context-menu-copy"><span>{labelFor(action.kind)}</span>{action.disabled && action.reason && <small>{t(action.reason)}</small>}</span></button>
  const menuStyle = { ...themeStyle, position: 'fixed', left: position.x, top: position.y, zIndex: 10040, visibility: positionReady ? 'visible' : 'hidden', '--context-arrow-offset': `${arrow.offset}px` } as CSSProperties
  const content = <div ref={setMenuElement} className="person-context-menu" data-theme={themeName} data-arrow-side={arrow.side} role="menu" aria-label={t('Person actions')} style={menuStyle}>
    <div className="person-context-menu-actions">
    {personActions.length > 0 && <section className="person-context-menu-group" aria-label={t('Person actions')}>
      <h3>{t('Person actions')}</h3>
      {personActions.map((action) => renderAction(action, actions.indexOf(action)))}
    </section>}
    {relationshipActions.length > 0 && <section className="person-context-menu-group" aria-label={t('Add relationships')}>
      <h3>{t('Add relationships')}</h3>
      {relationshipActions.map((action) => renderAction(action, actions.indexOf(action)))}
    </section>}
    {deleteAction && <section className="person-context-menu-group person-context-menu-danger" aria-label={t('Danger action')}>
      <h3>{t('Danger action')}</h3>
      {renderAction(deleteAction, actions.indexOf(deleteAction))}
    </section>}
    </div>
    {pickerKind && pickerAnchor && <ExistingRelativePicker key={pickerKind} source={member} members={members} kind={pickerKind} anchor={pickerAnchor} contextMenu={menuElement} onPick={(person, kind) => { onLinkRelative(member.id, person.id, kind); onClose() }} onCreateNew={(sourceId, kind) => { onAddRelative(sourceId, kind); onClose() }} onClose={closePicker} />}
  </div>

  return createPortal(content, document.body)
}
