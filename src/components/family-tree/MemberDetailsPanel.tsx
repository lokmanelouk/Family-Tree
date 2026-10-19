import { Baby, ChevronDown, ChevronRight, GitBranch, HeartHandshake, Pencil, Plus, Trash2, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { avatarPresets } from '../../data/avatar-presets'
import { ProfileAvatarPicker } from './ProfileAvatarPicker'
import { useLanguage } from '../../i18n/useLanguage'
import { getMemberAge, type MemberAge } from '../../lib/member-age'
import { isMemberDeceased } from '../../lib/member-status'
import { getRootBranchMap } from '../../lib/tree-layout'
import type { Language } from '../../i18n/LanguageContext'
import { getParentageKey, interpolateParentage } from '../../i18n/parentage'
import { FamilyAvatar } from './FamilyAvatar'
import { getFullName } from '../../lib/member-name'
import { ExistingRelativePicker } from './ExistingRelativePicker'
import { PersonName } from './PersonName'
import { PersonListMetadata } from './PersonListMetadata'

type MemberDetailsPanelProps = {
  member: FamilyMember
  members: FamilyMember[]
  onClose: () => void
  onAddRelative: (targetId: string, kind: RelationshipKind) => void
  onLinkRelative: (memberId: string, relativeId: string, kind: RelationshipKind) => void
  onSelectRelative: (member: FamilyMember) => void
  onUpdateProfile: (memberId: string, photo: string | undefined, avatar: FamilyMember['avatar']) => void
  onEdit: () => void
  onDelete: () => void
}

export function MemberDetailsPanel({ member, members, onClose, onAddRelative, onLinkRelative, onSelectRelative, onUpdateProfile, onEdit, onDelete }: MemberDetailsPanelProps) {
  const { t, language } = useLanguage()
  const [photoError, setPhotoError] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const parents = findMembers(members, member.parentIds)
  const partners = findMembers(members, member.spouseIds)
  const siblings = findMembers(members, member.siblingIds)
  const children = members.filter((entry) => entry.parentIds.includes(member.id))
  const detailsBranchColor = getRootBranchMap(members).get(member.id)
  const deceased = isMemberDeceased(member)
  const age = getMemberAge(member.birthDate, member.deathDate)
  const ageAtDeath = deceased && member.birthDate && member.deathDate ? age : null

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
            <h2><PersonName name={getFullName(member)} /></h2>
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
          <RelationshipGroup t={t} kind="partners" icon={<HeartHandshake size={15} />} title={t('Partners')} people={partners} collapsed={collapsedSections.has('partners')} onToggle={() => toggleSection(setCollapsedSections, 'partners')} onSelect={onSelectRelative} action={<RelativePickerAction source={member} members={members} kind="partner" label={t('Link')} onPick={onLinkRelative} onCreateNew={onAddRelative} />} />
          <RelationshipGroup t={t} kind="children" icon={<Baby size={15} />} title={t('Children')} people={children} collapsed={collapsedSections.has('children')} onToggle={() => toggleSection(setCollapsedSections, 'children')} onSelect={onSelectRelative} action={<RelativePickerAction source={member} members={members} kind="child" label={t('Add child')} onPick={onLinkRelative} onCreateNew={onAddRelative} />} />
          <RelationshipGroup t={t} kind="parents" icon={<GitBranch size={15} />} title={t('Parents')} people={parents} collapsed={collapsedSections.has('parents')} onToggle={() => toggleSection(setCollapsedSections, 'parents')} onSelect={onSelectRelative} action={<RelativePickerAction source={member} members={members} kind="parent" label={t('Add parent')} disabled={member.parentIds.length >= 2} onPick={onLinkRelative} onCreateNew={onAddRelative} />} />
          <RelationshipGroup t={t} kind="siblings" icon={<UsersRound size={15} />} title={t('Siblings')} people={siblings} collapsed={collapsedSections.has('siblings')} onToggle={() => toggleSection(setCollapsedSections, 'siblings')} onSelect={onSelectRelative} action={<RelativePickerAction source={member} members={members} kind="sibling" label={t('Add sibling')} disabled={member.parentIds.length === 0} disabledReason={t('Add a parent first')} onPick={onLinkRelative} onCreateNew={onAddRelative} />} />
        </div>
      </div>
    </aside>
  )
}

function renderParentage(pattern: string, parents: FamilyMember[]): ReactNode {
  return <span dir="auto">{interpolateParentage(pattern, parents.map(getFullName)).map((part, index) => part.type === 'name' ? <PersonName key={`parent-${index}`} name={part.value} /> : part.value)}</span>
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

function RelationshipGroup({ t, icon, title, people, collapsed, onToggle, kind, action, onSelect }: { t: (message: string, values?: Record<string, string | number>) => string; icon: ReactNode; title: string; people: FamilyMember[]; collapsed: boolean; onToggle: () => void; kind: string; action?: ReactNode; onSelect: (member: FamilyMember) => void }) {
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
        {people.length ? people.map((person) => <button type="button" className={`relationship-person-button${isMemberDeceased(person) ? ' is-deceased' : ''}`} key={person.id} title={t('Open {name}', { name: getFullName(person) })} aria-label={t('Open {name}', { name: getFullName(person) })} onClick={() => onSelect(person)}><span className={`relationship-person-avatar${person.gender ? ` gender-${person.gender}` : ''}`}><FamilyAvatar member={person} compact decorative /></span><span className="relationship-person-copy"><PersonName name={getFullName(person)} /><PersonListMetadata member={person} /></span><ChevronRight className="relationship-person-chevron" size={14} aria-hidden="true" /></button>) : <p className="relationship-picker-empty">{t('No linked family members yet.')}</p>}
      </div>}
    </section>
  )
}

function RelativePickerAction({ source, members, kind, label, disabled = false, disabledReason, onPick, onCreateNew }: { source: FamilyMember; members: FamilyMember[]; kind: RelationshipKind; label: string; disabled?: boolean; disabledReason?: string; onPick: (sourceId: string, relativeId: string, kind: RelationshipKind) => void; onCreateNew: (sourceId: string, kind: RelationshipKind) => void }) {
  const { t } = useLanguage()
  const [pickerAnchor, setPickerAnchor] = useState<HTMLButtonElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setPickerAnchor(null), [])
  return <>
    <span className="relationship-link-action-wrap" title={disabled ? disabledReason ?? t('Already has two parents') : undefined}><button ref={buttonRef} type="button" className="relationship-link-action" disabled={disabled} aria-label={disabled ? `${label}: ${disabledReason ?? t('Already has two parents')}` : label} aria-expanded={Boolean(pickerAnchor)} onClick={() => setPickerAnchor((current) => current ? null : buttonRef.current)}><Plus size={13} />{label}</button></span>
    {pickerAnchor && <ExistingRelativePicker source={source} members={members} kind={kind} anchor={pickerAnchor} onPick={(person, selectedKind) => { onPick(source.id, person.id, selectedKind); close() }} onCreateNew={(sourceId, selectedKind) => { onCreateNew(sourceId, selectedKind); close() }} onClose={close} />}
  </>
}
