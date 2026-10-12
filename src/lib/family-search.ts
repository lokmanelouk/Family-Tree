import type { FamilyMember } from '../types/family'

export function findPossibleDuplicates(members: FamilyMember[], name: string, birthDate?: string) {
  const normalized = normalize(name)
  if (!normalized) return []
  return members.filter((person) => normalize(person.name) === normalized)
    .map((person) => ({ person, sameBirthDate: Boolean(birthDate && person.birthDate === birthDate) }))
}

function normalize(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function searchFamilyMembers(members: FamilyMember[], query: string) {
  const term = normalize(query)
  if (!term) return []
  return members.filter((person) => normalize(person.name).includes(term) || normalize(person.relationship).includes(term))
    .sort((a, b) => a.name.localeCompare(b.name))
}
