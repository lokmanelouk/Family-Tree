import { useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { avatarPresets, defaultAvatar } from '../../data/avatar-presets'
import { findPossibleDuplicates } from '../../lib/family-search'
import { getFullName } from '../../lib/member-name'
import { useLanguage } from '../../i18n/useLanguage'
import { getBirthDateError, getDeathDateError } from '../../lib/birth-date'
import { DatePicker } from './DatePicker'
import { FamilyMemberPicker } from './FamilyMemberPicker'
import { RelationshipKindPicker } from './RelationshipKindPicker'
import { ProfileAvatarPicker } from './ProfileAvatarPicker'
import { LastNameField } from './LastNameField'
import { GenderSegmentedControl } from './GenderSegmentedControl'
import { collectValidationIssues, validateAgeLimit, validateNewPersonRelations, validatePersonDates, validateRelationshipRules, type ValidationIssue } from '../../lib/family-validation'
import { ValidationIssues, ValidationMessage } from './ValidationFeedback'

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
  const father = members.find((member) => target?.parentIds.includes(member.id) && member.gender === 'male')
  const mother = members.find((member) => target?.parentIds.includes(member.id) && member.gender === 'female')
  const mothersInFamily = father?.spouseIds.map((id) => members.find((member) => member.id === id))
    .filter((member): member is FamilyMember => Boolean(member?.gender === 'female')) ?? []
  return { fatherId: father?.id ?? '', motherId: mothersInFamily.length > 1 ? '' : mother?.id ?? mothersInFamily[0]?.id ?? '' }
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
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [firstNameTouched, setFirstNameTouched] = useState(false)
  const [photo, setPhoto] = useState('')
  const [avatarId, setAvatarId] = useState('neutral')
  const [photoError, setPhotoError] = useState('')
  const [confirmedDifferent, setConfirmedDifferent] = useState(false)
  const [targetId, setTargetId] = useState(initialTargetId ?? members[0]?.id ?? '')
  const [kind, setKind] = useState<RelationshipKind>(initialKind)
  const [gender, setGender] = useState<'male' | 'female' | null>(null)
  const [genderTouched, setGenderTouched] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([])
  const [validationWarnings, setValidationWarnings] = useState<ValidationIssue[]>([])
  const initialPerson = members.find((member) => member.id === initialTargetId)
  const [fatherId, setFatherId] = useState(() => {
    if (initialKind === 'sibling') return getSiblingParentChoices(members, initialPerson).fatherId
    return initialPerson?.gender === 'male' ? initialPerson.id : members.find((member) => initialPerson?.spouseIds.includes(member.id) && member.gender === 'male')?.id ?? ''
  })
  const [motherId, setMotherId] = useState(() => {
    if (initialKind === 'sibling') return getSiblingParentChoices(members, initialPerson).motherId
    return initialPerson?.gender === 'female' ? initialPerson.id : members.find((member) => initialPerson?.spouseIds.includes(member.id) && member.gender === 'female')?.id ?? ''
  })
  if (!isOpen) return null
  const fullName = getFullName({ name: [firstName, lastName].filter(Boolean).join(' '), firstName, lastName })
  const duplicates = findPossibleDuplicates(members, fullName, birthDate)
  const exactMatch = duplicates.some((match) => match.sameBirthDate)
  const birthDateError = getBirthDateError(birthDate)
  const deathDateError = getDeathDateError(deathDate, birthDate)
  const birthValidationErrors = validationErrors.filter((issue) => ['Enter a valid birth date.', 'Birth dates cannot be in the future.'].includes(issue.messageKey))
  const deathValidationErrors = validationErrors.filter((issue) => ['Enter a valid death date.', 'Death dates cannot be in the future.', 'Death date must be after birth date.'].includes(issue.messageKey))
  const relationshipValidationErrors = validationErrors.filter((issue) => !birthValidationErrors.includes(issue) && !deathValidationErrors.includes(issue))
  const needsParents = members.length > 0 && (kind === 'child' || kind === 'sibling')
  const selectedFather = members.find((member) => member.id === fatherId)
  const selectedMother = members.find((member) => member.id === motherId)
  const selectedTarget = members.find((member) => member.id === targetId)
  const relationshipLabel = selectedTarget ? t('Relationship to {name}', { name: '__PERSON__' }).split('__PERSON__') : null
  const targetFitsParentPair = kind === 'child'
    ? Boolean(selectedTarget && [fatherId, motherId].includes(targetId))
    : Boolean(selectedTarget && ((!fatherId && !motherId) || (fatherId && selectedTarget.parentIds.includes(fatherId)) || (motherId && selectedTarget.parentIds.includes(motherId)) || (fatherId && motherId && selectedTarget.parentIds.includes(fatherId) && members.find((person) => person.id === motherId)?.spouseIds.includes(fatherId))))
  const linkedMotherCandidates = selectedFather?.spouseIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is FamilyMember => Boolean(member?.gender === 'female')) ?? []
  const motherCandidates = linkedMotherCandidates.length ? linkedMotherCandidates : members.filter((member) => member.gender === 'female')
  const parentsValid = !needsParents || Boolean((fatherId || motherId) && fatherId !== motherId && targetFitsParentPair)
  function changeRelationshipKind(nextKind: RelationshipKind) {
    const target = members.find((member) => member.id === targetId)
    if (target && nextKind === 'sibling') {
      const choices = getSiblingParentChoices(members, target)
      setFatherId(choices.fatherId)
      setMotherId(choices.motherId)
    } else if (target && nextKind === 'child') {
      const father = target.gender === 'male' ? target : members.find((member) => target.spouseIds.includes(member.id) && member.gender === 'male')
      const mothers = father?.spouseIds.map((id) => members.find((member) => member.id === id)).filter((member): member is FamilyMember => Boolean(member?.gender === 'female')) ?? []
      setFatherId(father?.id ?? '')
      setMotherId(mothers.length === 1 ? mothers[0].id : '')
    }
    setKind(nextKind)
  }
  function changeFather(nextFatherId: string) {
    setFatherId(nextFatherId)
    const father = members.find((member) => member.id === nextFatherId)
    const wives = father?.spouseIds.map((id) => members.find((member) => member.id === id))
      .filter((member): member is FamilyMember => Boolean(member?.gender === 'female')) ?? []
    const existingMother = members.find((member) => member.id === motherId)
    if (wives.length === 1) setMotherId(wives[0].id)
    else if (wives.length > 1) setMotherId('')
    else if (!existingMother || existingMother.gender !== 'female') setMotherId('')
  }
  function performAdd() {
    const selectedAvatar = avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? defaultAvatar
    const creationTarget = needsParents ? fatherId || motherId : targetId
    onAdd(creationTarget, kind, firstName.trim(), lastName.trim(), gender ?? undefined, birthDate || undefined, photo || undefined, selectedAvatar, needsParents ? fatherId || undefined : undefined, needsParents ? motherId || undefined : undefined, lifeStatus === 'deceased' ? deathDate || undefined : undefined, lifeStatus)
    setFirstName('')
    setLastName('')
    setBirthDate('')
    setBirthDateTouched(false)
    setDeathDate('')
    setLifeStatus('living')
    setDeathDateTouched(false)
    setAttemptedSubmit(false)
    setFirstNameTouched(false)
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
    setAttemptedSubmit(true)
    const errors: ValidationIssue[] = []
    if (!firstName.trim()) return
    if (!gender) return
    if ((!targetId && members.length && !needsParents) || !parentsValid || (exactMatch && !confirmedDifferent)) return
    const candidate: FamilyMember = {
      id: 'new-person-validation', initials: '', name: fullName, firstName: firstName.trim(), lastName: lastName.trim(), relationship: '', gender,
      parentIds: needsParents ? [fatherId, motherId].filter(Boolean) : [], spouseIds: [], siblingIds: [], avatar: defaultAvatar,
      ...(birthDate ? { birthDate } : {}), ...(lifeStatus === 'deceased' && deathDate ? { deathDate } : {}), lifeStatus,
    }
    const today = new Date().toISOString().slice(0, 10)
    const outcomes = [validatePersonDates(candidate.birthDate, candidate.deathDate, today), validateAgeLimit(candidate, today)]
    if (needsParents) outcomes.push(...validateNewPersonRelations(members, candidate, selectedFather, selectedMother, today))
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
  return <div className="modal-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
      <div className="dialog-header"><div><span>{t('FAMILY TREE')}</span><h2 id="add-member-title">{t('Add a family member')}</h2></div><button title={t('Close details')} aria-label={t('Close details')} onClick={onClose}><X size={17} /></button></div>
      <form noValidate onSubmit={submit}>
        <div className="member-form-header-row">
          <div className="member-avatar-field">
            <span className="photo-upload-heading">{t('Profile photo')}</span>
          <ProfileAvatarPicker avatarId={avatarId} avatar={avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? defaultAvatar} photo={photo} error={photoError} onChange={(nextAvatarId, nextPhoto) => { setAvatarId(nextAvatarId); setPhoto(nextPhoto) }} onError={setPhotoError} />
          </div>
          <div className="member-name-field">
            <div className="member-name-fields-row">
              <div className="member-form-field"><label htmlFor="relative-first-name">{t('First name')}</label><input id="relative-first-name" autoFocus value={firstName} onChange={(event) => { setFirstName(event.target.value); setConfirmedDifferent(false) }} onBlur={() => setFirstNameTouched(true)} placeholder={t('First name')} required maxLength={60} aria-invalid={(attemptedSubmit || firstNameTouched) && !firstName.trim()} /><small className="first-name-validation" role={(attemptedSubmit || firstNameTouched) && !firstName.trim() ? 'alert' : undefined}>{(attemptedSubmit || firstNameTouched) && !firstName.trim() ? t('First name required') : ''}</small></div>
              <div className="member-form-field"><label htmlFor="relative-last-name">{t('Last name optional')}</label><LastNameField id="relative-last-name" value={lastName} members={members} onChange={(value) => { setLastName(value); setConfirmedDifferent(false) }} /></div>
            </div>
            <div onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGenderTouched(true) }}><GenderSegmentedControl value={gender} onChange={(value) => { setGender(value); setValidationErrors([]) }} label={t('Gender')} /><small className="first-name-validation" role={(genderTouched || attemptedSubmit) && !gender ? 'alert' : undefined}>{(genderTouched || attemptedSubmit) && !gender ? t('Gender is required.') : ''}</small></div>
          </div>
        </div>
        <div className="member-form-details-row">
          <div className="member-form-field">
            <label htmlFor="relative-birth-date">{t('Birth date optional')}</label><DatePicker id="relative-birth-date" value={birthDate} showValidationError={false} onBlur={() => setBirthDateTouched(true)} onChange={(value) => { setBirthDate(value); setConfirmedDifferent(false) }} />{birthDateTouched && !attemptedSubmit && birthDateError && <small className="custom-date-error" role="alert">{t(birthDateError)}</small>}{birthValidationErrors.map((issue, index) => <small className="custom-date-error" role="alert" key={`${issue.messageKey}-${index}`}><ValidationMessage issue={issue} /></small>)}
            <button type="button" role="switch" aria-checked={lifeStatus === 'deceased'} className={`member-status-switch${lifeStatus === 'deceased' ? ' is-on' : ''}`} onClick={() => setLifeStatus((current) => current === 'deceased' ? 'living' : 'deceased')}><span>{t('Deceased')}</span><span className="member-status-track" aria-hidden="true"><span><Check size={10} strokeWidth={3} /></span></span></button>
            {lifeStatus === 'deceased' && <div className="member-form-field death-date-field status-death-date-field"><label htmlFor="relative-death-date">{t('Death date optional')}</label><DatePicker id="relative-death-date" value={deathDate} initialDateHint={birthDate} label="Choose death date" autoFocus showValidationError={false} onBlur={() => setDeathDateTouched(true)} onChange={setDeathDate} />{deathDateTouched && !attemptedSubmit && deathDateError && <small className="custom-date-error" role="alert">{t(deathDateError)}</small>}{deathValidationErrors.map((issue, index) => <small className="custom-date-error" role="alert" key={`${issue.messageKey}-${index}`}><ValidationMessage issue={issue} /></small>)}</div>}
          </div>
          <div className="member-form-field">
            <label dir="auto">{relationshipLabel ? <>{relationshipLabel[0]}<bdi>{selectedTarget ? getFullName(selectedTarget) : ''}</bdi>{relationshipLabel[1]}</> : t('Relationship to')}</label>
            {members.length > 0 ? <div className="relationship-creation-fields"><RelationshipKindPicker value={kind} onChange={changeRelationshipKind} />{needsParents ? <div className="parent-choice-grid">
              <div className="parent-choice-field"><span>{t('Father')}</span><FamilyMemberPicker members={members} value={fatherId} placeholder={t('Select father')} onChange={changeFather} /></div>
              <div className="parent-choice-field"><span>{t('Mother')}</span><FamilyMemberPicker members={members} value={motherId} placeholder={t(motherCandidates.length > 1 ? 'Choose which wife is the mother' : 'Select mother')} onChange={setMotherId} /></div>
            </div> : <FamilyMemberPicker members={members} value={targetId} onChange={setTargetId} />}{needsParents && attemptedSubmit && !parentsValid && <small className="parent-choice-error">{t('Choose at least one existing parent to place this person in the tree.')}</small>}</div> : <p className="form-hint">{t('This person will start your family tree.')}</p>}
          </div>
        </div>
        {relationshipValidationErrors.map((issue, index) => <p className="edit-person-error" role="alert" key={`${issue.messageKey}-${index}`}><ValidationMessage issue={issue} /></p>)}
        <ValidationIssues issues={validationWarnings} onBack={() => setValidationWarnings([])} onContinue={() => evaluateAndAdd(undefined, true)} />
        {duplicates.length > 0 && <div className="duplicate-warning" role="status"><strong>{t(duplicates.length > 1 ? 'Possible matches' : 'Possible match')}</strong><span>{t(exactMatch ? 'A person with this name and birth date is already in the tree. Select them or verify this is another person.' : 'Someone has the same name. Compare details; people are never merged automatically.')}</span>{duplicates.map(({ person, sameBirthDate }) => <button type="button" key={person.id} onClick={() => { onSelectExisting(person); onClose() }}><span><bdi dir="auto">{getFullName(person)}</bdi></span><small>{person.birthDate ?? t('Birth date unknown')} {'\u00b7'} {person.relationship}{sameBirthDate && <> {'\u00b7'} {t('same birth date')}</>}</small></button>)}{exactMatch && <label className="duplicate-override"><input type="checkbox" checked={confirmedDifferent} onChange={(event) => setConfirmedDifferent(event.target.checked)} /> {t('I verified this is a different person')}</label>}</div>}
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>{t('Cancel')}</button><button className="primary-button" type="submit" disabled={!gender || (members.length > 0 && !needsParents && !targetId) || (exactMatch && !confirmedDifferent)}>{t('Add person')}</button></div>
      </form>
    </section>
  </div>
}
