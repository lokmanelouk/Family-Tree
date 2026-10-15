import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { avatarPresets } from '../../data/avatar-presets'
import { useLanguage } from '../../i18n/useLanguage'
import { getBirthDateError, getDeathDateError } from '../../lib/birth-date'
import { DatePicker } from './DatePicker'
import { ProfileAvatarPicker } from './ProfileAvatarPicker'

type EditPersonDialogProps = {
  member: FamilyMember
  members: FamilyMember[]
  onClose: () => void
  onSave: (memberId: string, details: Pick<FamilyMember, 'name' | 'gender' | 'birthDate' | 'deathDate' | 'lifeStatus' | 'bio' | 'photo' | 'avatar'>) => void
}

export function EditPersonDialog({ member, members, onClose, onSave }: EditPersonDialogProps) {
  const { t } = useLanguage()
  const [name, setName] = useState(member.name)
  const [gender, setGender] = useState<FamilyMember['gender']>(member.gender ?? 'male')
  const [birthDate, setBirthDate] = useState(member.birthDate ?? '')
  const [deathDate, setDeathDate] = useState(member.deathDate ?? '')
  const [lifeStatus, setLifeStatus] = useState<NonNullable<FamilyMember['lifeStatus']>>(member.lifeStatus ?? (member.deathDate ? 'deceased' : 'living'))
  const [deathDateTouched, setDeathDateTouched] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [photo, setPhoto] = useState(member.photo ?? '')
  const [avatar, setAvatar] = useState(member.avatar)
  const [avatarId, setAvatarId] = useState(() => avatarPresets.find((preset) => sameAvatar(preset.avatar, member.avatar))?.id ?? 'custom')
  const [photoError, setPhotoError] = useState('')
  const [relationshipError, setRelationshipError] = useState('')
  const birthDateError = getBirthDateError(birthDate)
  const deathDateError = getDeathDateError(deathDate, birthDate)
  const editTitleParts = t('Edit {name}').split('{name}')

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttemptedSubmit(true)
    const validationMessage = validateGenderChange()
    setRelationshipError(validationMessage)
    if (!name.trim() || birthDateError || (lifeStatus === 'deceased' && deathDateError) || validationMessage) return
    onSave(member.id, { name: name.trim(), gender, birthDate: birthDate || undefined, deathDate: lifeStatus === 'deceased' ? deathDate || undefined : undefined, lifeStatus, bio: member.bio, photo: photo || undefined, avatar })
    onClose()
  }

  return <div className="modal-shade edit-person-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="member-dialog edit-person-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-person-title">
      <div className="dialog-header"><div><span>{t('PERSON DETAILS')}</span><h2 id="edit-person-title">{editTitleParts[0]}<bdi dir="auto">{member.name}</bdi>{editTitleParts[1]}</h2></div><button type="button" title={t('Cancel')} aria-label={t('Cancel')} onClick={onClose}><X size={17} /></button></div>
      <form onSubmit={submit}>
        <div className="edit-person-fields">
          <div className="member-form-header-row">
            <div className="member-avatar-field"><span className="photo-upload-heading">{t('Profile photo')}</span><ProfileAvatarPicker avatarId={avatarId} avatar={avatar} photo={photo} error={photoError} onChange={(nextAvatarId, nextPhoto) => { setAvatarId(nextAvatarId); setPhoto(nextPhoto); setAvatar(avatarPresets.find((preset) => preset.id === nextAvatarId)?.avatar ?? avatar); setPhotoError('') }} onError={setPhotoError} /></div>
            <div className="member-name-field">
              <label htmlFor="edit-person-name">{t('Name')}</label><input id="edit-person-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required autoFocus />
              <div className="gender-field"><span id="edit-person-gender-label">{t('Gender')}</span><div className="gender-options" role="radiogroup" aria-labelledby="edit-person-gender-label">
                <button type="button" role="radio" aria-checked={gender === 'male'} className={gender === 'male' ? 'selected' : ''} onClick={() => { setGender('male'); setRelationshipError('') }}>{t('Male')}</button>
                <button type="button" role="radio" aria-checked={gender === 'female'} className={gender === 'female' ? 'selected' : ''} onClick={() => { setGender('female'); setRelationshipError('') }}>{t('Female')}</button>
              </div></div>
            </div>
          </div>
          <div className="member-form-details-row">
            <div className="member-form-field"><label htmlFor="edit-person-birth-date">{t('Birth date optional')}</label><DatePicker id="edit-person-birth-date" value={birthDate} onChange={setBirthDate} />{birthDateError && <small className="custom-date-error">{t(birthDateError)}</small>}
              <div className="member-status-field"><span>{t('Status')}</span><div className="gender-options" role="radiogroup" aria-label={t('Status')}>
                <button type="button" role="radio" aria-checked={lifeStatus === 'living'} className={lifeStatus === 'living' ? 'selected' : ''} onClick={() => setLifeStatus('living')}>{t('Living')}</button>
                <button type="button" role="radio" aria-checked={lifeStatus === 'deceased'} className={lifeStatus === 'deceased' ? 'selected' : ''} onClick={() => setLifeStatus('deceased')}>{t('Deceased')}</button>
              </div></div>
              {lifeStatus === 'deceased' && <div className="member-form-field death-date-field status-death-date-field"><label htmlFor="edit-person-death-date">{t('Death date optional')}</label><DatePicker id="edit-person-death-date" value={deathDate} autoFocus showValidationError={false} onBlur={() => setDeathDateTouched(true)} onChange={setDeathDate} />{(deathDateTouched || attemptedSubmit) && deathDateError && <small className="custom-date-error" role="alert">{t(deathDateError)}</small>}</div>}
            </div>
          </div>
        </div>
        {relationshipError && <p className="edit-person-error" role="alert">{t(relationshipError)}</p>}
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>{t('Cancel')}</button><button type="submit" className="primary-button" disabled={!name.trim() || Boolean(birthDateError || (lifeStatus === 'deceased' && (deathDateTouched || attemptedSubmit) && deathDateError))}>{t('Save changes')}</button></div>
      </form>
    </section>
  </div>
}

function sameAvatar(left: FamilyMember['avatar'], right: FamilyMember['avatar']) {
  return left.skin === right.skin && left.hair === right.hair && left.shirt === right.shirt && left.hairstyle === right.hairstyle && left.accessory === right.accessory
}
