import { Baby, Check, ChevronDown, ChevronRight, GitBranch, HeartHandshake, Pencil, Plus, ShieldCheck, Trash2, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { avatarPresets } from '../../data/avatar-presets'
import { ProfileAvatarPicker } from './ProfileAvatarPicker'
import { useLanguage } from '../../i18n/useLanguage'
import { validateRelationship } from '../../lib/tree-logic'
import { FamilyMemberPicker } from './FamilyMemberPicker'
import { getMemberAge, type MemberAge } from '../../lib/member-age'
import { isMemberDeceased } from '../../lib/member-status'
import { getRootBranchMap } from '../../lib/tree-layout'
import type { Language } from '../../i18n/LanguageContext'
import { getParentageKey, interpolateParentage } from '../../i18n/parentage'
import { FamilyAvatar } from './FamilyAvatar'
import { getFullName } from '../../lib/member-name'

type MemberDetailsPanelProps = {
  member: FamilyMember
  members: FamilyMember[]
  onClose: () => void
  onAddRelative: (targetId: string, kind: RelationshipKind) => void
  onLinkSpouse: (memberId: string, spouseId: string) => void
  onSelectRelative: (member: FamilyMember) => void
  onUpdateProfile: (memberId: string, photo: string | undefined, avatar: FamilyMember['avatar']) => void
  onEdit: () => void
  onDelete: () => void
}

export function MemberDetailsPanel({ member, members, onClose, onAddRelative, onLinkSpouse, onSelectRelative, onUpdateProfile, onEdit, onDelete }: MemberDetailsPanelProps) {
  const { t, language } = useLanguage()
  const [photoError, setPhotoError] = useState('')
  const [linkingSpouse, setLinkingSpouse] = useState(false)
  const [spouseCandidateId, setSpouseCandidateId] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const parents = findMembers(members, member.parentIds)
  const partners = findMembers(members, member.spouseIds)
  const siblings = findMembers(members, member.siblingIds)
  const children = members.filter((entry) => entry.parentIds.includes(member.id))
  const detailsBranchColor = getRootBranchMap(members).get(member.id)
  const deceased = isMemberDeceased(member)
  const age = getMemberAge(member.birthDate, member.deathDate)
  const ageAtDeath = deceased && member.birthDate && member.deathDate ? age : null
  const spouseCandidates = useMemo(() => members.filter((candidate) =>
    candidate.id !== member.id && !member.spouseIds.includes(candidate.id)
    && validateRelationship(members, member.id, candidate.id, 'partner') === null,
  ), [member.id, member.spouseIds, members])

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
          <button type="button" title={t('Edit person details')} aria-label={t('Edit person details')} onClick={onEdit}><Pencil size={16} /></button>
          <button type="button" className="details-delete-action" title={t('Delete family member')} aria-label={t('Delete family member')} onClick={onDelete}><Trash2 size={16} /></button>
          <button type="button" title={t('Close details')} aria-label={t('Close details')} onClick={onClose}><X size={17} /></button>
        </div>
      </div>
      <div className="details-scroll-body">
        <div className={`details-profile${deceased ? ' is-deceased' : ''}`} style={detailsBranchColor ? { '--details-ring': detailsBranchColor } as CSSProperties : undefined}>
          <div className="details-portrait"><ProfileAvatarPicker avatarId={avatarPresets.find((preset) => sameAvatar(preset.avatar, member.avatar))?.id ?? 'custom'} avatar={member.avatar} photo={member.photo ?? ''} error={photoError} onChange={(avatarId, photo) => { const avatar = avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? member.avatar; onUpdateProfile(member.id, photo || undefined, avatar); setPhotoError('') }} onError={setPhotoError} /></div>
          <div className="details-profile-copy">
            <h2><bdi dir="auto">{getFullName(member)}</bdi></h2>
            {member.gender && <span className={`details-gender-chip gender-${member.gender}`}>{t(member.gender === 'male' ? 'Male' : 'Female')}</span>}
            {getParentageKey(member.gender, parents.length) && <p className="details-parentage">{renderParentage(t(getParentageKey(member.gender, parents.length)!), parents.slice(0, 2))}</p>}
            <div className="details-summary-line">
              {deceased ? <>
                {member.deathDate && member.birthDate && <span>{formatLifeSpan(member.birthDate, member.deathDate)}</span>}
                {member.deathDate && !member.birthDate && <span>{t('Died')} <bdi dir="ltr">{member.deathDate.match(/^(\d{4})/)?.[1]}</bdi></span>}
                {ageAtDeath && <><span className="details-summary-divider" aria-hidden="true" /><span>{formatDeathAge(ageAtDeath, language, t)}</span></>}
                {!member.deathDate && member.birthDate && <span>{t('Born')} <bdi dir="ltr">{member.birthDate.slice(0, 4)}</bdi></span>}
                {!member.deathDate && <><span className="details-summary-divider" aria-hidden="true" /><span>{t('Deceased')}</span></>}
              </> : member.birthDate && <>
                <span>{t('Born')} <bdi dir="ltr">{member.birthDate.slice(0, 4)}</bdi></span>
                {age && <><span className="details-summary-divider" aria-hidden="true" /><span>{formatAge(age, language, t)}</span></>}
              </>}
            </div>
            {member.bio && <p className="details-bio">{member.bio}</p>}
          </div>
        </div>
        <div className="details-links">
          <RelationshipGroup t={t} kind="partners" icon={<HeartHandshake size={15} />} title={t('Partners')} people={partners} empty={t('Add partner')} addLabel={t('Add partner')} onAdd={() => onAddRelative(member.id, 'partner')} collapsed={collapsedSections.has('partners')} onToggle={() => toggleSection(setCollapsedSections, 'partners')} onSelect={onSelectRelative} action={!linkingSpouse ? <button type="button" className="relationship-link-action" onClick={() => setLinkingSpouse(true)}><Plus size={13} />{t('Link')}</button> : null}>
            {linkingSpouse && <div className="link-spouse-control">{spouseCandidates.length ? <><FamilyMemberPicker members={spouseCandidates} value={spouseCandidateId} placeholder={t('Select a family member')} onChange={setSpouseCandidateId} /><div className="link-spouse-actions"><button type="button" disabled={!spouseCandidateId} onClick={() => { onLinkSpouse(member.id, spouseCandidateId); setLinkingSpouse(false); setSpouseCandidateId('') }}><Check size={14} />{t('Link spouse')}</button><button type="button" onClick={() => { setLinkingSpouse(false); setSpouseCandidateId('') }}>{t('Cancel')}</button></div></> : <div className="link-spouse-empty"><span>{t('No eligible family members to link')}</span><button type="button" onClick={() => setLinkingSpouse(false)}>{t('Close')}</button></div>}</div>}
          </RelationshipGroup>
          <RelationshipGroup t={t} kind="children" icon={<Baby size={15} />} title={t('Children')} people={children} empty={t('Add child')} addLabel={t('Add child')} onAdd={() => onAddRelative(member.id, 'child')} collapsed={collapsedSections.has('children')} onToggle={() => toggleSection(setCollapsedSections, 'children')} onSelect={onSelectRelative} />
          <RelationshipGroup t={t} kind="parents" icon={<GitBranch size={15} />} title={t('Parents')} people={parents} adoptedIds={member.adoptedParentIds ?? []} adoptedLabel={t('Adoption')} empty={t('Add parent')} addLabel={t('Add parent')} onAdd={() => onAddRelative(member.id, 'parent')} collapsed={collapsedSections.has('parents')} onToggle={() => toggleSection(setCollapsedSections, 'parents')} onSelect={onSelectRelative} />
          <RelationshipGroup t={t} kind="siblings" icon={<UsersRound size={15} />} title={t('Siblings')} people={siblings} empty={t('Add sibling')} addLabel={t('Add sibling')} onAdd={() => onAddRelative(member.id, 'sibling')} collapsed={collapsedSections.has('siblings')} onToggle={() => toggleSection(setCollapsedSections, 'siblings')} onSelect={onSelectRelative} />
        </div>
      </div>
    </aside>
  )
}

