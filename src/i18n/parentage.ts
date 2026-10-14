import type { FamilyMember } from '../types/family'

export const parentageEnglish: Record<string, string> = {
  parentLinkMaleSingle: 'Son of {parent}',
  parentLinkMaleMultiple: 'Son of {parentA} & {parentB}',
  parentLinkFemaleSingle: 'Daughter of {parent}',
  parentLinkFemaleMultiple: 'Daughter of {parentA} & {parentB}',
  parentLinkNeutralSingle: 'Child of {parent}',
  parentLinkNeutralMultiple: 'Child of {parentA} & {parentB}',
}

export const parentageArabic: Record<string, string> = {
  parentLinkMaleSingle: 'ابن {parent}',
  parentLinkMaleMultiple: 'ابن {parentA} و{parentB}',
  parentLinkFemaleSingle: 'ابنة {parent}',
  parentLinkFemaleMultiple: 'ابنة {parentA} و{parentB}',
  parentLinkNeutralSingle: 'من ذرية {parent}',
  parentLinkNeutralMultiple: 'من ذرية {parentA} و{parentB}',
}

export function getParentageKey(gender: FamilyMember['gender'], parentCount: number): string | null {
  if (parentCount === 0) return null
  const role = gender ?? 'neutral'
  return `parentLink${role[0].toUpperCase()}${role.slice(1)}${parentCount > 1 ? 'Multiple' : 'Single'}`
}

export function interpolateParentage(pattern: string, parentNames: string[]): Array<{ type: 'text' | 'name'; value: string }> {
  if (parentNames.length === 0) return []
  const parts: Array<{ type: 'text' | 'name'; value: string }> = []
  const placeholders = /\{(parentA|parentB|parent)\}/g
  let cursor = 0
  for (const match of pattern.matchAll(placeholders)) {
    const index = match.index ?? 0
    if (index > cursor) parts.push({ type: 'text', value: pattern.slice(cursor, index) })
    const parentIndex = match[1] === 'parentB' ? 1 : 0
    const name = parentNames[parentIndex]
    if (!name) return []
    parts.push({ type: name ? 'name' : 'text', value: name ?? match[0] })
    cursor = index + match[0].length
  }
  if (cursor < pattern.length) parts.push({ type: 'text', value: pattern.slice(cursor) })
  return parts
}
