import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, TriangleAlert, UserRoundPlus, X } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'
import { collectValidationIssues, validateRelationshipRules, type ValidationIssue } from '../../lib/family-validation'
import { getPickerCandidates } from '../../lib/family-picker'
import { getDisambiguatedFullName } from '../../lib/member-name'
import { getMemberAge } from '../../lib/member-age'
import { isMemberDeceased } from '../../lib/member-status'
import { FamilyAvatar } from './FamilyAvatar'
import { ValidationMessage } from './ValidationFeedback'
import { PersonName } from './PersonName'

type ExistingRelativePickerProps = {
  source: FamilyMember
  members: FamilyMember[]
  kind: RelationshipKind
  anchor: HTMLElement
  onPick: (person: FamilyMember, kind: RelationshipKind) => void
  onCreateNew: (sourceId: string, kind: RelationshipKind) => void
  onClose: () => void
}

const themeProperties = ['--page', '--surface', '--surface-raised', '--surface-hover', '--line', '--text', '--muted', '--accent', '--accent-soft', '--accent-strong', '--focus', '--danger', '--danger-strong', '--validation-error', '--validation-error-strong', '--validation-error-tint', '--validation-warning', '--validation-warning-strong', '--validation-warning-tint']

export function ExistingRelativePicker({ source, members, kind: initialKind, anchor, onPick, onCreateNew, onClose }: ExistingRelativePickerProps) {
  const { t, language } = useLanguage()
  const [kind, setKind] = useState(initialKind)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<FamilyMember | null>(null)
  const [warnings, setWarnings] = useState<ValidationIssue[]>([])
  const [position, setPosition] = useState<{ top: number; inlineStart: number; width: number; maxHeight: number } | null>(null)
  const [isPositioned, setIsPositioned] = useState(false)
  const [themeStyle, setThemeStyle] = useState<Record<string, string>>({})
  const popupRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [showHidden, setShowHidden] = useState(false)
  const needsParentFirst = kind === 'sibling' && source.parentIds.length === 0
  const alreadyHasTwoParents = kind === 'parent' && source.parentIds.length >= 2
  const { visible, hidden } = useMemo(() => getPickerCandidates(source, members, kind, query, language), [source, members, kind, query, language])

  useEffect(() => {
    if (isPositioned && (!pending || !warnings.length)) searchRef.current?.focus()
  }, [isPositioned, pending, warnings.length])

  useEffect(() => {
    searchRef.current?.focus()
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect()
      const width = Math.min(340, window.innerWidth - 24)
      const maxHeight = Math.min(460, Math.floor(window.innerHeight * 0.7))
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const opensUp = spaceBelow < Math.min(260, maxHeight) && spaceAbove > spaceBelow
      const root = anchor.closest('.tree-app') ?? anchor
      const computed = getComputedStyle(root)
      setThemeStyle({ ...Object.fromEntries(themeProperties.map((property) => [property, computed.getPropertyValue(property).trim()]).filter(([, value]) => Boolean(value))), direction: computed.direction })
      const rtl = computed.direction === 'rtl'
      const inlineStart = rtl ? window.innerWidth - rect.right : rect.left
      const proposedTop = opensUp ? rect.top - maxHeight - 8 : rect.bottom + 8
      setPosition({ top: Math.max(12, Math.min(proposedTop, window.innerHeight - maxHeight - 12)), inlineStart: Math.max(12, Math.min(inlineStart, window.innerWidth - width - 12)), width, maxHeight })
      setIsPositioned(true)
    }
    updatePosition()
    const onPointerDown = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); anchor.focus() }
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [anchor, onClose])

  function choose(person: FamilyMember) {
    const issues = collectValidationIssues(validateRelationshipRules(members, source, person, kind))
    const errors = issues.filter((issue) => issue.type === 'error')
    if (errors.length) return
    const nextWarnings = issues.filter((issue) => issue.type === 'warning')
    if (nextWarnings.length) { setPending(person); setWarnings(nextWarnings); return }
    onPick(person, kind)
  }

  function continueWithPending() {
    if (!pending) return
    onPick(pending, kind)
  }

  function chooseSomeoneElse() {
    setPending(null)
    setWarnings([])
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => index + 1 >= visible.length ? 0 : index + 1) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => index <= 0 ? visible.length - 1 : index - 1) }
    if (event.key === 'Enter' && activeIndex >= 0 && visible[activeIndex]) { event.preventDefault(); choose(visible[activeIndex].person) }
  }

  const hiddenLabel = t('{count} people hidden ({action})', { count: '__COUNT__', action: t(showHidden ? 'Hide' : 'Show') }).split('__COUNT__')
  if (!position) return null
  const content = <div ref={popupRef} className="existing-relative-picker" role="dialog" aria-label={t('Choose a family member')} style={{ ...themeStyle, position: 'fixed', top: position.top, insetInlineStart: position.inlineStart, width: position.width, maxHeight: position.maxHeight, zIndex: 10050 }}>
    {!(warnings.length > 0 && pending) && <div className="existing-relative-picker-search"><Search size={16} aria-hidden="true" /><input ref={searchRef} dir="auto" value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); setWarnings([]); setPending(null); setShowHidden(false) }} onKeyDown={handleSearchKeyDown} placeholder={t('Search family members')} aria-label={t('Search family members')} /><button type="button" onClick={onClose} aria-label={t('Close')}><X size={15} /></button></div>}
    {warnings.length > 0 && pending ? <div className="existing-relative-confirm" role="alert">
      <div className="existing-relative-confirm-person"><FamilyAvatar member={pending} compact decorative /><span className="existing-relative-picker-copy"><PersonName name={getDisambiguatedFullName(pending, members)} />{renderPersonAge(pending, language, t) && <small><bdi dir="auto">{renderPersonAge(pending, language, t)}</bdi></small>}</span></div>
      <div className="existing-relative-confirm-warning"><TriangleAlert size={18} aria-hidden="true" /><div>{warnings.map((issue, index) => <p key={`${issue.messageKey}-${index}`}><ValidationMessage issue={issue} members={members} /></p>)}</div></div>
      <div className="existing-relative-confirm-actions"><button type="button" onClick={chooseSomeoneElse}>{t('Choose someone else')}</button><button type="button" className="warning-action-button" onClick={continueWithPending}>{t('Continue anyway')}</button></div>
    </div> : needsParentFirst ? <div className="existing-relative-picker-empty"><span>{t('Add a parent first')}</span><button type="button" onClick={() => { setKind('parent'); setQuery(''); setActiveIndex(-1) }}><UserRoundPlus size={15} />{t('Add parent')}</button></div> : alreadyHasTwoParents ? <div className="existing-relative-picker-empty"><span>{t('Already has two parents')}</span></div> : <div className="existing-relative-picker-list" role="listbox" aria-label={t('Choose a family member')}>
      {visible.map(({ person, issues, warningKey }, index) => {
        const age = getMemberAge(person.birthDate, isMemberDeceased(person) ? person.deathDate : undefined)
        const ageText = person.deathDate ? `${person.birthDate?.slice(0, 4) ?? '\u2014'} \u2013 ${person.deathDate.slice(0, 4)}` : age ? formatPickerAge(age.count, age.unit, language, t) : person.birthDate?.slice(0, 4)
        const noteKey = warningKey ?? entryNote(issues)
        return <button type="button" role="option" aria-selected={activeIndex === index} className="existing-relative-picker-option" key={person.id} onPointerEnter={() => setActiveIndex(index)} onClick={() => choose(person)}><FamilyAvatar member={person} compact decorative /><span className="existing-relative-picker-copy"><PersonName name={getDisambiguatedFullName(person, members)} />{ageText && <small><bdi dir="auto">{ageText}</bdi></small>}{noteKey && <small className="existing-relative-picker-note">{t(noteKey)}</small>}</span></button>
      })}
      {!visible.length && <p className="existing-relative-picker-no-results">{t(hidden.length ? 'No one fits here' : query ? 'No one found' : 'No one fits here')}</p>}
      {hidden.length > 0 && (!visible.length || Boolean(query.trim())) && <button type="button" className="existing-relative-picker-hidden-toggle" aria-expanded={showHidden} onClick={() => setShowHidden((value) => !value)}>{hiddenLabel[0]}<bdi dir="ltr">{hidden.length}</bdi>{hiddenLabel[1]}</button>}
      {showHidden && hidden.map(({ person, reasonKey }) => <div className="existing-relative-picker-option is-invalid" aria-disabled="true" key={`hidden-${person.id}`}><FamilyAvatar member={person} compact decorative /><span className="existing-relative-picker-copy"><PersonName name={getDisambiguatedFullName(person, members)} />{person.birthDate && <small><bdi dir="ltr">{person.birthDate.slice(0, 4)}</bdi></small>}<small className="existing-relative-picker-reason">{t(reasonKey ?? 'Already linked')}</small></span></div>)}
    </div>}
    {!needsParentFirst && !pending && <button type="button" className="existing-relative-picker-create" disabled={alreadyHasTwoParents} onClick={() => onCreateNew(source.id, kind)}><UserRoundPlus size={16} />{t('Create new person')}</button>}
  </div>
  return createPortal(content, document.body)
}