function renderParentage(pattern: string, parents: FamilyMember[]): ReactNode {
  return <span dir="auto">{interpolateParentage(pattern, parents.map(getFullName)).map((part, index) => part.type === 'name' ? <bdi dir="auto" key={`parent-${index}`}>{part.value}</bdi> : part.value)}</span>
}

function renderRelativeSummary(member: FamilyMember, language: Language, t: (message: string, values?: Record<string, string | number>) => string): ReactNode {
  const age = getMemberAge(member.birthDate, isMemberDeceased(member) ? member.deathDate : undefined)
  const birthYear = member.birthDate?.match(/^(\d{4})/)?.[1]
  const deathYear = member.deathDate?.match(/^(\d{4})/)?.[1]
  if (isMemberDeceased(member)) {
    if (birthYear && deathYear) return <bdi dir="ltr">{birthYear} {'\u2013'} {deathYear}</bdi>
    if (deathYear) return <bdi dir="ltr">{deathYear}</bdi>
    if (birthYear) return <><span>{t('Born')} <bdi dir="ltr">{birthYear}</bdi></span><span className="relationship-summary-divider" />{t('Deceased')}</>
    return t('Deceased')
  }
  if (age) return formatAge(age, language, t)
  return birthYear ? <>{t('Born')} <bdi dir="ltr">{birthYear}</bdi></> : null
}

