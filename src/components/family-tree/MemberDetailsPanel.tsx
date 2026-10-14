import { Baby, Check, Ellipsis, GitBranch, HeartHandshake, Link2, Trash2, UserRoundPlus, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { avatarPresets } from '../../data/avatar-presets'
import { ProfileAvatarPicker } from './ProfileAvatarPicker'
import { useLanguage } from '../../i18n/useLanguage'
import { validateRelationship } from '../../lib/tree-logic'
import { FamilyMemberPicker } from './FamilyMemberPicker'
import { getMemberAge, type MemberAge } from '../../lib/member-age'
import type { Language } from '../../i18n/LanguageContext'

type MemberDetailsPanelProps = {
  member: FamilyMember
  members: FamilyMember[]
  onClose: () => void
  onAddRelative: (targetId: string, kind: RelationshipKind) => void
  onLinkSpouse: (memberId: string, spouseId: string) => void
  onSelectRelative: (member: FamilyMember) => void
  onUpdateProfile: (memberId: string, photo: string | undefined, avatar: FamilyMember['avatar']) => void
  onDelete: () => void
}

export function MemberDetailsPanel({ member, members, onClose, onAddRelative, onLinkSpouse, onSelectRelative, onUpdateProfile, onDelete }: MemberDetailsPanelProps) {
  const { t, language } = useLanguage()
  const [photoError, setPhotoError] = useState('')
  const [linkingSpouse, setLinkingSpouse] = useState(false)
  const [spouseCandidateId, setSpouseCandidateId] = useState('')
  const [optionsOpen, setOptionsOpen] = useState(false)
  const optionsRef = useRef<HTMLDivElement>(null)
  const parents = findMembers(members, member.parentIds)
  const partners = findMembers(members, member.spouseIds)
  const siblings = findMembers(members, member.siblingIds)
  const children = members.filter((entry) => entry.parentIds.includes(member.id))
  const ageAtDeath = member.deathDate ? getMemberAge(member.birthDate, member.deathDate) : null
  const spouseCandidates = useMemo(() => members.filter((candidate) =>
    candidate.id !== member.id && !member.spouseIds.includes(candidate.id)
    && validateRelationship(members, member.id, candidate.id, 'partner') === null,
  ), [member.id, member.spouseIds, members])

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      if (!optionsRef.current?.contains(event.target as Node)) setOptionsOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOptionsOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  return (
    <aside className="details-panel">
      <div className="details-top">
        <span>{t('PERSON DETAILS')}</span>
        <div className="details-top-actions">
          <div className="details-options-wrap" ref={optionsRef}>
            <button type="button" title={t('More options')} aria-label={t('More options')} aria-haspopup="menu" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}><Ellipsis size={18} /></button>
            {optionsOpen && <div className="details-options-menu" role="menu"><button type="button" role="menuitem" className="details-delete-option" onClick={() => { setOptionsOpen(false); onDelete() }}><Trash2 size={14} />{t('Delete family member')}</button></div>}
          </div>
          <button type="button" title={t('Close details')} aria-label={t('Close details')} onClick={onClose}><X size={17} /></button>
        </div>
      </div>
      <div className="details-scroll-body">
        <div className="details-profile">
          <div className="details-portrait"><ProfileAvatarPicker avatarId={avatarPresets.find((preset) => sameAvatar(preset.avatar, member.avatar))?.id ?? 'custom'} avatar={member.avatar} photo={member.photo ?? ''} error={photoError} onChange={(avatarId, photo) => { const avatar = avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? member.avatar; onUpdateProfile(member.id, photo || undefined, avatar); setPhotoError('') }} onError={setPhotoError} /></div>
          <h2>{member.name}</h2>
          <p className="details-relation">{t(member.relationship)}</p>
          <div className="details-dates">{formatLifeDates(member.birthDate, member.deathDate, t)}</div>
          {ageAtDeath && <div className="details-age-at-death">{formatDeathAge(ageAtDeath, language, t)}</div>}
        </div>
        <div className="details-links">
          <RelationshipGroup icon={<GitBranch size={15} />} title={t('Parents')} people={parents} empty={t('No parents linked')} onSelect={onSelectRelative} />
          <RelationshipGroup icon={<HeartHandshake size={15} />} title={t('Partners')} people={partners} empty={t('No partners linked')} onSelect={onSelectRelative} />
          <section className="link-spouse-control">
            {!linkingSpouse ? <button type="button" onClick={() => setLinkingSpouse(true)}><Link2 size={14} />{t('Link existing spouse')}</button> : <>
              {spouseCandidates.length ? <>
                <FamilyMemberPicker members={spouseCandidates} value={spouseCandidateId} placeholder={t('Select a family member')} onChange={setSpouseCandidateId} />
                <div className="link-spouse-actions">
                  <button type="button" disabled={!spouseCandidateId} onClick={() => { onLinkSpouse(member.id, spouseCandidateId); setLinkingSpouse(false); setSpouseCandidateId('') }}><Check size={14} />{t('Link spouse')}</button>
                  <button type="button" onClick={() => { setLinkingSpouse(false); setSpouseCandidateId('') }}>{t('Cancel')}</button>
                </div>
              </> : <div className="link-spouse-empty"><span>{t('No eligible family members to link')}</span><button type="button" onClick={() => setLinkingSpouse(false)}>{t('Close')}</button></div>}
            </>}
          </section>
          <RelationshipGroup icon={<UsersRound size={15} />} title={t('Siblings')} people={siblings} empty={t('No siblings linked')} onSelect={onSelectRelative} />
          <RelationshipGroup icon={<Baby size={15} />} title={t('Children')} people={children} empty={t('No children linked')} onSelect={onSelectRelative} />
        </div>
      </div>
      <section className="details-actions">
        <h3>{t('Add relative')}</h3>
        <div className="relative-action-grid">
          <button type="button" onClick={() => onAddRelative(member.id, 'parent')}><UserRoundPlus size={14} /> {t('Parent')}</button>
          <button type="button" onClick={() => onAddRelative(member.id, 'child')}><Baby size={14} /> {t('Child')}</button>
          <button type="button" onClick={() => onAddRelative(member.id, 'partner')}><HeartHandshake size={14} /> {t('Partner')}</button>
          <button type="button" onClick={() => onAddRelative(member.id, 'sibling')}><UsersRound size={14} /> {t('Sibling')}</button>
        </div>
      </section>
    </aside>
  )
}

