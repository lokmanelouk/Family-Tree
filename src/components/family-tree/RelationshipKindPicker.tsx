import { useEffect, useId, useRef, useState } from 'react'
import { Baby, Check, ChevronDown, GitCommit, Heart, Users } from 'lucide-react'
import type { RelationshipKind } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'

type RelationshipKindPickerProps = {
  value: RelationshipKind
  onChange: (value: RelationshipKind) => void
}

const options: { value: RelationshipKind; label: string; Icon: typeof Users }[] = [
  { value: 'parent', label: 'Parent', Icon: Users },
  { value: 'child', label: 'Child', Icon: Baby },
  { value: 'partner', label: 'Partner', Icon: Heart },
  { value: 'sibling', label: 'Sibling', Icon: GitCommit },
]

export function RelationshipKindPicker({ value, onChange }: RelationshipKindPickerProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function moveFocus(index: number) {
    const nextIndex = (index + options.length) % options.length
    optionRefs.current[nextIndex]?.focus()
  }

  function choose(option: typeof selected) {
    onChange(option.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return <div className="relationship-kind-picker" ref={rootRef}>
    <button
      ref={triggerRef}
      className="relationship-kind-trigger"
      type="button"
      aria-label={`${t('Relationship to')}: ${t(selected.label)}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={pickerId}
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setOpen(true)
          requestAnimationFrame(() => moveFocus(selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)))
        }
      }}
    >
      <selected.Icon size={15} aria-hidden="true" />
      <span>{t(selected.label)}</span>
      <ChevronDown className="relationship-kind-chevron" size={15} aria-hidden="true" />
    </button>
    {open && <div className="relationship-kind-list" role="listbox" id={pickerId} aria-label={t('Relationship type')}>
      {options.map(({ value: optionValue, label, Icon }, index) => <button
        ref={(element) => { optionRefs.current[index] = element }}
        className="relationship-kind-option"
        type="button"
        key={optionValue}
        role="option"
        aria-selected={optionValue === value}
        tabIndex={optionValue === value ? 0 : -1}
        onClick={() => choose(options[index])}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(index + 1) }
          if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(index - 1) }
          if (event.key === 'Home') { event.preventDefault(); moveFocus(0) }
          if (event.key === 'End') { event.preventDefault(); moveFocus(options.length - 1) }
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(options[index]) }
        }}
      >
        <Icon size={15} aria-hidden="true" />
        <span>{t(label)}</span>
        {optionValue === value && <Check className="relationship-kind-check" size={14} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>
}
