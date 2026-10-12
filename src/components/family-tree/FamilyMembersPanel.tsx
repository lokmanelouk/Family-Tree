import { X } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { FamilyAvatar } from './FamilyAvatar'
import { useLanguage } from '../../i18n/useLanguage'

export function FamilyMembersPanel({ members, onSelect, onClose }: { members: FamilyMember[]; onSelect: (member: FamilyMember) => void; onClose: () => void }) {
  const { t } = useLanguage()
  return <div className="panel-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><aside className="people-panel"><div className="people-panel-heading"><div><span>{t('YOUR PEOPLE')}</span><h2>{t('Family members')}</h2></div><button aria-label={t('Close family members')} title={t('Close family members')} onClick={onClose}><X size={18} /></button></div><div className="people-list">{members.map((member) => <button key={member.id} onClick={() => onSelect(member)}><FamilyAvatar member={member} compact /><span><strong>{member.name}</strong><small>{t(member.relationship)}</small></span></button>)}</div></aside></div>
}
