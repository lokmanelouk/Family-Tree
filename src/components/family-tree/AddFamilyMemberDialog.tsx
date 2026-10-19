import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, CircleHelp, TriangleAlert, X } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { avatarPresets, defaultAvatar } from '../../data/avatar-presets'
import { findPossibleDuplicates } from '../../lib/family-search'
import { getDisambiguatedFullName, getFullName } from '../../lib/member-name'
import { useLanguage } from '../../i18n/useLanguage'
import { getBirthDateError, getDeathDateError } from '../../lib/birth-date'
import { DatePicker } from './DatePicker'
import { FamilyMemberPicker } from './FamilyMemberPicker'
import { RelationshipKindPicker } from './RelationshipKindPicker'
import { ProfileAvatarPicker } from './ProfileAvatarPicker'
import { LastNameField } from './LastNameField'
import { GenderSegmentedControl } from './GenderSegmentedControl'
import { collectValidationIssues, validateAgeLimit, validateChildBornAfterParentDeath, validateNewPersonRelations, validateParentAge, validateParentDeath, validatePersonDates, validateRelationshipRules, type ValidationIssue } from '../../lib/family-validation'
import { ValidationNotice } from './ValidationFeedback'
import { getParentPickerOptions } from '../../lib/family-picker'
import { capitalizeLatinWordStarts } from '../../lib/name-capitalization'
import { PersonName } from './PersonName'
import { FamilyAvatar } from './FamilyAvatar'
import { getParentageKey, interpolateParentage } from '../../i18n/parentage'
import { DiscardChangesDialog } from '../dialogs/DiscardChangesDialog'
import { hasUnsavedChanges } from '../../lib/person-actions'
import type { ReactNode } from 'react'

type AddFamilyMemberDialogProps = {
  isOpen: boolean
  members: FamilyMember[]
  initialTargetId?: string
  initialKind?: RelationshipKind
  onClose: () => void
  onAdd: (targetId: string, kind: RelationshipKind, firstName: string, lastName: string, gender?: FamilyMember['gender'], birthDate?: string, photo?: string, avatar?: FamilyMember['avatar'], fatherId?: string, motherId?: string, deathDate?: string, lifeStatus?: FamilyMember['lifeStatus']) => void
  onSelectExisting: (member: FamilyMember) => void
}

function getSiblingParentChoices(members: FamilyMember[], target: FamilyMember | undefined) {
  const parents = target?.parentIds.map((id) => members.find((member) => member.id === id)).filter((member): member is FamilyMember => Boolean(member)) ?? []
  return { fatherId: parents.find((member) => member.gender === 'male')?.id ?? '', motherId: parents.find((member) => member.gender === 'female')?.id ?? '' }
}

function getChildParentChoices(target: FamilyMember | undefined, members: FamilyMember[]) {
  if (!target) return { fatherId: '', motherId: '' }
  const partners = target.spouseIds.map((id) => members.find((member) => member.id === id)).filter((member): member is FamilyMember => Boolean(member))
  if (target.gender === 'female') return { fatherId: partners.find((partner) => partner.gender === 'male')?.id ?? '', motherId: target.id }
  return { fatherId: target.id, motherId: partners.find((partner) => partner.gender === 'female')?.id ?? '' }
}