function formatDeathAge(age: MemberAge, language: Language, t: (message: string, values?: Record<string, string | number>) => string): ReactNode {
  const category = new Intl.PluralRules(language).select(age.count)
  const message = t(`Died age ${age.unit} ${category}`, { count: '__AGE_COUNT__' })
  const [before = '', after = ''] = message.split('__AGE_COUNT__')
  return <>{before}{message.includes('__AGE_COUNT__') && <bdi dir="ltr">{age.count}</bdi>}{after}</>
}

function findMembers(members: FamilyMember[], ids: string[]) {
  return ids.map((id) => members.find((member) => member.id === id)).filter((member): member is FamilyMember => Boolean(member))
}

function sameAvatar(left: FamilyMember['avatar'], right: FamilyMember['avatar']) {
  return left.skin === right.skin && left.hair === right.hair && left.shirt === right.shirt && left.hairstyle === right.hairstyle && left.accessory === right.accessory
}

function formatLifeDates(birthDate: string | undefined, deathDate: string | undefined, t: (message: string) => string): ReactNode {
  const year = (date: string | undefined) => date?.match(/^(\d{4})/)?.[1]
  const born = year(birthDate)
  const died = year(deathDate)
  if (born && died) return <span dir="auto">{t('Born')}: <bdi dir="ltr">{born}</bdi> – {t('Died')}: <bdi dir="ltr">{died}</bdi></span>
  if (born) return <span dir="auto">{t('Born')}: <bdi dir="ltr">{born}</bdi> – {t('Present')}</span>
  if (died) return <span dir="auto">{t('Died')}: <bdi dir="ltr">{died}</bdi></span>
  return t('Birth date unknown')
}

function RelationshipGroup({ icon, title, people, empty, onSelect }: { icon: ReactNode; title: string; people: FamilyMember[]; empty: string; onSelect: (member: FamilyMember) => void }) {
  return (
    <section className="relationship-group">
      <h3>{icon}{title}</h3>
      {people.length ? people.map((person) => <button type="button" className="relationship-person-button" key={person.id} onClick={() => onSelect(person)}>{person.name}</button>) : <p>{empty}</p>}
    </section>
  )
}
