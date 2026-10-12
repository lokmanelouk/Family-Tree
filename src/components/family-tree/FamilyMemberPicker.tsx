import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'
import { FamilyAvatar } from './FamilyAvatar'

type FamilyMemberPickerProps = {
  members: FamilyMember[]
  value: string
  onChange: (memberId: string) => void
}

export function FamilyMemberPicker({ members, value, onChange }: FamilyMemberPickerProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = members.find((member) => member.id === value) ?? members[0]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!selected) return null

  return <div className="family-member-picker" ref={rootRef}>
    <button className="family-member-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={pickerId} onClick={() => setOpen((current) => !current)}>
      <FamilyAvatar member={selected} compact />
      <span className="family-member-picker-copy"><strong>{selected.name}</strong></span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="family-member-picker-list" role="listbox" id={pickerId} aria-label={t('Related family member')}>
      {members.map((member) => <button className="family-member-picker-option" type="button" key={member.id} role="option" aria-selected={member.id === selected.id} onClick={() => { onChange(member.id); setOpen(false) }}>
        <span className="family-member-picker-avatar"><FamilyAvatar member={member} compact /></span>
        <span className="family-member-picker-copy"><strong>{member.name}</strong><small>{member.birthDate ?? t('Birth date unknown')} · {t(member.relationship)}</small></span>
        {member.id === selected.id && <Check size={15} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>
}
