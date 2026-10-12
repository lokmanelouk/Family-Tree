import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Heart, Plus, Users } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'

type FamilyMemberSpeedDialProps = {
  member: FamilyMember
  onAddRelative: (member: FamilyMember, kind: RelationshipKind) => void
}

export function FamilyMemberSpeedDial({ member, onAddRelative }: FamilyMemberSpeedDialProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (open) actionsRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <div className="family-speed-dial" ref={rootRef} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }} onKeyDown={(event) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); close() }
  }}>
    <button ref={triggerRef} className="node-action speed-dial-trigger" type="button" aria-label={open ? t('Close actions menu') : t('Add a relative to {name}', { name: member.name })} aria-expanded={open} aria-controls={menuId} title={t('Add relative')} onClick={() => setOpen((value) => !value)}>
      <Plus size={15} className={open ? 'speed-dial-plus is-open' : 'speed-dial-plus'} />
    </button>
    {open && <div className="speed-dial-items" id={menuId} ref={actionsRef} aria-label={t('Add a relative to {name}', { name: member.name })}>
      <button type="button" className="speed-dial-item" style={{ '--item-index': 0 } as CSSProperties} onClick={() => { onAddRelative(member, 'child'); close() }}><Users size={14} /><span>{t('Add child')}</span></button>
      <button type="button" className="speed-dial-item" style={{ '--item-index': 1 } as CSSProperties} onClick={() => { onAddRelative(member, 'partner'); close() }}><Heart size={14} /><span>{t('Add partner')}</span></button>
    </div>}
  </div>
}
