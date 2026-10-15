import type { FamilyMember } from '../types/family'
import { getFullName, getNameParts, normalizeNameForMatch } from './member-name.ts'

export function findPossibleDuplicates(members: FamilyMember[], name: string, birthDate?: string) {
  const normalized = normalizeNameForMatch(name)
  if (!normalized) return []
  return members.filter((person) => normalizeNameForMatch(getFullName(person)) === normalized)
    .map((person) => ({ person, sameBirthDate: Boolean(birthDate && person.birthDate === birthDate) }))
}

export function searchFamilyMembers(members: FamilyMember[], query: string) {
  const term = normalizeNameForMatch(query)
  if (!term) return []
  return members.filter((person) => {
    const { firstName, lastName } = getNameParts(person)
    return normalizeNameForMatch(getFullName(person)).includes(term)
      || normalizeNameForMatch(firstName).includes(term)
      || normalizeNameForMatch(lastName).includes(term)
      || normalizeNameForMatch(person.relationship).includes(term)
  }).sort((a, b) => getFullName(a).localeCompare(getFullName(b)))
}

export function getSurnameSuggestions(members: FamilyMember[], query: string) {
  const counts = new Map<string, { name: string; count: number }>()
  for (const member of members) {
    const surname = getNameParts(member).lastName
    const key = normalizeNameForMatch(surname)
    if (!key) continue
    const entry = counts.get(key)
    if (entry) entry.count += 1
    else counts.set(key, { name: surname, count: 1 })
  }
  const term = normalizeNameForMatch(query)
  return [...counts.values()].filter((entry) => !term || (normalizeNameForMatch(entry.name).includes(term) && normalizeNameForMatch(entry.name) !== term))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