export function AddFamilyMemberDialog({ isOpen, members, initialTargetId, initialKind = 'child', onClose, onAdd, onSelectExisting }: AddFamilyMemberDialogProps) {
  const { t } = useLanguage()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthDateTouched, setBirthDateTouched] = useState(false)
  const [deathDate, setDeathDate] = useState('')
  const [lifeStatus, setLifeStatus] = useState<NonNullable<FamilyMember['lifeStatus']>>('living')
  const [deathDateTouched, setDeathDateTouched] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [photo, setPhoto] = useState('')
  const [avatarId, setAvatarId] = useState('neutral')
  const [photoError, setPhotoError] = useState('')
  const [dismissedDuplicateKey, setDismissedDuplicateKey] = useState('')
  const [targetId, setTargetId] = useState(initialTargetId ?? members[0]?.id ?? '')
  const [kind, setKind] = useState<RelationshipKind>(initialKind)
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [genderTouched, setGenderTouched] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([])
  const [validationWarnings, setValidationWarnings] = useState<ValidationIssue[]>([])
  const [discardOpen, setDiscardOpen] = useState(false)
  const startingTargetId = initialTargetId ?? members[0]?.id ?? ''
  const [initialDraft] = useState(() => ({ firstName: '', lastName: '', birthDate: '', deathDate: '', lifeStatus: 'living', photo: '', avatarId: 'neutral', targetId: startingTargetId, kind: initialKind, gender: null as 'male' | 'female' | null, fatherId: initialKind === 'sibling' ? getSiblingParentChoices(members, members.find((member) => member.id === startingTargetId)).fatherId : initialKind === 'child' ? getChildParentChoices(members.find((member) => member.id === startingTargetId), members).fatherId : '', motherId: initialKind === 'sibling' ? getSiblingParentChoices(members, members.find((member) => member.id === startingTargetId)).motherId : initialKind === 'child' ? getChildParentChoices(members.find((member) => member.id === startingTargetId), members).motherId : '' }))
  const closeDialogNow = useCallback(() => {
    setHasSubmitted(false)
    onClose()
  }, [onClose])
  const initialPerson = members.find((member) => member.id === initialTargetId)
  const [fatherId, setFatherId] = useState(() => {
    if (initialKind === 'sibling') return getSiblingParentChoices(members, initialPerson).fatherId
    if (initialKind === 'child') return getChildParentChoices(initialPerson, members).fatherId
    return ''
  })
  const [motherId, setMotherId] = useState(() => {
    if (initialKind === 'sibling') return getSiblingParentChoices(members, initialPerson).motherId
    if (initialKind === 'child') return getChildParentChoices(initialPerson, members).motherId
    return ''
  })
  const requestClose = useCallback(() => {
    const draft = { firstName, lastName, birthDate, deathDate, lifeStatus, photo, avatarId, targetId, kind, gender, fatherId, motherId }
    if (hasUnsavedChanges(initialDraft, draft)) setDiscardOpen(true)
    else closeDialogNow()
  }, [closeDialogNow, firstName, lastName, birthDate, deathDate, lifeStatus, photo, avatarId, targetId, kind, gender, fatherId, motherId, initialDraft])
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (discardOpen) setDiscardOpen(false); else requestClose() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, discardOpen, requestClose])
  if (!isOpen) return null
  const fullName = getFullName({ name: [firstName, lastName].filter(Boolean).join(' '), firstName, lastName })
  const duplicateKey = `${fullName.trim().toLocaleLowerCase()}|${birthDate.trim()}`
  const duplicateMatches = findPossibleDuplicates(members, fullName, birthDate, [fatherId, motherId].filter(Boolean))
  const duplicates = dismissedDuplicateKey === duplicateKey ? [] : duplicateMatches
  const duplicateGroups = (['strong', 'possible'] as const).map((type) => ({ type, matches: duplicates.filter((match) => match.type === type) })).filter((group) => group.matches.length > 0)
  const birthDateError = getBirthDateError(birthDate)
  const deathDateError = getDeathDateError(deathDate, birthDate)
  const birthValidationErrors = validationErrors.filter((issue) => ['Enter a valid birth date.', 'Birth dates cannot be in the future.'].includes(issue.messageKey))
  const deathValidationErrors = validationErrors.filter((issue) => ['Enter a valid death date.', 'Death dates cannot be in the future.', 'Death date must be after birth date.'].includes(issue.messageKey))
  const isParentDateIssue = (issue: ValidationIssue) => ['{parent} must be older than {child}.', 'Both parents must be older than {child}.', '{parent} is less than {years} years older than {child}.', 'Both parents are less than {years} years older than {child}.', '{parent} died before {child} was born.', 'Child was born after parent died.'].includes(issue.messageKey) || issue.messageKey.startsWith('Mother age at birth:') || issue.messageKey.startsWith('Father age at birth:')
  const relationshipValidationErrors = validationErrors.filter((issue) => !birthValidationErrors.includes(issue) && !deathValidationErrors.includes(issue) && !isParentDateIssue(issue))
  const dateWarnings = validationWarnings.filter((issue) => issue.messageKey.startsWith('Born in '))
  const relationshipWarnings = validationWarnings.filter((issue) => issue.messageKey.includes('is not marked'))
  const formWarnings = validationWarnings.filter((issue) => !dateWarnings.includes(issue) && !relationshipWarnings.includes(issue) && (!(kind === 'child' || kind === 'sibling') || !isParentDateIssue(issue)))
  const birthWarnings = lifeStatus === 'deceased' && deathDate ? [] : dateWarnings
  const deathWarnings = lifeStatus === 'deceased' && deathDate ? dateWarnings : []
  const birthTouchedIssue: ValidationIssue | undefined = birthDateTouched && !hasSubmitted && birthDateError ? { type: 'error', messageKey: birthDateError, values: {} } : undefined
  const deathTouchedIssue: ValidationIssue | undefined = deathDateTouched && !hasSubmitted && deathDateError ? { type: 'error', messageKey: deathDateError, values: {} } : undefined
  const birthFieldIssue = birthValidationErrors[0] ?? birthTouchedIssue
  const deathFieldIssue = deathValidationErrors[0] ?? deathTouchedIssue
  const birthFieldState = birthFieldIssue ?? birthWarnings[0]
  const deathFieldState = deathFieldIssue ?? deathWarnings[0]
  const needsParents = members.length > 0 && (kind === 'child' || kind === 'sibling')
  const selectedFather = members.find((member) => member.id === fatherId)
  const selectedMother = members.find((member) => member.id === motherId)
  const selectedTarget = members.find((member) => member.id === targetId)
  const relationshipLabel = selectedTarget ? t('Relationship to {name}', { name: '__PERSON__' }).split('__PERSON__') : null
  const targetFitsParentPair = kind === 'child'
    ? Boolean(selectedTarget && [fatherId, motherId].includes(targetId))
    : Boolean(selectedTarget && selectedTarget.parentIds.some((parentId) => [fatherId, motherId].includes(parentId)))
  const fatherOptions = getParentPickerOptions(members, 'male', birthDate, fatherId)
  const motherOptions = getParentPickerOptions(members, 'female', birthDate, motherId)
  const fatherCandidates = fatherOptions.members
  const motherCandidates = motherOptions.members
  const parentsValid = !needsParents || Boolean((fatherId || motherId) && fatherId !== motherId && targetFitsParentPair)
  const siblingHasNoParents = kind === 'sibling' && Boolean(selectedTarget && selectedTarget.parentIds.length === 0)
  const parentValidationChild: FamilyMember = { id: 'new-parent-validation-child', name: fullName, firstName: firstName.trim(), lastName: lastName.trim(), initials: '', relationship: '', gender: gender ?? undefined, parentIds: [fatherId, motherId].filter(Boolean), spouseIds: [], siblingIds: [], avatar: defaultAvatar, ...(birthDate ? { birthDate } : {}) }
  const showParentDateFeedback = hasSubmitted || birthDateTouched
  const fieldIssues = (parent: FamilyMember | undefined, role: 'father' | 'mother') => {
    if (!parent || !birthDate || !showParentDateFeedback) return []
    const deathIssue = validateParentDeath(parent, parentValidationChild, role)
    const outcomes = [validateParentAge(parent, parentValidationChild), deathIssue]
    if (role === 'father' && deathIssue.ok) outcomes.push(validateChildBornAfterParentDeath(parent, parentValidationChild))
    return collectValidationIssues(outcomes)
  }
  const fatherFieldIssues = fieldIssues(selectedFather, 'father')
  const motherFieldIssues = fieldIssues(selectedMother, 'mother')
  function changeRelationshipKind(nextKind: RelationshipKind) {
    setValidationErrors([])
    const target = members.find((member) => member.id === targetId)
    if (nextKind === 'sibling') {
      const choices = getSiblingParentChoices(members, target)
      setFatherId(choices.fatherId)
      setMotherId(choices.motherId)
    } else if (nextKind === 'child') {
      const choices = getChildParentChoices(target, members)
      setFatherId(choices.fatherId)
      setMotherId(choices.motherId)
    } else { setFatherId(''); setMotherId('') }
    setKind(nextKind)
  }
  function changeTarget(nextTargetId: string) {
    setTargetId(nextTargetId)
    setValidationErrors([])
    const target = members.find((member) => member.id === nextTargetId)
    const choices = kind === 'sibling' ? getSiblingParentChoices(members, target) : kind === 'child' ? getChildParentChoices(target, members) : { fatherId: '', motherId: '' }
    setFatherId(choices.fatherId)
    setMotherId(choices.motherId)
  }
  function changeFather(nextFatherId: string) {
    setFatherId(nextFatherId)
    setValidationErrors([])
  }
  function performAdd() {
    const selectedAvatar = avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? defaultAvatar
    const creationTarget = targetId
    onAdd(creationTarget, kind, firstName.trim(), lastName.trim(), gender ?? undefined, birthDate || undefined, photo || undefined, selectedAvatar, needsParents ? fatherId || undefined : undefined, needsParents ? motherId || undefined : undefined, lifeStatus === 'deceased' ? deathDate || undefined : undefined, lifeStatus)
    setFirstName('')
    setLastName('')
    setBirthDate('')
    setBirthDateTouched(false)
    setDeathDate('')
    setLifeStatus('living')
    setDeathDateTouched(false)
    setHasSubmitted(false)
    setGender(null)
    setGenderTouched(false)
    setValidationErrors([])
    setValidationWarnings([])
    setPhoto('')
    setAvatarId('neutral')
    setPhotoError('')
    onClose()
  }
  function evaluateAndAdd(event?: FormEvent<HTMLFormElement>, allowWarnings = false) {
    event?.preventDefault()
    setHasSubmitted(true)
    const errors: ValidationIssue[] = []
    if (!firstName.trim()) return
    if (!gender) return
    if ((!targetId && members.length && !needsParents) || !parentsValid) return
    const candidate: FamilyMember = {
      id: 'new-person-validation', initials: '', name: fullName, firstName: firstName.trim(), lastName: lastName.trim(), relationship: '', gender,
      parentIds: needsParents ? [fatherId, motherId].filter(Boolean) : [], spouseIds: [], siblingIds: [], avatar: defaultAvatar,
      ...(birthDate ? { birthDate } : {}), ...(lifeStatus === 'deceased' && deathDate ? { deathDate } : {}), lifeStatus,
    }
    const today = new Date().toISOString().slice(0, 10)
    const outcomes = [validatePersonDates(candidate.birthDate, candidate.deathDate, today), validateAgeLimit(candidate, today)]
    if (needsParents) {
      outcomes.push(...validateNewPersonRelations(members, candidate, selectedFather, selectedMother, today))
      if (birthDate && selectedFather && validateParentDeath(selectedFather, candidate, 'father').ok) outcomes.push(validateChildBornAfterParentDeath(selectedFather, candidate))
    }
    else if (selectedTarget) outcomes.push(...validateRelationshipRules(members, kind === 'parent' ? selectedTarget : candidate, kind === 'parent' ? candidate : selectedTarget, kind))
    const issues = collectValidationIssues(outcomes)
    errors.push(...issues.filter((issue) => issue.type === 'error'))
    const warnings = issues.filter((issue) => issue.type === 'warning')
    setValidationErrors(errors)
    if (errors.length) return
    if (warnings.length && !allowWarnings) { setValidationWarnings(warnings); return }
    setValidationWarnings([])
    performAdd()
  }
  function submit(event: FormEvent<HTMLFormElement>) { evaluateAndAdd(event) }
  return <div className="modal-shade">
    <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
      <div className="dialog-header"><div><span>{t('FAMILY TREE')}</span><h2 id="add-member-title">{t('Add a family member')}</h2></div><button title={t('Close details')} aria-label={t('Close details')} onClick={requestClose}><X size={17} /></button></div>
      <form noValidate onSubmit={submit}>
        <div className="member-form-header-row">
          <div className="member-avatar-field">
            <span className="photo-upload-heading">{t('Profile photo')}</span>
          <ProfileAvatarPicker avatarId={avatarId} avatar={avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? defaultAvatar} photo={photo} error={photoError} onChange={(nextAvatarId, nextPhoto) => { setAvatarId(nextAvatarId); setPhoto(nextPhoto) }} onError={setPhotoError} />
          </div>
          <div className="member-name-field">
            <div className="member-name-fields-row">
              <div className="member-form-field"><label htmlFor="relative-first-name">{t('First name')}</label><input id="relative-first-name" dir="auto" autoFocus value={firstName} onChange={(event) => { setFirstName(event.target.value); setDismissedDuplicateKey(''); setValidationErrors([]) }} onBlur={() => setFirstName((value) => capitalizeLatinWordStarts(value))} placeholder={t('First name')} required maxLength={60} aria-invalid={hasSubmitted && !firstName.trim()} /><small className="first-name-validation" role={hasSubmitted && !firstName.trim() ? 'alert' : undefined}>{hasSubmitted && !firstName.trim() ? t('First name required') : ''}</small></div>
              <div className="member-form-field"><label htmlFor="relative-last-name">{t('Last name optional')}</label><LastNameField id="relative-last-name" value={lastName} members={members} onChange={(value) => { setLastName(value); setDismissedDuplicateKey(''); setValidationErrors([]) }} onBlur={() => setLastName((value) => capitalizeLatinWordStarts(value))} /></div>
            </div>
            <div onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGenderTouched(true) }}><GenderSegmentedControl value={gender} onChange={(value) => { setGender(value); setValidationErrors([]) }} label={t('Gender')} /><small className="first-name-validation" role={(genderTouched || hasSubmitted) && !gender ? 'alert' : undefined}>{(genderTouched || hasSubmitted) && !gender ? t('Gender is required.') : ''}</small></div>
          </div>
        </div>
        <div className={`duplicate-matches-slot${duplicates.length ? ' has-matches' : ''}`} aria-live="polite">
          <div className="duplicate-warning-list">{duplicateGroups.map(({ type, matches }) => <section className={`duplicate-warning is-${type}-match`} key={type}>
            <div className={`duplicate-warning-message is-${type}-match`}>{type === 'strong' ? <TriangleAlert size={18} aria-hidden="true" /> : <CircleHelp size={18} aria-hidden="true" />}<span>{t(type === 'strong' ? 'Duplicate strong message' : 'Duplicate possible message')}</span></div>
            {matches.map(({ person }) => <div className="duplicate-match-row" key={person.id}>
              <div className="duplicate-match-person"><FamilyAvatar member={person} compact decorative /><PersonName name={getDisambiguatedFullName(person, members)} /></div>
              <div className="duplicate-match-summary">{renderDuplicateSummary(person, members, t)}</div>
              <div className="duplicate-match-actions"><button type="button" onClick={() => { onSelectExisting(person); onClose() }}>{t('Use this person')}</button><button type="button" onClick={() => setDismissedDuplicateKey(duplicateKey)}>{t('Add as new person')}</button></div>
            </div>)}
          </section>)}</div>
        </div>
        <div className="member-form-details-row">
          <div className={`member-form-field${birthFieldState ? ` validation-field-${birthFieldState.type}` : ''}`}>
            <label htmlFor="relative-birth-date">{t('Birth date optional')}</label><DatePicker id="relative-birth-date" value={birthDate} showValidationError={false} onBlur={() => setBirthDateTouched(true)} onChange={(value) => { setBirthDate(value); setDismissedDuplicateKey(''); setValidationErrors([]); setValidationWarnings([]) }} />{birthFieldIssue && <ValidationNotice issue={birthFieldIssue} members={members} />}{birthWarnings.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`birth-warning-${index}`} />)}
            <button type="button" role="switch" aria-checked={lifeStatus === 'deceased'} className={`member-status-switch${lifeStatus === 'deceased' ? ' is-on' : ''}`} onClick={() => setLifeStatus((current) => current === 'deceased' ? 'living' : 'deceased')}><span>{t('Deceased')}</span><span className="member-status-track" aria-hidden="true"><span><Check size={10} strokeWidth={3} /></span></span></button>
            {lifeStatus === 'deceased' && <div className={`member-form-field death-date-field status-death-date-field${deathFieldState ? ` validation-field-${deathFieldState.type}` : ''}`}><label htmlFor="relative-death-date">{t('Death date optional')}</label><DatePicker id="relative-death-date" value={deathDate} initialDateHint={birthDate} label="Choose death date" autoFocus showValidationError={false} onBlur={() => setDeathDateTouched(true)} onChange={(value) => { setDeathDate(value); setValidationErrors([]); setValidationWarnings([]) }} />{deathFieldIssue && <ValidationNotice issue={deathFieldIssue} members={members} />}{deathWarnings.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`death-warning-${index}`} />)}</div>}
          </div>
          <div className={`member-form-field${relationshipValidationErrors[0] ? ` validation-field-${relationshipValidationErrors[0].type}` : relationshipWarnings.length ? ' validation-field-warning' : ''}`}>
            <label dir="auto">{relationshipLabel ? <>{relationshipLabel[0]}<PersonName name={selectedTarget ? getFullName(selectedTarget) : ''} />{relationshipLabel[1]}</> : t('Relationship to')}</label>
            {members.length > 0 ? <div className="relationship-creation-fields"><RelationshipKindPicker value={kind} onChange={changeRelationshipKind} />{needsParents ? siblingHasNoParents ? null : <div className="parent-choice-grid">
              <ParentChoiceField label={t('Father')} candidates={fatherCandidates} value={fatherId} placeholder={t(fatherCandidates.length ? 'Select father' : 'No male in the tree')} optionNote={(member) => { const key = fatherOptions.warningKeys.get(member.id); return key ? t(key) : undefined }} fieldIssues={fatherFieldIssues} members={members} onChange={changeFather} />
              <ParentChoiceField label={t('Mother')} candidates={motherCandidates} value={motherId} placeholder={t(motherCandidates.length ? 'Select mother' : 'No female in the tree')} optionNote={(member) => { const key = motherOptions.warningKeys.get(member.id); return key ? t(key) : undefined }} fieldIssues={motherFieldIssues} members={members} onChange={(id) => { setMotherId(id); setValidationErrors([]) }} />
            </div> : <FamilyMemberPicker members={members} value={targetId} onChange={changeTarget} />}{needsParents && (siblingHasNoParents || hasSubmitted && !parentsValid) && <ValidationNotice issue={{ type: 'error', messageKey: siblingHasNoParents ? 'Add a parent first.' : 'Choose at least one existing parent to place this person in the tree.', values: {} }} members={members} />}{relationshipValidationErrors.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`${issue.messageKey}-${index}`} />)}{relationshipWarnings.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`relationship-warning-${index}`} />)}</div> : <p className="form-hint">{t('This person will start your family tree.')}</p>}
          </div>
        </div>
        {formWarnings.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`form-warning-${index}`} />)}
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={requestClose}>{t('Cancel')}</button><button className={`primary-button${validationWarnings.length ? ' warning-action-button' : ''}`} type={validationWarnings.length ? 'button' : 'submit'} onClick={validationWarnings.length ? () => evaluateAndAdd(undefined, true) : undefined} title={validationErrors.length || (hasSubmitted && !parentsValid) ? t('Fix the errors above before continuing.') : duplicates.length ? t('Review possible matches before adding this person.') : undefined} disabled={!gender || Boolean(validationErrors.length) || (hasSubmitted && !parentsValid) || (members.length > 0 && !needsParents && !targetId) || duplicates.length > 0}>{t(validationWarnings.length ? 'Add anyway' : 'Add person')}</button></div>
      </form>
    </section>
    {discardOpen && <DiscardChangesDialog onKeepEditing={() => setDiscardOpen(false)} onDiscard={closeDialogNow} />}
  </div>
}