function formatAge(age: MemberAge, language: Language, t: (message: string, values?: Record<string, string | number>) => string): ReactNode {
  const category = new Intl.PluralRules(language).select(age.count)
  const message = t(`Age ${age.unit} ${category}`, { count: '__AGE_COUNT__' })
  const [before = '', after = ''] = message.split('__AGE_COUNT__')
  return <>{before}{message.includes('__AGE_COUNT__') && <bdi dir="ltr">{age.count}</bdi>}{after}</>
}

function formatLifeSpan(birthDate: string | undefined, deathDate: string): ReactNode {
  const born = birthDate?.match(/^(\d{4})/)?.[1]
  const died = deathDate.match(/^(\d{4})/)?.[1]
  if (!died) return null
  return <><bdi dir="ltr">{born ?? '\u2014'} {'\u2013'} {died}</bdi></>
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

function toggleSection(setCollapsed: (update: (current: Set<string>) => Set<string>) => void, key: string) {
  setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
}

function RelationshipGroup({ t, icon, title, people, adoptedIds = [], adoptedLabel, empty, addLabel, onAdd, collapsed, onToggle, kind, action, children, onSelect }: { t: (message: string, values?: Record<string, string | number>) => string; icon: ReactNode; title: string; people: FamilyMember[]; adoptedIds?: string[]; adoptedLabel?: string; empty: string; addLabel: string; onAdd: () => void; collapsed: boolean; onToggle: () => void; kind: string; action?: ReactNode; children?: ReactNode; onSelect: (member: FamilyMember) => void }) {
  const { language } = useLanguage()
  return (
    <section className={`relationship-group relationship-group-${kind}`}>
      <div className="relationship-group-heading">
        <button type="button" className="relationship-group-toggle" aria-expanded={!collapsed} onClick={onToggle}>
          <span className="relationship-group-icon">{icon}</span>
          <span>{title}</span>
          {collapsed ? <ChevronRight className="relationship-collapse-chevron" size={15} /> : <ChevronDown size={15} />}
        </button>
        {action}
      </div>
      {!collapsed && <div className="relationship-group-body">
        {children}
        {people.length ? people.map((person) => {
          const adopted = adoptedIds.includes(person.id)
          return <button type="button" className={`relationship-person-button${adopted ? ' is-adopted-relative' : ''}${isMemberDeceased(person) ? ' is-deceased' : ''}`} key={person.id} title={t('Open {name}', { name: getFullName(person) })} aria-label={t('Open {name}', { name: getFullName(person) })} onClick={() => onSelect(person)}>{adopted && <span className="adopted-relative-indicator" role="img" aria-label={adoptedLabel} title={adoptedLabel}><ShieldCheck size={13} /></span>}<span className={`relationship-person-avatar${person.gender ? ` gender-${person.gender}` : ''}`}><FamilyAvatar member={person} compact decorative /></span><span className="relationship-person-copy"><bdi dir="auto">{getFullName(person)}</bdi><small>{renderRelativeSummary(person, language, t)}</small></span><ChevronRight className="relationship-person-chevron" size={14} aria-hidden="true" /></button>
        }) : <button type="button" className="relationship-empty-action" onClick={onAdd}><Plus size={13} />{empty}</button>}
        {people.length > 0 && <button type="button" className="relationship-add-action" onClick={onAdd}><Plus size={13} />{addLabel}</button>}
      </div>}
    </section>
  )
}
