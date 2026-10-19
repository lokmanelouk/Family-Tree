import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, X } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { avatarPresets } from '../../data/avatar-presets'
import { useLanguage } from '../../i18n/useLanguage'
import { getBirthDateError, getDeathDateError } from '../../lib/birth-date'
import { DatePicker } from './DatePicker'
import { ProfileAvatarPicker } from './ProfileAvatarPicker'
import { isMemberDeceased } from '../../lib/member-status'
import { getFullName, getNameParts } from '../../lib/member-name'
import { LastNameField } from './LastNameField'
import { GenderSegmentedControl } from './GenderSegmentedControl'
import { collectValidationIssues, validateEditedMemberRelations, type ValidationIssue } from '../../lib/family-validation'
import { ValidationNotice } from './ValidationFeedback'
import { capitalizeLatinWordStarts } from '../../lib/name-capitalization'
import { PersonName } from './PersonName'
import { DiscardChangesDialog } from '../dialogs/DiscardChangesDialog'
import { hasUnsavedChanges } from '../../lib/person-actions'

type EditPersonDialogProps = {
  member: FamilyMember
  members: FamilyMember[]
  onClose: () => void
  onSave: (memberId: string, details: Pick<FamilyMember, 'name' | 'firstName' | 'lastName' | 'gender' | 'birthDate' | 'deathDate' | 'lifeStatus' | 'bio' | 'photo' | 'avatar'>) => void
}

