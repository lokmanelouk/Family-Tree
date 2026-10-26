import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, LocateFixed, X } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { calculateRelationship, getRelationshipPathStepLabelKey } from '../../lib/relationship-calculator'
import { getDisambiguatedFullName } from '../../lib/member-name'
import { useLanguage } from '../../i18n/useLanguage'
import { getLayoutDirection } from '../../config/layout'
import { FamilyAvatar } from '../family-tree/FamilyAvatar'
import { FamilyMemberPicker } from '../family-tree/FamilyMemberPicker'
import { PersonName } from '../family-tree/PersonName'

export function RelationshipCalculatorDialog({ members, onClose, onShowInTree }: { members: FamilyMember[]; onClose: () => void; onShowInTree: (pathIds: string[]) => void }) {
  const { t, language } = useLanguage()
  const [firstId, setFirstId] = useState('')
  const [secondId, setSecondId] = useState('')
  const result = useMemo(() => firstId && secondId ? calculateRelationship(members, firstId, secondId) : null, [members, firstId, secondId])
  const first = members.find((person) => person.id === firstId)
  const second = members.find((person) => person.id === secondId)
  const pathMembers = result?.pathIds.map((id) => members.find((person) => person.id === id)).filter((person): person is FamilyMember => Boolean(person)) ?? []

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const nameFor = (person: FamilyMember) => getDisambiguatedFullName(person, members)

  return <div className="modal-shade relationship-calculator-shade" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="relationship-calculator-dialog" role="dialog" aria-modal="true" aria-labelledby="relationship-calculator-title" lang={language} dir={getLayoutDirection(language)}>
    <header className="relationship-calculator-header"><div><span>{t('Relationship calculator')}</span><h2 id="relationship-calculator-title">{t('How are we related?')}</h2></div><button type="button" className="icon-button" aria-label={t('Close')} onClick={onClose}><X size={19} /></button></header>
    <div className="relationship-calculator-selects">
      <label><span>{t('Person A')}</span><FamilyMemberPicker members={members} value={firstId} excludeId={secondId || undefined} searchable autoFocus ariaLabel={t('Person A')} placeholder={t('Select a person')} onChange={setFirstId} /></label>
      <label><span>{t('Person B')}</span><FamilyMemberPicker members={members} value={secondId} excludeId={firstId || undefined} searchable ariaLabel={t('Person B')} placeholder={t('Select a person')} onChange={setSecondId} /></label>
    </div>
    {first && second && result && <div className="relationship-calculator-result"><span>{t('Their relationship')}</span><strong>{t(result.titleKey, result.values)}</strong><div className="relationship-calculator-path-label">{t('Relationship path')}</div><div className="relationship-calculator-path">{pathMembers.map((person, index) => <span className="relationship-calculator-path-part" key={person.id}><span className="relationship-calculator-path-person"><FamilyAvatar member={person} compact decorative /><PersonName name={nameFor(person)} /></span>{index < result.steps.length && <span className="relationship-calculator-path-step"><ArrowRight size={14} aria-hidden="true" /><span>{t(getRelationshipPathStepLabelKey(result.steps[index].kind))}</span><ArrowRight size={14} aria-hidden="true" /></span>}</span>)}</div><button type="button" className="relationship-calculator-show-tree" onClick={() => onShowInTree(result.pathIds)}><LocateFixed size={16} aria-hidden="true" />{t('Show in tree')}</button></div>}
    {first && second && !result && <p className="relationship-calculator-empty">{t('No family connection found.')}</p>}
    {!(first && second) && <p className="relationship-calculator-empty relationship-calculator-prompt">{t('Choose two different people to see their connection.')}</p>}
    {!result && <button type="button" className="relationship-calculator-show-tree" disabled><LocateFixed size={16} aria-hidden="true" />{t('Show in tree')}</button>}
    <footer className="relationship-calculator-footer"><button type="button" className="secondary-button" onClick={onClose}>{t('Done')}</button></footer>
  </section></div>
}
