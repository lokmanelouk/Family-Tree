import { createPortal } from 'react-dom'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'
import { FamilyAvatar } from './FamilyAvatar'
import { PersonName } from './PersonName'
import { getDisambiguatedFullName, getFullName, getNameParts, normalizeNameForMatch } from '../../lib/member-name'
import { PersonListMetadata } from './PersonListMetadata'

type FamilyMemberPickerProps = {
  members: FamilyMember[]
  value: string
  onChange: (memberId: string) => void
  placeholder?: string
  disabled?: boolean
  optionNote?: (member: FamilyMember) => string | undefined
  allowClear?: boolean
  searchable?: boolean
  excludeId?: string
  autoFocus?: boolean
  ariaLabel?: string
}

type PickerPosition = { top: number; inlineStart: number; width: number; maxHeight: number }

export function FamilyMemberPicker({ members, value, onChange, placeholder, disabled = false, optionNote, allowClear = false, searchable = false, excludeId, autoFocus = false, ariaLabel }: FamilyMemberPickerProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState<PickerPosition | null>(null)
  const [themeStyle, setThemeStyle] = useState<Record<string, string>>({})
  const [themeName, setThemeName] = useState('')
  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<string, HTMLButtonElement>())
  const selected = members.find((member) => member.id === value)
  const visibleMembers = useMemo(() => {
    const filtered = members.filter((member) => member.id !== excludeId)
    const normalizedQuery = normalizeNameForMatch(query)
    if (!normalizedQuery) return filtered
    return filtered.filter((member) => {
      const parts = getNameParts(member)
      return [getFullName(member), parts.firstName, parts.lastName]
        .some((part) => normalizeNameForMatch(part).includes(normalizedQuery))
    })
  }, [members, excludeId, query])

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus()
  }, [autoFocus])

  useEffect(() => {
    if (!open || !searchable || position === null) return
    searchRef.current?.focus()
  }, [open, position, searchable])

  useLayoutEffect(() => {
    if (!open || !searchable) return
    const updatePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const app = trigger.closest<HTMLElement>('.tree-app')
      const styleRoot = app ?? document.documentElement
      const computed = getComputedStyle(styleRoot)
      const variables: Record<string, string> = { direction: computed.direction }
      for (let index = 0; index < computed.length; index += 1) {
        const name = computed.item(index)
        if (name.startsWith('--')) variables[name] = computed.getPropertyValue(name).trim()
      }
      setThemeStyle(variables)
      setThemeName(app?.dataset.theme ?? '')

      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 24)
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const opensAbove = spaceBelow < 240 && spaceAbove > spaceBelow
      const availableHeight = opensAbove ? spaceAbove : spaceBelow
      const maxHeight = Math.max(100, Math.min(320, availableHeight))
      const top = opensAbove
        ? Math.max(12, rect.top - maxHeight - 7)
        : Math.min(rect.bottom + 7, window.innerHeight - maxHeight - 12)
      const rtl = computed.direction === 'rtl'
      setPosition({ top, inlineStart: rtl ? window.innerWidth - left - width : left, width, maxHeight })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
      setPosition(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (activeIndex < 0) return
    const person = visibleMembers[activeIndex]
    if (person) optionRefs.current.get(person.id)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, visibleMembers])

  function closePicker(restoreFocus = false) {
    setOpen(false)
    setPosition(null)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function choose(memberId: string) {
    onChange(memberId)
    setQuery('')
    setActiveIndex(-1)
    closePicker(true)
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closePicker(true)
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => {
        if (!visibleMembers.length) return -1
        if (current < 0) return direction > 0 ? 0 : visibleMembers.length - 1
        return (current + direction + visibleMembers.length) % visibleMembers.length
      })
      searchRef.current?.focus()
      return
    }
    if (event.key === 'Enter' && event.target === searchRef.current && activeIndex >= 0) {
      event.preventDefault()
      const member = visibleMembers[activeIndex]
      if (member) choose(member.id)
    }
  }

  function openPicker() {
    if (disabled || !members.length) return
    setQuery('')
    setActiveIndex(-1)
    setPosition(null)
    setOpen((current) => !current)
  }

  const optionItems = visibleMembers.map((member, index) => <button
    ref={(element) => { if (element) optionRefs.current.set(member.id, element); else optionRefs.current.delete(member.id) }}
    className={`family-member-picker-option${activeIndex === index && searchable ? ' is-keyboard-active' : ''}`}
    type="button"
    key={member.id}
    role="option"
    id={`family-person-option-${pickerId}-${member.id}`}
    aria-selected={searchable ? activeIndex === index : member.id === selected?.id}
    onPointerEnter={() => { if (searchable) setActiveIndex(index) }}
    onClick={() => choose(member.id)}
  >
    <span className="family-member-picker-avatar"><FamilyAvatar member={member} compact decorative /></span>
    <span className="family-member-picker-copy"><strong><PersonName name={getDisambiguatedFullName(member, members)} /></strong><PersonListMetadata member={member} />{optionNote?.(member) && <small className="family-member-picker-note">{optionNote(member)}</small>}</span>
    {member.id === value && <Check size={15} aria-hidden="true" />}
  </button>)

  const pickerList = open && <div
    ref={listRef}
    className={`family-member-picker-list${searchable ? ' is-searchable relationship-calculator-person-picker-list' : ''}`}
    data-theme={themeName}
    role={searchable ? undefined : 'listbox'}
    id={searchable ? undefined : pickerId}
    aria-label={searchable ? undefined : ariaLabel ?? t('Related family member')}
    onKeyDown={searchable ? handleListKeyDown : undefined}
    style={searchable ? {
      ...themeStyle,
      position: 'fixed',
      top: position?.top,
      bottom: 'auto',
      left: 'auto',
      right: 'auto',
      insetInlineStart: position?.inlineStart,
      width: position?.width,
      maxHeight: position?.maxHeight,
      boxSizing: 'border-box',
      zIndex: 12000,
      visibility: position ? 'visible' : 'hidden',
    } as CSSProperties : undefined}
  >
    {searchable && <div className="relationship-calculator-picker-search"><Search size={16} aria-hidden="true" /><input ref={searchRef} type="search" role="combobox" aria-expanded="true" aria-haspopup="listbox" dir="auto" value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1) }} placeholder={t('Search family members')} aria-label={t('Search family members')} aria-autocomplete="list" aria-controls={pickerId} aria-activedescendant={activeIndex >= 0 ? `family-person-option-${pickerId}-${visibleMembers[activeIndex]?.id}` : undefined} /><button type="button" aria-label={t('Close')} onClick={() => closePicker(true)}><X size={15} aria-hidden="true" /></button></div>}
    {searchable ? <div className="relationship-calculator-picker-results">{visibleMembers.length ? <div role="listbox" id={pickerId} aria-label={ariaLabel ?? t('Related family member')}>{optionItems}</div> : <div className="relationship-calculator-picker-empty" role="status">{t('No one found')}</div>}</div> : <div role="listbox" id={pickerId} aria-label={ariaLabel ?? t('Related family member')}>{optionItems}{allowClear && value && <button className="family-member-picker-option family-member-picker-clear" type="button" role="option" aria-selected="false" onClick={() => choose('')}><span className="family-member-picker-clear-icon"><X size={15} aria-hidden="true" /></span><span className="family-member-picker-copy"><strong>{t('Clear selection')}</strong></span></button>}</div>}
  </div>

  return <div className="family-member-picker" ref={rootRef}>
    <button ref={triggerRef} className="family-member-picker-trigger" type="button" disabled={disabled || !members.length} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={pickerId} onClick={openPicker} onKeyDown={(event) => { if (searchable && event.key === 'ArrowDown' && !open) { event.preventDefault(); openPicker() } }}>
      {selected && <FamilyAvatar member={selected} compact decorative />}
      <span className="family-member-picker-copy"><strong>{selected ? <PersonName name={getDisambiguatedFullName(selected, members)} /> : placeholder ?? t('Select a family member')}</strong></span>
      {!disabled && <ChevronDown size={16} aria-hidden="true" />}
    </button>
    {open && (!searchable || position) && (searchable ? createPortal(pickerList, document.body) : pickerList)}
  </div>
}
