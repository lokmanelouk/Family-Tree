import { ArrowLeft, Baby, ChevronDown, ChevronRight, GitBranch, HeartHandshake, Pencil, Plus, Trash2, UsersRound, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
import { getRelationshipActionAvailability } from '../../lib/person-actions'
import { getVisibleRelatives, isRelationshipSectionCollapsed, popDetailsNavigation, pushDetailsNavigation } from '../../lib/details-panel'
import { formatFamilyDate } from '../../lib/display-date'

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
  const parents = findMembers(members, member.parentIds)
  const partners = findMembers(members, member.spouseIds)
  const siblings = findMembers(members, member.siblingIds)
  const children = members.filter((entry) => entry.parentIds.includes(member.id))
  const [photoError, setPhotoError] = useState('')
  const [collapsedByMember, setCollapsedByMember] = useState<Map<string, Map<string, boolean>>>(() => new Map())
  const [navigationHistory, setNavigationHistory] = useState<string[]>([])
  const [activePicker, setActivePicker] = useState<{ kind: Extract<RelationshipKind, 'child' | 'parent' | 'partner' | 'sibling'>; anchor: HTMLButtonElement } | null>(null)
  const expectedNavigationId = useRef<string | null>(null)
  const detailsBranchColor = getRootBranchMap(members).get(member.id)
  const deceased = isMemberDeceased(member)
  const age = getMemberAge(member.birthDate, member.deathDate)
  const ageAtDeath = deceased && member.birthDate && member.deathDate ? age : null

  useEffect(() => {
    if (expectedNavigationId.current === member.id) {
      expectedNavigationId.current = null
      return
    }
    expectedNavigationId.current = null
    setNavigationHistory([])
  }, [member.id])

  const isSectionCollapsed = (kind: string, count: number) =>
    isRelationshipSectionCollapsed(kind, count, collapsedByMember.get(member.id)?.get(kind))

  const toggleSection = (kind: string, count: number) => {
    const collapsed = isSectionCollapsed(kind, count)
    setCollapsedByMember((current) => {
      const next = new Map(current)
      const personSections = new Map(next.get(member.id) ?? [])
      personSections.set(kind, !collapsed)
      next.set(member.id, personSections)
      return next
    })
    setActivePicker(null)
  }

  const selectRelative = (person: FamilyMember) => {
    expectedNavigationId.current = person.id
    setNavigationHistory((current) => pushDetailsNavigation(current, member.id))
    onSelectRelative(person)
  }

  const goBack = () => {
    const previous = popDetailsNavigation(navigationHistory)
    const person = previous.personId ? members.find((entry) => entry.id === previous.personId) : undefined
    if (!person) {
      setNavigationHistory(previous.history)
      return
    }
    expectedNavigationId.current = person.id
    setNavigationHistory(previous.history)
    onSelectRelative(person)
  }

  const togglePicker = (kind: Extract<RelationshipKind, 'child' | 'parent' | 'partner' | 'sibling'>, anchor: HTMLButtonElement) => {
    setActivePicker((current) => current?.kind === kind ? null : { kind, anchor })
  }

  const relationshipPicker = (kind: Extract<RelationshipKind, 'child' | 'parent' | 'partner' | 'sibling'>) => activePicker?.kind === kind ? <ExistingRelativePicker key={kind} source={member} members={members} kind={kind} anchor={activePicker.anchor} onPick={(person, selectedKind) => { onLinkRelative(member.id, person.id, selectedKind); setActivePicker(null) }} onCreateNew={(sourceId, selectedKind) => { onAddRelative(sourceId, selectedKind); setActivePicker(null) }} onClose={() => setActivePicker(null)} /> : null

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  return (
    <aside className="details-panel">
      <div className="details-top">
        {navigationHistory.length > 0 && <button type="button" className="details-back-action" title={t('Back')} aria-label={t('Back')} onClick={goBack}><ArrowLeft size={15} aria-hidden="true" /></button>}
        <span>{t('PERSON DETAILS')}</span>
        <div className="details-top-actions">
          <>
          <button type="button" title={t('Edit person details')} aria-label={t('Edit person details')} onClick={onEdit}><Pencil size={16} /></button>
          <button type="button" className="details-delete-action" title={t('Delete family member')} aria-label={t('Delete family member')} onClick={onDelete}><Trash2 size={16} /></button>
          </>
          <button type="button" title={t('Close details')} aria-label={t('Close details')} onClick={onClose}><X size={17} /></button>
        </div>
      </div>
      <div className="details-scroll-body" key={member.id}>
        <div className={`details-profile${deceased ? ' is-deceased' : ''}`} style={detailsBranchColor ? { '--details-ring': detailsBranchColor } as CSSProperties : undefined}>
          <div className="details-portrait"><ProfileAvatarPicker avatarId={avatarPresets.find((preset) => sameAvatar(preset.avatar, member.avatar))?.id ?? 'custom'} avatar={member.avatar} photo={member.photo ?? ''} error={photoError} onChange={(avatarId, photo) => { const avatar = avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? member.avatar; onUpdateProfile(member.id, photo || undefined, avatar); setPhotoError('') }} onError={setPhotoError} /></div>
          <div className="details-profile-copy">
            <h2><PersonName name={getFullName(member)} /></h2>
            {member.gender && <span className={`details-gender-chip gender-${member.gender}`}>{t(member.gender === 'male' ? 'Male' : 'Female')}</span>}
            {getParentageKey(member.gender, parents.length) && <p className="details-parentage">{renderParentage(t(getParentageKey(member.gender, parents.length)!), parents.slice(0, 2))}</p>}
            <div className="details-summary-line">
              {deceased ? <>
                {member.deathDate && member.birthDate && <span>{formatLifeSpan(member.birthDate, member.deathDate, language)}</span>}
                {member.deathDate && !member.birthDate && <span>{t('Died')} <bdi dir="auto">{formatFamilyDate(member.deathDate, language)}</bdi></span>}
                {ageAtDeath && <><span className="details-summary-divider" aria-hidden="true" /><span>{formatDeathAge(ageAtDeath, language, t)}</span></>}
                {!member.deathDate && member.birthDate && <span>{t('Born')} <bdi dir="auto">{formatFamilyDate(member.birthDate, language)}</bdi></span>}
                {!member.deathDate && <><span className="details-summary-divider" aria-hidden="true" /><span>{t('Deceased')}</span></>}
              </> : member.birthDate && <>
                <span>{t('Born')} <bdi dir="auto">{formatFamilyDate(member.birthDate, language)}</bdi></span>
                {age && <><span className="details-summary-divider" aria-hidden="true" /><span>{formatAge(age, language, t)}</span></>}
              </>}
            </div>
            {member.bio && <p className="details-bio">{member.bio}</p>}
          </div>
        </div>
        <div className="details-links">
          <RelationshipGroup key={`${member.id}-partners`} t={t} memberId={member.id} kind="partners" icon={<HeartHandshake size={15} />} title={t('Partners')} people={partners} collapsed={isSectionCollapsed('partners', partners.length)} onToggle={() => toggleSection('partners', partners.length)} onSelect={selectRelative} picker={relationshipPicker('partner')} action={<RelativePickerAction source={member} members={members} kind="partner" label={t('Link')} active={activePicker?.kind === 'partner'} onToggle={togglePicker} />} />
          <RelationshipGroup key={`${member.id}-children`} t={t} memberId={member.id} kind="children" icon={<Baby size={15} />} title={t('Children')} people={children} collapsed={isSectionCollapsed('children', children.length)} onToggle={() => toggleSection('children', children.length)} onSelect={selectRelative} picker={relationshipPicker('child')} action={<RelativePickerAction source={member} members={members} kind="child" label={t('Add child')} active={activePicker?.kind === 'child'} onToggle={togglePicker} />} />
          <RelationshipGroup key={`${member.id}-parents`} t={t} memberId={member.id} kind="parents" icon={<GitBranch size={15} />} title={t('Parents')} people={parents} collapsed={isSectionCollapsed('parents', parents.length)} onToggle={() => toggleSection('parents', parents.length)} onSelect={selectRelative} picker={relationshipPicker('parent')} action={<RelativePickerAction source={member} members={members} kind="parent" label={t('Add parent')} active={activePicker?.kind === 'parent'} onToggle={togglePicker} />} />
          <RelationshipGroup key={`${member.id}-siblings`} t={t} memberId={member.id} kind="siblings" icon={<UsersRound size={15} />} title={t('Siblings')} people={siblings} collapsed={isSectionCollapsed('siblings', siblings.length)} onToggle={() => toggleSection('siblings', siblings.length)} onSelect={selectRelative} picker={relationshipPicker('sibling')} action={<RelativePickerAction source={member} members={members} kind="sibling" label={t('Add sibling')} active={activePicker?.kind === 'sibling'} onToggle={togglePicker} />} />
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

function formatLifeSpan(birthDate: string | undefined, deathDate: string, language: Language): ReactNode {
  const born = formatFamilyDate(birthDate, language)
  const died = formatFamilyDate(deathDate, language)
  if (!died) return null
  return <bdi dir="auto">{born ?? '\u2014'} {'\u2013'} {died}</bdi>
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

function RelationshipGroup({ t, memberId, icon, title, people, collapsed, onToggle, kind, action, picker, onSelect }: { t: (message: string, values?: Record<string, string | number>) => string; memberId: string; icon: ReactNode; title: string; people: FamilyMember[]; collapsed: boolean; onToggle: () => void; kind: string; action?: ReactNode; picker?: ReactNode; onSelect: (member: FamilyMember) => void }) {
  const [showAll, setShowAll] = useState(false)
  const visiblePeople = getVisibleRelatives(people, showAll)
  const listId = `relationship-list-${memberId}-${kind}`
  return (
    <section className={`relationship-group relationship-group-${kind}`}>
      <div className="relationship-group-heading">
        <button type="button" className="relationship-group-toggle" aria-expanded={!collapsed} aria-controls={listId} onClick={onToggle}>
          <span className="relationship-group-icon">{icon}</span>
          <span>{title}</span>
          <span className="relationship-group-count" aria-hidden="true"><bdi>{people.length}</bdi></span>
          {collapsed ? <ChevronRight className="relationship-collapse-chevron" size={15} /> : <ChevronDown size={15} />}
        </button>
        {action}
      </div>
      {(!collapsed || Boolean(picker)) && picker}
      <div className={`relationship-group-body-wrap${collapsed ? ' is-collapsed' : ''}`} aria-hidden={collapsed}>
        <div className="relationship-group-body" id={listId} inert={collapsed}>
          {people.length ? <>
            {visiblePeople.map((person) => <button type="button" className={`relationship-person-button${isMemberDeceased(person) ? ' is-deceased' : ''}`} key={person.id} title={t('Open {name}', { name: getFullName(person) })} aria-label={t('Open {name}', { name: getFullName(person) })} onClick={() => onSelect(person)}><span className={`relationship-person-avatar${person.gender ? ` gender-${person.gender}` : ''}`}><FamilyAvatar member={person} compact decorative /></span><span className="relationship-person-copy"><PersonName name={getFullName(person)} /><PersonListMetadata member={person} /></span><ChevronRight className="relationship-person-chevron" size={14} aria-hidden="true" /></button>)}
            {people.length > 5 && <button type="button" className="relationship-show-more" aria-controls={listId} aria-expanded={showAll} onClick={() => setShowAll((current) => !current)}><bdi dir="auto">{t(showAll ? 'Show less' : 'Show all {count}', { count: people.length })}</bdi></button>}
          </> : <p className={`relationship-picker-empty relationship-picker-empty-${kind}`}>{t(`No ${kind} added`)}</p>}
        </div>
      </div>
    </section>
  )
}

function RelativePickerAction({ source, members, kind, label, active, onToggle }: { source: FamilyMember; members: FamilyMember[]; kind: Extract<RelationshipKind, 'child' | 'parent' | 'partner' | 'sibling'>; label: string; active: boolean; onToggle: (kind: Extract<RelationshipKind, 'child' | 'parent' | 'partner' | 'sibling'>, anchor: HTMLButtonElement) => void }) {
  const { t } = useLanguage()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipId = useId()
  const availability = getRelationshipActionAvailability(source, members, kind)
  const disabledReason = availability.reason ? t(availability.reason) : undefined
  const disabled = Boolean(availability.disabled)
  return <span className={`relationship-link-action-wrap${disabled ? ' is-disabled' : ''}`} tabIndex={disabled ? 0 : undefined} role={disabled ? 'group' : undefined} aria-label={disabled ? `${label}: ${disabledReason}` : undefined} aria-describedby={disabled ? tooltipId : undefined}>
    <button ref={buttonRef} type="button" className="relationship-link-action" disabled={disabled} aria-label={disabled ? `${label}: ${disabledReason}` : label} aria-expanded={active} onClick={() => { if (buttonRef.current) onToggle(kind, buttonRef.current) }}><Plus size={14} />{label}</button>
    {disabled && disabledReason && <span id={tooltipId} className="relationship-badge-tooltip relationship-action-tooltip" role="tooltip">{disabledReason}</span>}
  </span>
}
