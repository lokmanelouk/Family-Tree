import type { FamilyMember } from '../types/family'

export function splitName(value: string) {
  const clean = value.trim().replace(/\s+/g, ' ')
  const splitAt = clean.lastIndexOf(' ')
  return splitAt < 0
    ? { firstName: clean, lastName: '' }
    : { firstName: clean.slice(0, splitAt), lastName: clean.slice(splitAt + 1) }
}

export function getNameParts(member: Pick<FamilyMember, 'name' | 'firstName' | 'lastName'>) {
  if (member.firstName?.trim()) {
    const legacyParts = splitName(member.name)
    const lastName = member.lastName === undefined && legacyParts.firstName === member.firstName.trim()
      ? legacyParts.lastName
      : member.lastName?.trim() ?? ''
    return { firstName: member.firstName.trim(), lastName }
  }
  return splitName(member.name)
}

export function getFullName(member: Pick<FamilyMember, 'name' | 'firstName' | 'lastName'>) {
  const { firstName, lastName } = getNameParts(member)
  return [firstName, lastName].filter(Boolean).join(' ') || member.name.trim()
}

export function getDisambiguatedFullName(member: FamilyMember, members: FamilyMember[]) {
  const fullName = getFullName(member)
  const matchingMembers = members.filter((person) => normalizeNameForMatch(getFullName(person)) === normalizeNameForMatch(fullName))
  const year = member.birthDate?.match(/^\d{4}/)?.[0]
  return matchingMembers.length > 1 && year ? `${fullName} (${year})` : fullName
}

export function migrateMemberNames(members: FamilyMember[]) {
  return members.map((member) => {
    if (member.firstName?.trim() && member.lastName !== undefined) return member
    if (member.firstName?.trim()) {
      const legacyParts = splitName(member.name)
      const lastName = legacyParts.firstName === member.firstName.trim() ? legacyParts.lastName : ''
      return { ...member, lastName }
    }
    const { firstName, lastName } = splitName(member.name)
    if (member.firstName === firstName && member.lastName === lastName) return member
    return { ...member, firstName, lastName }
  })
}

export function normalizeNameForMatch(value: string) {
  return value.normalize('NFKD')
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}