function entryNote(issues: ValidationIssue[]) {
  const warning = issues.find((issue) => issue.type === 'warning')
  if (!warning) return undefined
  if (warning.messageKey.startsWith('Mother age at birth:')) return 'Mother over 55 at birth'
  if (warning.messageKey.startsWith('Father age at birth:')) return 'Father over 80 at birth'
  if (warning.messageKey.includes('less than')) return 'Small age gap'
  if (warning.messageKey.startsWith('Born in ')) return 'Unusually old'
  if (warning.messageKey.includes('is not marked')) return 'Gender does not match'
  return 'Unlikely relationship'
}

function renderPersonAge(person: FamilyMember, language: string, t: (message: string, values?: Record<string, string | number>) => string) {
  const age = getMemberAge(person.birthDate, isMemberDeceased(person) ? person.deathDate : undefined)
  if (person.deathDate) return `${person.birthDate?.slice(0, 4) ?? '\u2014'} \u2013 ${person.deathDate.slice(0, 4)}`
  if (age) return formatPickerAge(age.count, age.unit, language, t)
  return person.birthDate?.slice(0, 4)
}

function formatPickerAge(count: number, unit: 'years' | 'months' | 'days', language: string, t: (message: string, values?: Record<string, string | number>) => string) {
  const category = new Intl.PluralRules(language).select(count)
  const message = t(`Age ${unit} ${category}`, { count: '__COUNT__' })
  return message.includes('__COUNT__') ? message.replace('__COUNT__', String(count)) : message
}
