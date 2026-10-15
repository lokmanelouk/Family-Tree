import type { FamilyMember } from '../../types/family'
import { AvatarIllustration } from './AvatarIllustration'

export function FamilyAvatar({ member, compact = false, decorative = false }: { member: FamilyMember; compact?: boolean; decorative?: boolean }) {
  if (member.photo) return <img className={`family-avatar-art family-avatar-photo ${compact ? 'compact' : ''}`} src={member.photo} alt={decorative ? '' : member.name} />
  return <AvatarIllustration avatar={member.avatar} name={member.name} compact={compact} decorative={decorative} />
}
