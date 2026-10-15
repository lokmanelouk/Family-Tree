import { createPortal } from 'react-dom'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FamilyMember } from '../../types/family'
import { getSurnameSuggestions } from '../../lib/family-search'
import { useLanguage } from '../../i18n/useLanguage'

type LastNameFieldProps = {
  id: string
  value: string
  members: FamilyMember[]
  onChange: (value: string) => void
}

const themeProperties = ['--page', '--surface', '--surface-raised', '--line', '--text', '--muted', '--accent', '--accent-soft']

export function LastNameField({ id, value, members, onChange }: LastNameFieldProps) {
  const { t } = useLanguage()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 240 })
  const [themeStyle, setThemeStyle] = useState<Record<string, string>>({})
  const suggestions = useMemo(() => getSurnameSuggestions(members, value), [members, value])

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const input = inputRef.current
      if (!input) return
      const rect = input.getBoundingClientRect()
      const popupHeight = popupRef.current?.offsetHeight ?? 220
      const opensUp = window.innerHeight - rect.bottom < popupHeight && rect.top > popupHeight
      setPosition({
        top: Math.max(8, opensUp ? rect.top - popupHeight - 6 : rect.bottom + 6),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(rect.width, 320) - 8)),
        width: Math.min(rect.width, window.innerWidth - 16),
      })
      const root = input.closest('.member-dialog') ?? document.documentElement
      const computed = getComputedStyle(root)
      setThemeStyle(Object.fromEntries(themeProperties.map((property) => [property, computed.getPropertyValue(property).trim()]).filter(([, value]) => Boolean(value))))
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    const onPointerDown = (event: PointerEvent) => {
      if (!inputRef.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      setActiveIndex(-1)
    } else if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => index <= 0 ? suggestions.length - 1 : index - 1)
    } else if (event.key === 'Enter' && open && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault()
      onChange(suggestions[activeIndex].name)
      setOpen(false)
    }
  }

  return <>
    <input ref={inputRef} id={id} value={value} onChange={(event) => { onChange(event.target.value); setActiveIndex(-1); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={onInputKeyDown} maxLength={60} placeholder={t('Last name optional')} role="combobox" aria-autocomplete="list" aria-expanded={open && suggestions.length > 0} aria-controls={listId} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} />
    {open && suggestions.length > 0 && createPortal(<div ref={popupRef} id={listId} className="surname-suggestions" role="listbox" style={{ ...themeStyle, position: 'fixed', top: position.top, left: position.left, width: position.width, zIndex: 10000 }}>
      {suggestions.map((suggestion, index) => <button id={`${listId}-${index}`} type="button" role="option" aria-selected={activeIndex === index} key={suggestion.name} onPointerDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveIndex(index)} onClick={() => { onChange(suggestion.name); setOpen(false); inputRef.current?.focus() }}><bdi dir="auto">{suggestion.name}</bdi><span>(<bdi>{suggestion.count}</bdi>)</span></button>)}
    </div>, document.body)}
  </>
}
