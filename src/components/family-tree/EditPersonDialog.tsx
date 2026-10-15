import { useEffect, useState, type FormEvent } from 'react'
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
import { ValidationIssues, ValidationMessage } from './ValidationFeedback'

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
  const birthDateError = getBirthDateError(birthDate)
  const deathDateError = getDeathDateError(deathDate, birthDate)
  const birthValidationErrors = validationErrors.filter((issue) => ['Enter a valid birth date.', 'Birth dates cannot be in the future.'].includes(issue.messageKey))
  const deathValidationErrors = validationErrors.filter((issue) => ['Enter a valid death date.', 'Death dates cannot be in the future.', 'Death date must be after birth date.'].includes(issue.messageKey))
  const relationshipValidationErrors = validationErrors.filter((issue) => !birthValidationErrors.includes(issue) && !deathValidationErrors.includes(issue))
  const editTitleParts = t('Edit {name}').split('{name}')
  const fullName = getFullName({ name: [firstName, lastName].filter(Boolean).join(' '), firstName, lastName })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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

  return <div className="modal-shade edit-person-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="member-dialog edit-person-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-person-title">
      <div className="dialog-header"><div><span>{t('PERSON DETAILS')}</span><h2 id="edit-person-title">{editTitleParts[0]}<bdi dir="auto">{getFullName(member)}</bdi>{editTitleParts[1]}</h2></div><button type="button" title={t('Cancel')} aria-label={t('Cancel')} onClick={onClose}><X size={17} /></button></div>
      <form noValidate onSubmit={submit}>
        <div className="edit-person-fields">
          <div className="member-form-header-row">
            <div className="member-avatar-field"><span className="photo-upload-heading">{t('Profile photo')}</span><ProfileAvatarPicker avatarId={avatarId} avatar={avatar} photo={photo} error={photoError} onChange={(nextAvatarId, nextPhoto) => { setAvatarId(nextAvatarId); setPhoto(nextPhoto); setAvatar(avatarPresets.find((preset) => preset.id === nextAvatarId)?.avatar ?? avatar); setPhotoError('') }} onError={setPhotoError} /></div>
            <div className="member-name-field">
              <div className="member-name-fields-row">
                <div className="member-form-field"><label htmlFor="edit-person-first-name">{t('First name')}</label><input id="edit-person-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} onBlur={() => setFirstNameTouched(true)} maxLength={60} required autoFocus aria-invalid={(firstNameTouched || attemptedSubmit) && !firstName.trim()} /><small className="first-name-validation" role={(firstNameTouched || attemptedSubmit) && !firstName.trim() ? 'alert' : undefined}>{(firstNameTouched || attemptedSubmit) && !firstName.trim() ? t('First name required') : ''}</small></div>
                <div className="member-form-field"><label htmlFor="edit-person-last-name">{t('Last name optional')}</label><LastNameField id="edit-person-last-name" value={lastName} members={members} onChange={setLastName} /></div>
              </div>
              <GenderSegmentedControl value={gender ?? 'male'} onChange={(value) => { setGender(value); setRelationshipError('') }} label={t('Gender')} />
            </div>
          </div>
          <div className="member-form-details-row">
            <div className="member-form-field"><label htmlFor="edit-person-birth-date">{t('Birth date optional')}</label><DatePicker id="edit-person-birth-date" value={birthDate} label="Choose birth date" showValidationError={false} onBlur={() => setBirthDateTouched(true)} onChange={setBirthDate} />{birthDateTouched && !attemptedSubmit && birthDateError && <small className="custom-date-error" role="alert">{t(birthDateError)}</small>}{birthValidationErrors.map((issue, index) => <small className="custom-date-error" role="alert" key={`${issue.messageKey}-${index}`}><ValidationMessage issue={issue} /></small>)}
              <button type="button" role="switch" aria-checked={lifeStatus === 'deceased'} className={`member-status-switch${lifeStatus === 'deceased' ? ' is-on' : ''}`} onClick={() => setLifeStatus((current) => current === 'deceased' ? 'living' : 'deceased')}><span>{t('Deceased')}</span><span className="member-status-track" aria-hidden="true"><span><Check size={10} strokeWidth={3} /></span></span></button>
              {lifeStatus === 'deceased' && <div className="member-form-field death-date-field status-death-date-field"><label htmlFor="edit-person-death-date">{t('Death date optional')}</label><DatePicker id="edit-person-death-date" value={deathDate} initialDateHint={birthDate} label="Choose death date" autoFocus showValidationError={false} onBlur={() => setDeathDateTouched(true)} onChange={setDeathDate} />{deathDateTouched && !attemptedSubmit && deathDateError && <small className="custom-date-error" role="alert">{t(deathDateError)}</small>}{deathValidationErrors.map((issue, index) => <small className="custom-date-error" role="alert" key={`${issue.messageKey}-${index}`}><ValidationMessage issue={issue} /></small>)}</div>}
            </div>
          </div>
        </div>
        {relationshipError && <p className="edit-person-error" role="alert">{t(relationshipError)}</p>}
        {relationshipValidationErrors.map((issue, index) => <p className="edit-person-error" role="alert" key={`${issue.messageKey}-${index}`}><ValidationMessage issue={issue} /></p>)}
        <ValidationIssues issues={validationWarnings} onBack={() => setValidationWarnings([])} onContinue={() => evaluate(true)} />
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>{t('Cancel')}</button><button type="submit" className="primary-button">{t('Save changes')}</button></div>
      </form>
    </section>
  </div>
}

function sameAvatar(left: FamilyMember['avatar'], right: FamilyMember['avatar']) {
  return left.skin === right.skin && left.hair === right.hair && left.shirt === right.shirt && left.hairstyle === right.hairstyle && left.accessory === right.accessory
}