function ParentChoiceField({ label, candidates, value, placeholder, optionNote, fieldIssues, members, onChange }: { label: string; candidates: FamilyMember[]; value: string; placeholder: string; optionNote: (member: FamilyMember) => string | undefined; fieldIssues: ValidationIssue[]; members: FamilyMember[]; onChange: (id: string) => void }) {
  return <div className={`parent-choice-field${fieldIssues.some((issue) => issue.type === 'error') ? ' validation-field-error' : fieldIssues.some((issue) => issue.type === 'warning') ? ' validation-field-warning' : ''}`}><span className="parent-choice-label">{label}</span><FamilyMemberPicker members={candidates} value={value} placeholder={placeholder} optionNote={optionNote} allowClear onChange={onChange} />{fieldIssues.map((issue, index) => <ValidationNotice key={`${issue.messageKey}-${index}`} issue={issue} members={members} />)}</div>
}

function renderDuplicateSummary(person: FamilyMember, members: FamilyMember[], t: (message: string, values?: Record<string, string | number>) => string): ReactNode {
  const parents = person.parentIds.map((id) => members.find((member) => member.id === id)).filter((parent): parent is FamilyMember => Boolean(parent))
  const parentKey = getParentageKey(person.gender, parents.length)?.replace('parentLink', 'duplicateParentLink')
  const parentText = parentKey ? interpolateParentage(t(parentKey), parents.map((parent) => getDisambiguatedFullName(parent, members))).map((part, index) => part.type === 'name' ? <PersonName key={`parent-${index}`} name={part.value} /> : part.value) : null
  const year = person.birthDate?.match(/^(\d{4})/)?.[1]
  if (person.deathDate) return <bdi dir="ltr">{year ?? '\u2014'} {'\u2013'} {person.deathDate.slice(0, 4)}</bdi>
  if (!year && !parentText) return null
  return <span className="duplicate-summary-parts">{year && <span>{t('Duplicate born label')} <bdi dir="ltr">{year}</bdi></span>}{year && parentText && <span aria-hidden="true">·</span>}{parentText && <span dir="auto">{parentText}</span>}</span>
}