export function EditPersonDialog({ member, members, onClose, onSave }: EditPersonDialogProps) {
  const { t } = useLanguage()
  const initialName = getNameParts(member)
  const [firstName, setFirstName] = useState(initialName.firstName)
  const [lastName, setLastName] = useState(initialName.lastName)
  const [firstNameTouched, setFirstNameTouched] = useState(false)
  const [gender, setGender] = useState<FamilyMember['gender']>(member.gender ?? 'male')
  const [birthDate, setBirthDate] = useState(member.birthDate ?? '')
  const [birthDateTouched, setBirthDateTouched] = useState(false)
  const [deathDate, setDeathDate] = useState(member.deathDate ?? '')
  const [lifeStatus, setLifeStatus] = useState<NonNullable<FamilyMember['lifeStatus']>>(isMemberDeceased(member) ? 'deceased' : 'living')
  const [deathDateTouched, setDeathDateTouched] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [photo, setPhoto] = useState(member.photo ?? '')
  const [avatar, setAvatar] = useState(member.avatar)
  const [avatarId, setAvatarId] = useState(() => avatarPresets.find((preset) => sameAvatar(preset.avatar, member.avatar))?.id ?? 'custom')
  const [photoError, setPhotoError] = useState('')
  const [relationshipError, setRelationshipError] = useState('')
  const [validationErrors, setValidationErrors] = useState<ValidationIssue[]>([])
  const [validationWarnings, setValidationWarnings] = useState<ValidationIssue[]>([])
  const [discardOpen, setDiscardOpen] = useState(false)
  const [initialDraft] = useState(() => ({ firstName: initialName.firstName, lastName: initialName.lastName, gender: member.gender ?? 'male', birthDate: member.birthDate ?? '', deathDate: member.deathDate ?? '', lifeStatus: isMemberDeceased(member) ? 'deceased' : 'living', photo: member.photo ?? '', avatarId: avatarPresets.find((preset) => sameAvatar(preset.avatar, member.avatar))?.id ?? 'custom', avatar: member.avatar }))
  const closeDialogNow = useCallback(() => onClose(), [onClose])
  const requestClose = useCallback(() => {
    const draft = { firstName, lastName, gender, birthDate, deathDate, lifeStatus, photo, avatarId, avatar }
    if (hasUnsavedChanges(initialDraft, draft)) setDiscardOpen(true)
    else closeDialogNow()
  }, [closeDialogNow, firstName, lastName, gender, birthDate, deathDate, lifeStatus, photo, avatarId, avatar, initialDraft])
  const birthDateError = getBirthDateError(birthDate)
  const deathDateError = getDeathDateError(deathDate, birthDate)
  const birthValidationErrors = validationErrors.filter((issue) => ['Enter a valid birth date.', 'Birth dates cannot be in the future.'].includes(issue.messageKey))
  const deathValidationErrors = validationErrors.filter((issue) => ['Enter a valid death date.', 'Death dates cannot be in the future.', 'Death date must be after birth date.'].includes(issue.messageKey))
  const relationshipValidationErrors = validationErrors.filter((issue) => !birthValidationErrors.includes(issue) && !deathValidationErrors.includes(issue))
  const memberFullName = getFullName(member)
  const birthRelationIssues = relationshipValidationErrors.filter((issue) => issue.messageKey.includes('must be older') || issue.messageKey.startsWith('Both parents') || issue.messageKey === '{parent} died before {child} was born.' && issue.values.child === memberFullName)
  const deathRelationIssues = relationshipValidationErrors.filter((issue) => issue.messageKey === '{parent} died before {child} was born.' && issue.values.parent === memberFullName)
  const formRelationIssues = relationshipValidationErrors.filter((issue) => !birthRelationIssues.includes(issue) && !deathRelationIssues.includes(issue))
  const dateWarnings = validationWarnings.filter((issue) => issue.messageKey.startsWith('Born in '))
  const birthRelationWarnings = validationWarnings.filter((issue) => issue.messageKey.includes('parents are less') || issue.messageKey.includes('is less than') || issue.messageKey.startsWith('Mother age at birth:') || issue.messageKey.startsWith('Father age at birth:'))
  const genderWarnings = validationWarnings.filter((issue) => issue.messageKey.includes('is not marked'))
  const formWarnings = validationWarnings.filter((issue) => !dateWarnings.includes(issue) && !birthRelationWarnings.includes(issue) && !genderWarnings.includes(issue))
  const birthWarnings = [...(isMemberDeceased({ lifeStatus, deathDate }) && deathDate ? [] : dateWarnings), ...birthRelationWarnings]
  const deathWarnings = isMemberDeceased({ lifeStatus, deathDate }) && deathDate ? dateWarnings : []
  const birthTouchedIssue: ValidationIssue | undefined = birthDateTouched && !attemptedSubmit && birthDateError ? { type: 'error', messageKey: birthDateError, values: {} } : undefined
  const deathTouchedIssue: ValidationIssue | undefined = deathDateTouched && !attemptedSubmit && deathDateError ? { type: 'error', messageKey: deathDateError, values: {} } : undefined
  const birthFieldIssue = birthValidationErrors[0] ?? birthTouchedIssue ?? birthWarnings[0] ?? birthRelationIssues[0]
  const deathFieldIssue = deathValidationErrors[0] ?? deathTouchedIssue ?? deathWarnings[0] ?? deathRelationIssues[0]
  const editTitleParts = t('Edit {name}').split('{name}')
  const fullName = getFullName({ name: [firstName, lastName].filter(Boolean).join(' '), firstName, lastName })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (discardOpen) setDiscardOpen(false)
        else requestClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [discardOpen, requestClose])

  function validateGenderChange() {
    const partners = member.spouseIds.map((id) => members.find((person) => person.id === id)).filter((person): person is FamilyMember => Boolean(person))
    if (gender && partners.some((partner) => partner.gender === gender)) return 'This gender would conflict with a linked partner.'
    if (gender === 'female' && partners.length > 1) return 'A female family member can have only one husband.'
    const children = members.filter((person) => person.parentIds.includes(member.id))
    for (const child of children) {
      const otherParents = child.parentIds.filter((id) => id !== member.id).map((id) => members.find((person) => person.id === id)).filter((person): person is FamilyMember => Boolean(person))
      if (gender === 'male' && otherParents.some((parent) => parent.gender === 'male')) return 'A person can have only one father.'
      if (gender === 'female' && otherParents.some((parent) => parent.gender === 'female')) return 'A person can have only one mother.'
    }
    return ''
  }

  function saveChanges() {
    onSave(member.id, { name: fullName, firstName: firstName.trim(), lastName: lastName.trim(), gender, birthDate: birthDate || undefined, deathDate: lifeStatus === 'deceased' ? deathDate || undefined : undefined, lifeStatus, bio: member.bio, photo: photo || undefined, avatar })
    onClose()
  }

  function evaluate(allowWarnings = false) {
    setAttemptedSubmit(true)
    const validationMessage = validateGenderChange()
    setRelationshipError(validationMessage)
    if (!firstName.trim() || validationMessage) return
    const issues = collectValidationIssues(validateEditedMemberRelations(member, members, birthDate || undefined, lifeStatus === 'deceased' ? deathDate || undefined : undefined, new Date().toISOString().slice(0, 10)))
    const errors = issues.filter((issue) => issue.type === 'error')
    const warnings = issues.filter((issue) => issue.type === 'warning')
    setValidationErrors(errors)
    if (errors.length) return
    if (warnings.length && !allowWarnings) { setValidationWarnings(warnings); return }
    setValidationWarnings([])
    saveChanges()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    evaluate()
  }

  return <div className="modal-shade edit-person-shade">
    <section className="member-dialog edit-person-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-person-title">
      <div className="dialog-header"><div><span>{t('PERSON DETAILS')}</span><h2 id="edit-person-title">{editTitleParts[0]}<PersonName name={getFullName(member)} />{editTitleParts[1]}</h2></div><button type="button" title={t('Cancel')} aria-label={t('Cancel')} onClick={requestClose}><X size={17} /></button></div>
      <form noValidate onSubmit={submit}>
        <div className="edit-person-fields">
          <div className="member-form-header-row">
            <div className="member-avatar-field"><span className="photo-upload-heading">{t('Profile photo')}</span><ProfileAvatarPicker avatarId={avatarId} avatar={avatar} photo={photo} error={photoError} onChange={(nextAvatarId, nextPhoto) => { setAvatarId(nextAvatarId); setPhoto(nextPhoto); setAvatar(avatarPresets.find((preset) => preset.id === nextAvatarId)?.avatar ?? avatar); setPhotoError('') }} onError={setPhotoError} /></div>
            <div className="member-name-field">
              <div className="member-name-fields-row">
                <div className="member-form-field"><label htmlFor="edit-person-first-name">{t('First name')}</label><input id="edit-person-first-name" dir="auto" value={firstName} onChange={(event) => { setFirstName(event.target.value); setValidationErrors([]) }} onBlur={() => { setFirstName((value) => capitalizeLatinWordStarts(value)); setFirstNameTouched(true) }} maxLength={60} required autoFocus aria-invalid={(firstNameTouched || attemptedSubmit) && !firstName.trim()} /><small className="first-name-validation" role={(firstNameTouched || attemptedSubmit) && !firstName.trim() ? 'alert' : undefined}>{(firstNameTouched || attemptedSubmit) && !firstName.trim() ? t('First name required') : ''}</small></div>
                <div className="member-form-field"><label htmlFor="edit-person-last-name">{t('Last name optional')}</label><LastNameField id="edit-person-last-name" value={lastName} members={members} onChange={(value) => { setLastName(value); setValidationErrors([]) }} onBlur={() => setLastName((value) => capitalizeLatinWordStarts(value))} /></div>
              </div>
              <GenderSegmentedControl value={gender ?? 'male'} onChange={(value) => { setGender(value); setRelationshipError(''); setValidationWarnings([]) }} label={t('Gender')} />
              {relationshipError && <ValidationNotice issue={{ type: 'error', messageKey: relationshipError, values: {} }} members={members} />}
              {genderWarnings.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`gender-warning-${index}`} />)}
            </div>
          </div>
          <div className="member-form-details-row">
            <div className={`member-form-field${birthFieldIssue ? ` validation-field-${birthFieldIssue.type}` : ''}`}><label htmlFor="edit-person-birth-date">{t('Birth date optional')}</label><DatePicker id="edit-person-birth-date" value={birthDate} label="Choose birth date" showValidationError={false} onBlur={() => setBirthDateTouched(true)} onChange={(value) => { setBirthDate(value); setValidationErrors([]); setValidationWarnings([]) }} />{birthValidationErrors[0] && <ValidationNotice issue={birthValidationErrors[0]} members={members} />}{birthTouchedIssue && <ValidationNotice issue={birthTouchedIssue} members={members} />}{birthRelationIssues.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`birth-${issue.messageKey}-${index}`} />)}{birthWarnings.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`birth-warning-${index}`} />)}</div>
              <button type="button" role="switch" aria-checked={lifeStatus === 'deceased'} className={`member-status-switch${lifeStatus === 'deceased' ? ' is-on' : ''}`} onClick={() => setLifeStatus((current) => current === 'deceased' ? 'living' : 'deceased')}><span>{t('Deceased')}</span><span className="member-status-track" aria-hidden="true"><span><Check size={10} strokeWidth={3} /></span></span></button>
              {lifeStatus === 'deceased' && <div className={`member-form-field death-date-field status-death-date-field${deathFieldIssue ? ` validation-field-${deathFieldIssue.type}` : ''}`}><label htmlFor="edit-person-death-date">{t('Death date optional')}</label><DatePicker id="edit-person-death-date" value={deathDate} initialDateHint={birthDate} label="Choose death date" autoFocus showValidationError={false} onBlur={() => setDeathDateTouched(true)} onChange={(value) => { setDeathDate(value); setValidationErrors([]); setValidationWarnings([]) }} />{deathValidationErrors[0] && <ValidationNotice issue={deathValidationErrors[0]} members={members} />}{deathTouchedIssue && <ValidationNotice issue={deathTouchedIssue} members={members} />}{deathRelationIssues.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`death-${issue.messageKey}-${index}`} />)}{deathWarnings.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`death-warning-${index}`} />)}</div>}
          </div>
        </div>
        {formRelationIssues.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`${issue.messageKey}-${index}`} />)}
        {formWarnings.map((issue, index) => <ValidationNotice issue={issue} members={members} key={`form-warning-${index}`} />)}
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={requestClose}>{t('Cancel')}</button><button type={validationWarnings.length ? 'button' : 'submit'} className={`primary-button${validationWarnings.length ? ' warning-action-button' : ''}`} onClick={validationWarnings.length ? () => evaluate(true) : undefined} title={validationErrors.length ? t('Fix the errors above before continuing.') : undefined} disabled={Boolean(validationErrors.length)}>{t(validationWarnings.length ? 'Save anyway' : 'Save changes')}</button></div>
      </form>
    </section>
    {discardOpen && <DiscardChangesDialog onKeepEditing={() => setDiscardOpen(false)} onDiscard={closeDialogNow} />}
  </div>
}

function sameAvatar(left: FamilyMember['avatar'], right: FamilyMember['avatar']) {
  return left.skin === right.skin && left.hair === right.hair && left.shirt === right.shirt && left.hairstyle === right.hairstyle && left.accessory === right.accessory
}
