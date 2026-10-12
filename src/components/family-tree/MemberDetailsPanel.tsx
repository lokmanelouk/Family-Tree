import { Baby, GitBranch, HeartHandshake, Trash2, UserRoundPlus, UsersRound, X } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { avatarPresets } from '../../data/avatar-presets'
import { ProfileAvatarPicker } from './ProfileAvatarPicker'
import { useLanguage } from '../../i18n/useLanguage'

type MemberDetailsPanelProps = {
  member: FamilyMember
  members: FamilyMember[]
  onClose: () => void
  onAddRelative: (targetId: string, kind: RelationshipKind) => void
  onSelectRelative: (member: FamilyMember) => void
  onUpdateProfile: (memberId: string, photo: string | undefined, avatar: FamilyMember['avatar']) => void
  onDelete: () => void
}

export function MemberDetailsPanel({ member, members, onClose, onAddRelative, onSelectRelative, onUpdateProfile, onDelete }: MemberDetailsPanelProps) {
  const { t } = useLanguage()
  const [photoError, setPhotoError] = useState('')
  const parents = findMembers(members, member.parentIds)
  const partners = findMembers(members, member.spouseIds)
  const siblings = findMembers(members, member.siblingIds)
  const children = members.filter((entry) => entry.parentIds.includes(member.id))

  return (
    <aside className="details-panel">
      <div className="details-top">
        <span>{t('PERSON DETAILS')}</span>
        <button title={t('Close details')} aria-label={t('Close details')} onClick={onClose}><X size={17} /></button>
      </div>
      <div className="details-portrait"><ProfileAvatarPicker avatarId={avatarPresets.find((preset) => sameAvatar(preset.avatar, member.avatar))?.id ?? 'custom'} avatar={member.avatar} photo={member.photo ?? ''} error={photoError} onChange={(avatarId, photo) => { const avatar = avatarPresets.find((preset) => preset.id === avatarId)?.avatar ?? member.avatar; onUpdateProfile(member.id, photo || undefined, avatar); setPhotoError('') }} onError={setPhotoError} /></div>
      <h2>{member.name}</h2>
      <p className="details-relation">{t(member.relationship)}</p>
      <div className="details-dates">
        {member.birthDate ?? t('Birth date unknown')}{member.deathDate ? ` — ${member.deathDate}` : ''}
      </div>

      <div className="details-links">
        <RelationshipGroup icon={<GitBranch size={15} />} title={t('Parents')} people={parents} empty={t('No parents linked')} onSelect={onSelectRelative} />
        <RelationshipGroup icon={<HeartHandshake size={15} />} title={t('Partners')} people={partners} empty={t('No partners linked')} onSelect={onSelectRelative} />
        <RelationshipGroup icon={<UsersRound size={15} />} title={t('Siblings')} people={siblings} empty={t('No siblings linked')} onSelect={onSelectRelative} />
        <RelationshipGroup icon={<Baby size={15} />} title={t('Children')} people={children} empty={t('No children linked')} onSelect={onSelectRelative} />
      </div>

      <div className="details-actions">
        <span>{t('Add relative')}</span>
        <div>
          <button onClick={() => onAddRelative(member.id, 'parent')}><UserRoundPlus size={14} /> {t('Parent')}</button>
          <button onClick={() => onAddRelative(member.id, 'child')}><Baby size={14} /> {t('Child')}</button>
          <button onClick={() => onAddRelative(member.id, 'partner')}><HeartHandshake size={14} /> {t('Partner')}</button>
          <button onClick={() => onAddRelative(member.id, 'sibling')}><UsersRound size={14} /> {t('Sibling')}</button>
        </div>
      </div>
      <button className="delete-person" onClick={onDelete}><Trash2 size={15} /> {t('Delete family member')}</button>
    </aside>
  )
}

function findMembers(members: FamilyMember[], ids: string[]) {
  return ids.map((id) => members.find((member) => member.id === id)).filter((member): member is FamilyMember => Boolean(member))
}

function sameAvatar(left: FamilyMember['avatar'], right: FamilyMember['avatar']) {
  return left.skin === right.skin && left.hair === right.hair && left.shirt === right.shirt && left.hairstyle === right.hairstyle && left.accessory === right.accessory
}

function RelationshipGroup({ icon, title, people, empty, onSelect }: { icon: ReactNode; title: string; people: FamilyMember[]; empty: string; onSelect: (member: FamilyMember) => void }) {
  return (
    <section className="relationship-group">
      <h3>{icon}{title}</h3>
      {people.length ? people.map((person) => <button type="button" className="relationship-person-button" key={person.id} onClick={() => onSelect(person)}>{person.name}</button>) : <p>{empty}</p>}
    </section>
  )
}
