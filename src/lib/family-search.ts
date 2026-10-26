import type { FamilyMember } from '../types/family'
import { getFullName, getNameParts, normalizeNameForMatch } from './member-name.ts'

export type DuplicateMatch = { person: FamilyMember; type: 'strong' | 'possible' }

function birthYear(date?: string) {
  const match = date?.trim().match(/^(\d{4})/)
  return match ? Number(match[1]) : null
}

function sameParents(parentIds: string[], right: FamilyMember) {
  return parentIds.length > 0 && parentIds.length === right.parentIds.length
    && parentIds.every((id) => right.parentIds.includes(id))
}

function normalizeFamilySearch(value: string) {
  return normalizeNameForMatch(value)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
}

export function findPossibleDuplicates(members: FamilyMember[], name: string, birthDate?: string, parentIds: string[] = []): DuplicateMatch[] {
  const normalized = normalizeNameForMatch(name)
  if (!normalized) return []
  const newYear = birthYear(birthDate)
  return members.flatMap((person) => {
    if (normalizeNameForMatch(getFullName(person)) !== normalized) return []
    const existingYear = birthYear(person.birthDate)
    if (newYear !== null && existingYear !== null) {
      const difference = Math.abs(newYear - existingYear)
      return difference <= 1 ? [{ person, type: 'strong' as const }] : []
    }
    const strong = sameParents(parentIds, person)
    return [{ person, type: strong ? 'strong' as const : 'possible' as const }]
  })
}

export function searchFamilyMembers(members: FamilyMember[], query: string) {
  const term = normalizeFamilySearch(query)
  if (!term) return []
  return members.filter((person) => {
    const { firstName, lastName } = getNameParts(person)
    return normalizeFamilySearch(getFullName(person)).includes(term)
      || normalizeFamilySearch(firstName).includes(term)
      || normalizeFamilySearch(lastName).includes(term)
      || normalizeFamilySearch(person.relationship).includes(term)
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
