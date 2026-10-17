import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'
import { FamilyAvatar } from './FamilyAvatar'
import { PersonName } from './PersonName'
import { getDisambiguatedFullName } from '../../lib/member-name'

type FamilyMemberPickerProps = {
  members: FamilyMember[]
  value: string
  onChange: (memberId: string) => void
  placeholder?: string
  disabled?: boolean
  optionNote?: (member: FamilyMember) => string | undefined
  allowClear?: boolean
}

export function FamilyMemberPicker({ members, value, onChange, placeholder, disabled = false, optionNote, allowClear = false }: FamilyMemberPickerProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = members.find((member) => member.id === value)

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

  return <div className="family-member-picker" ref={rootRef}>
    <button className="family-member-picker-trigger" type="button" disabled={disabled || !members.length} aria-haspopup="listbox" aria-expanded={open} aria-controls={pickerId} onClick={() => setOpen((current) => !current)}>
      {selected && <FamilyAvatar member={selected} compact />}
      <span className="family-member-picker-copy"><strong>{selected ? <PersonName name={getDisambiguatedFullName(selected, members)} /> : placeholder ?? t('Select a family member')}</strong></span>
      {!disabled && <ChevronDown size={16} aria-hidden="true" />}
    </button>
    {open && <div className="family-member-picker-list" role="listbox" id={pickerId} aria-label={t('Related family member')}>
      {members.map((member) => <button className="family-member-picker-option" type="button" key={member.id} role="option" aria-selected={member.id === selected?.id} onClick={() => { onChange(member.id); setOpen(false) }}>
        <span className="family-member-picker-avatar"><FamilyAvatar member={member} compact /></span>
        <span className="family-member-picker-copy"><strong><PersonName name={getDisambiguatedFullName(member, members)} /></strong><small>{member.birthDate ? <bdi dir="ltr">{member.birthDate}</bdi> : t('Birth date unknown')} {'\u00b7'} {t(member.relationship)}</small>{optionNote?.(member) && <small className="family-member-picker-note">{optionNote(member)}</small>}</span>
        {member.id === selected?.id && <Check size={15} aria-hidden="true" />}
      </button>)}
      {allowClear && value && <button className="family-member-picker-option family-member-picker-clear" type="button" role="option" aria-selected="false" onClick={() => { onChange(''); setOpen(false) }}><span className="family-member-picker-clear-icon"><X size={15} aria-hidden="true" /></span><span className="family-member-picker-copy"><strong>{t('Clear selection')}</strong></span></button>}
    </div>}
  </div>
}
