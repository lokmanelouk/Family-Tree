import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { calculateRelationship } from '../../lib/relationship-calculator'
import { getDisambiguatedFullName, getFullName } from '../../lib/member-name'
import { useLanguage } from '../../i18n/useLanguage'
import { getLayoutDirection } from '../../config/layout'
import { FamilyAvatar } from '../family-tree/FamilyAvatar'
import { PersonName } from '../family-tree/PersonName'

export function RelationshipCalculatorDialog({ members, onClose }: { members: FamilyMember[]; onClose: () => void }) {
  const { t, language } = useLanguage()
  const [firstId, setFirstId] = useState('')
  const [secondId, setSecondId] = useState('')
  const firstSelect = useRef<HTMLSelectElement>(null)
  const result = useMemo(() => firstId && secondId ? calculateRelationship(members, firstId, secondId) : null, [members, firstId, secondId])
  const first = members.find((person) => person.id === firstId)
  const second = members.find((person) => person.id === secondId)
  const pathMembers = result?.pathIds.map((id) => members.find((person) => person.id === id)).filter((person): person is FamilyMember => Boolean(person)) ?? []

  useEffect(() => {
    firstSelect.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const personOption = (person: FamilyMember) => {
    const year = person.birthDate?.match(/^\d{4}/)?.[0]
    const disambiguatedName = getDisambiguatedFullName(person, members)
    return <option key={person.id} value={person.id}>{disambiguatedName}{year && disambiguatedName === getFullName(person) ? ` (${year})` : ''}</option>
  }

  return <div className="modal-shade relationship-calculator-shade" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="relationship-calculator-dialog" role="dialog" aria-modal="true" aria-labelledby="relationship-calculator-title" lang={language} dir={getLayoutDirection(language)}>
    <header className="relationship-calculator-header"><div><span>{t('Relationship calculator')}</span><h2 id="relationship-calculator-title">{t('How are we related?')}</h2></div><button type="button" className="icon-button" aria-label={t('Close')} onClick={onClose}><X size={19} /></button></header>
    <div className="relationship-calculator-selects">
      <label><span>{t('Person A')}</span><select ref={firstSelect} value={firstId} onChange={(event) => setFirstId(event.target.value)}><option value="">{t('Select a person')}</option>{members.filter((person) => person.id !== secondId).map(personOption)}</select></label>
      <label><span>{t('Person B')}</span><select value={secondId} onChange={(event) => setSecondId(event.target.value)}><option value="">{t('Select a person')}</option>{members.filter((person) => person.id !== firstId).map(personOption)}</select></label>
    </div>
    {first && second && <div className="relationship-calculator-profiles"><div className="relationship-calculator-profile"><FamilyAvatar member={first} compact decorative /><PersonName name={getDisambiguatedFullName(first, members)} /></div><ArrowRight size={17} aria-hidden="true" /><div className="relationship-calculator-profile"><FamilyAvatar member={second} compact decorative /><PersonName name={getDisambiguatedFullName(second, members)} /></div></div>}
    {first && second && result && <div className="relationship-calculator-result"><span>{t('Their relationship')}</span><strong>{t(result.titleKey, result.values)}</strong><div className="relationship-calculator-path-label">{t('Relationship path')}</div><div className="relationship-calculator-path">{pathMembers.map((person, index) => <span className="relationship-calculator-path-part" key={person.id}><span className="relationship-calculator-path-person"><FamilyAvatar member={person} compact decorative /><PersonName name={getDisambiguatedFullName(person, members)} /></span>{index < (result.steps.length) && <span className="relationship-calculator-path-step"><span>{t(result.steps[index].kind === 'spouse' ? 'Spouse link' : result.steps[index].kind === 'sibling' ? 'Sibling link' : result.steps[index].kind === 'parent' ? 'Parent link' : 'Child link')}</span><ArrowRight size={14} aria-hidden="true" /></span>}</span>)}</div></div>}
    {first && second && !result && <p className="relationship-calculator-empty">{t('No family connection found.')}</p>}
    <footer className="relationship-calculator-footer"><button type="button" className="secondary-button" onClick={onClose}>{t('Done')}</button></footer>
  </section></div>
}
