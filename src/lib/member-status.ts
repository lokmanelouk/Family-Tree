import type { FamilyMember } from '../types/family'

export function isMemberDeceased(member: Pick<FamilyMember, 'lifeStatus' | 'deathDate'>) {
  return member.lifeStatus === 'deceased' || (member.lifeStatus !== 'living' && Boolean(member.deathDate))
}
