import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { Baby, Crosshair, Heart, Pencil, ShieldAlert, UserRound, UsersRound } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'
import { getPersonContextActions } from '../../lib/person-actions'
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
  onCenter: (member: FamilyMember) => void
  onAddRelative: (sourceId: string, kind: RelationshipKind) => void
  onLinkRelative: (sourceId: string, relativeId: string, kind: RelationshipKind) => void
}

const themeProperties = ['--page', '--surface', '--surface-raised', '--surface-hover', '--line', '--text', '--muted', '--accent', '--accent-soft', '--danger', '--danger-strong']

export function PersonContextMenu({ member, members, x, y, onClose, onOpenDetails, onEdit, onDelete, onCenter, onAddRelative, onLinkRelative }: PersonContextMenuProps) {
  const { t } = useLanguage()
  const [position, setPosition] = useState({ x: Math.max(8, Math.min(x, window.innerWidth - 232)), y: Math.max(8, Math.min(y, window.innerHeight - 370)) })
  const [themeStyle] = useState<Record<string, string>>(() => {
    const root = document.querySelector('.tree-app')
    if (!root) return {}
    const style = getComputedStyle(root)
    return { ...Object.fromEntries(themeProperties.map((property) => [property, style.getPropertyValue(property).trim()]).filter(([, value]) => Boolean(value))), direction: style.direction }
  })
  const [pickerKind, setPickerKind] = useState<RelationshipKind | null>(null)
  const [pickerAnchor, setPickerAnchor] = useState<HTMLButtonElement | null>(null)
  const pickerOpenRef = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<HTMLButtonElement[]>([])
  const actions = getPersonContextActions(member)

  useEffect(() => {
    pickerOpenRef.current = Boolean(pickerKind)
  }, [pickerKind])

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const rect = menu.getBoundingClientRect()
    setPosition({ x: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) })
    buttonRefs.current[0]?.focus()
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
  }, [actions.length, onClose, x, y])

  function activate(kind: string, relationship?: RelationshipKind, anchor?: HTMLButtonElement) {
    if (relationship) {
      setPickerKind(relationship)
      setPickerAnchor(anchor ?? null)
      return
    }
    if (kind === 'details') onOpenDetails(member)
    if (kind === 'edit') onEdit(member)
    if (kind === 'center') onCenter(member)
    if (kind === 'delete') onDelete(member)
    onClose()
  }

  const iconFor = (kind: string) => {
    if (kind === 'details') return <UserRound size={17} />
    if (kind === 'edit') return <Pencil size={17} />
    if (kind === 'child') return <Baby size={17} />
    if (kind === 'partner') return <Heart size={17} />
    if (kind === 'parent') return <UserRound size={17} />
    if (kind === 'sibling') return <UsersRound size={17} />
    if (kind === 'center') return <Crosshair size={17} />
    return <ShieldAlert size={17} />
  }
  const labelFor = (kind: string) => kind === 'details' ? t('Open details') : kind === 'edit' ? t('Edit') : kind === 'center' ? t('Center on tree') : kind === 'delete' ? t('Delete') : t(kind === 'child' ? 'Add child' : kind === 'partner' ? 'Add partner' : kind === 'parent' ? 'Add parent' : 'Add sibling')
  const content = <div ref={menuRef} className="person-context-menu" role="menu" aria-label={t('Person actions')} style={{ ...themeStyle, position: 'fixed', left: position.x, top: position.y, zIndex: 10040 }}>
    {actions.map((action, index) => <button key={action.kind} ref={(element) => { if (element) buttonRefs.current[index] = element }} type="button" role="menuitem" disabled={action.disabled} title={action.disabled && action.reason ? t(action.reason) : undefined} className={`${action.kind === 'delete' ? 'is-destructive' : ''}${action.disabled ? ' is-disabled' : ''}`} onClick={(event) => activate(action.kind, action.relationship, event.currentTarget)}>{iconFor(action.kind)}<span>{labelFor(action.kind)}</span>{action.disabled && action.reason && <small>{t(action.reason)}</small>}</button>)}
    {pickerKind && pickerAnchor && <ExistingRelativePicker source={member} members={members} kind={pickerKind} anchor={pickerAnchor} onPick={(person, kind) => { onLinkRelative(member.id, person.id, kind); onClose() }} onCreateNew={(sourceId, kind) => { onAddRelative(sourceId, kind); onClose() }} onClose={() => { setPickerKind(null); setPickerAnchor(null); onClose() }} />}
  </div>

  return createPortal(content, document.body)
}
