import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { avatarPresets, defaultAvatar } from '../../data/avatar-presets'
import { findPossibleDuplicates } from '../../lib/family-search'
import { useLanguage } from '../../i18n/useLanguage'
import { DatePicker } from './DatePicker'
import { FamilyMemberPicker } from './FamilyMemberPicker'
import { RelationshipKindPicker } from './RelationshipKindPicker'
import { ProfileAvatarPicker } from './ProfileAvatarPicker'

type AddFamilyMemberDialogProps = {
  isOpen: boolean
  members: FamilyMember[]
  initialTargetId?: string
  initialKind?: RelationshipKind
  onClose: () => void
  onAdd: (targetId: string, kind: RelationshipKind, name: string, birthDate?: string, photo?: string, avatar?: FamilyMember['avatar']) => void
  onSelectExisting: (member: FamilyMember) => void
}

export function AddFamilyMemberDialog({ isOpen, members, initialTargetId, initialKind = 'child', onClose, onAdd, onSelectExisting }: AddFamilyMemberDialogProps) {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [photo, setPhoto] = useState('')
  const [avatarId, setAvatarId] = useState('neutral')
  const [photoError, setPhotoError] = useState('')
  const [confirmedDifferent, setConfirmedDifferent] = useState(false)
  const [targetId, setTargetId] = useState(initialTargetId ?? members[0]?.id ?? '')
  const [kind, setKind] = useState<RelationshipKind>(initialKind)
  if (!isOpen) return null
  const duplicates = findPossibleDuplicates(members, name, birthDate)
  const exactMatch = duplicates.some((match) => match.sameBirthDate)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if ((!targetId && members.length) || !name.trim() || (exactMatch && !confirmedDifferent)) return
    const selectedAvatar = avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? defaultAvatar
    onAdd(targetId, kind, name.trim(), birthDate || undefined, photo || undefined, selectedAvatar)
    setName('')
    setBirthDate('')
    setPhoto('')
    setAvatarId('neutral')
    setPhotoError('')
    onClose()
  }
  return <div className="modal-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="member-dialog" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
      <div className="dialog-header"><div><span>{t('FAMILY TREE')}</span><h2 id="add-member-title">{t('Add a family member')}</h2></div><button title={t('Close details')} aria-label={t('Close details')} onClick={onClose}><X size={17} /></button></div>
      <form onSubmit={submit}>
        <div className="member-form-header-row">
          <div className="member-avatar-field">
            <span className="photo-upload-heading">{t('Profile photo')}</span>
          <ProfileAvatarPicker avatarId={avatarId} avatar={avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? defaultAvatar} photo={photo} error={photoError} onChange={(nextAvatarId, nextPhoto) => { setAvatarId(nextAvatarId); setPhoto(nextPhoto) }} onError={setPhotoError} />
          </div>
          <div className="member-name-field">
            <label htmlFor="relative-name">{t('Name')}</label><input id="relative-name" autoFocus value={name} onChange={(event) => { setName(event.target.value); setConfirmedDifferent(false) }} placeholder={t('Full name')} required maxLength={60} />
          </div>
        </div>
        <div className="member-form-details-row">
          <div className="member-form-field">
            <label htmlFor="relative-birth-date">{t('Birth date optional')}</label><DatePicker id="relative-birth-date" value={birthDate} onChange={(value) => { setBirthDate(value); setConfirmedDifferent(false) }} />
          </div>
          <div className="member-form-field">
            <label>{t('Relationship to')}</label>
            {members.length > 0 ? <div className="relationship-fields"><RelationshipKindPicker value={kind} onChange={setKind} /><FamilyMemberPicker members={members} value={targetId} onChange={setTargetId} /></div> : <p className="form-hint">{t('This person will start your family tree.')}</p>}
          </div>
        </div>
        {duplicates.length > 0 && <div className="duplicate-warning" role="status"><strong>{t(duplicates.length > 1 ? 'Possible matches' : 'Possible match')}</strong><span>{t(exactMatch ? 'A person with this name and birth date is already in the tree. Select them or verify this is another person.' : 'Someone has the same name. Compare details; people are never merged automatically.')}</span>{duplicates.map(({ person, sameBirthDate }) => <button type="button" key={person.id} onClick={() => { onSelectExisting(person); onClose() }}><span>{person.name}</span><small>{person.birthDate ?? t('Birth date unknown')} Â· {person.relationship}{sameBirthDate ? ` Â· ${t('same birth date')}` : ''}</small></button>)}{exactMatch && <label className="duplicate-override"><input type="checkbox" checked={confirmedDifferent} onChange={(event) => setConfirmedDifferent(event.target.checked)} /> {t('I verified this is a different person')}</label>}</div>}
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>{t('Cancel')}</button><button className="primary-button" type="submit" disabled={exactMatch && !confirmedDifferent}>{t('Add person')}</button></div>
      </form>
    </section>
  </div>
}
