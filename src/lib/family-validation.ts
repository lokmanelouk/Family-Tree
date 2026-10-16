import type { FamilyMember, RelationshipKind } from '../types/family'
import { getFullName } from './member-name.ts'

export const MIN_PARENT_AGE = 15
export const MAX_PERSON_AGE = 120

export type ValidationIssue = {
  type: 'error' | 'warning'
  messageKey: string
  values: Record<string, string | number>
}

export type ValidationOutcome = { ok: true } | { ok: false; result: ValidationIssue }

const ok: ValidationOutcome = { ok: true }

function result(type: ValidationIssue['type'], messageKey: string, values: Record<string, string | number> = {}): ValidationOutcome {
  return { ok: false, result: { type, messageKey, values } }
}

function yearOf(value?: string) {
  const match = value?.trim().match(/^(\d{4})(?:-(\d{2})-(\d{2}))?$/)
  if (!match) return null
  const year = Number(match[1])
  if (!match[2]) return { year, exact: false, value: match[0] }
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, exact: true, value: match[0] }
}

function compareDates(left?: string, right?: string) {
  const a = yearOf(left)
  const b = yearOf(right)
  if (!a || !b) return null
  if (a.exact && b.exact) return a.value.localeCompare(b.value)
  return a.year - b.year
}

function ageInYears(birthDate?: string, endDate?: string) {
  const birth = yearOf(birthDate)
  const end = yearOf(endDate)
  if (!birth || !end) return null
  let age = end.year - birth.year
  if (birth.exact && end.exact && end.value.slice(5) < birth.value.slice(5)) age -= 1
  return age
}

function issueNames(member: FamilyMember) {
  return { name: getFullName(member) }
}

export function validatePersonDates(birthDate: string | undefined, deathDate: string | undefined, today: string): ValidationOutcome {
  const todayParts = yearOf(today)
  const birth = yearOf(birthDate)
  const death = yearOf(deathDate)
  if (birthDate && !birth) return result('error', 'Enter a valid birth date.')
  if (deathDate && !death) return result('error', 'Enter a valid death date.')
  if (birth && todayParts && compareDates(birthDate, today) !== null && compareDates(birthDate, today)! > 0) return result('error', 'Birth dates cannot be in the future.')
  if (death && todayParts && compareDates(deathDate, today) !== null && compareDates(deathDate, today)! > 0) return result('error', 'Death dates cannot be in the future.')
  if (birth && death && compareDates(deathDate, birthDate)! <= 0) return result('error', 'Death date must be after birth date.')
  return ok
}

export function validateSelfRelation(source: FamilyMember, target: FamilyMember, kind: RelationshipKind): ValidationOutcome {
  return source.id === target.id ? result('error', 'A person cannot be their own {relation}.', { relation: relationLabel(kind) }) : ok
}

function relationLabel(kind: RelationshipKind) {
  if (kind === 'parent') return 'parent'
  if (kind === 'child' || kind === 'adopted') return 'child'
  if (kind === 'sibling') return 'sibling'
  return 'partner'
}

function reachesAncestor(members: FamilyMember[], startId: string, soughtId: string, visited = new Set<string>()): boolean {
  if (startId === soughtId) return true
  if (visited.has(startId)) return false
  visited.add(startId)
  const person = members.find((member) => member.id === startId)
  return Boolean(person?.parentIds.some((parentId) => reachesAncestor(members, parentId, soughtId, visited)))
}

export function validateAncestorCycle(members: FamilyMember[], parent: FamilyMember, child: FamilyMember): ValidationOutcome {
  return reachesAncestor(members, parent.id, child.id) ? result('error', 'A person cannot be their own ancestor.') : ok
}

export function validateParentAge(parent: FamilyMember, child: FamilyMember): ValidationOutcome {
  const comparison = compareDates(parent.birthDate, child.birthDate)
  if (comparison === null || comparison >= 0) return comparison !== null ? result('error', '{parent} must be older than {child}.', { parent: getFullName(parent), child: getFullName(child) }) : ok
  const age = ageInYears(parent.birthDate, child.birthDate)
  return age !== null && age < MIN_PARENT_AGE
    ? result('warning', '{parent} is less than {years} years older than {child}.', { parent: getFullName(parent), years: MIN_PARENT_AGE, child: getFullName(child) })
    : ok
}

export function validateParentDeath(parent: FamilyMember, child: FamilyMember, role: 'father' | 'mother' | 'parent'): ValidationOutcome {
  const comparison = compareDates(parent.deathDate, child.birthDate)
  if (comparison === null || comparison >= 0) return ok
  const parentDeath = yearOf(parent.deathDate)
  const childBirth = yearOf(child.birthDate)
  if (role === 'father' && parentDeath && childBirth && !parentDeath.exact && !childBirth.exact && childBirth.year - parentDeath.year <= 1) return ok
  if (role === 'father' && parentDeath && childBirth && childBirth.year - parentDeath.year <= 1) return ok
  return result('error', '{parent} died before {child} was born.', { parent: getFullName(parent), child: getFullName(child) })
}

export function validateChildBornAfterParentDeath(parent: FamilyMember, child: FamilyMember): ValidationOutcome {
  return compareDates(parent.deathDate, child.birthDate) !== null && compareDates(parent.deathDate, child.birthDate)! < 0
    ? result('error', 'Child was born after parent died.', { parent: getFullName(parent), child: getFullName(child) })
    : ok
}

export function validateParentRole(parent: FamilyMember, role: 'father' | 'mother'): ValidationOutcome {
  const expected = role === 'father' ? 'male' : 'female'
  return parent.gender === expected ? ok : result('warning', '{parent} is not marked as {gender}.', { parent: getFullName(parent), gender: expected })
}

export function validateAgeLimit(member: FamilyMember, today: string): ValidationOutcome {
  const endDate = member.deathDate ?? (member.lifeStatus === 'living' ? today : undefined)
  const age = ageInYears(member.birthDate, endDate)
  if (age === null || age <= MAX_PERSON_AGE) return ok
  const birthYear = yearOf(member.birthDate)?.year
  const messageKey = member.gender === 'male'
    ? 'Born in {year}, {name} would be over 120 years old (male).'
    : member.gender === 'female'
      ? 'Born in {year}, {name} would be over 120 years old (female).'
      : 'Born in {year}, {name} would be over 120 years old (neutral).'
  return birthYear ? result('warning', messageKey, { ...issueNames(member), year: birthYear }) : ok
}

export function validatePartnerDuplicate(source: FamilyMember, target: FamilyMember): ValidationOutcome {
  return source.spouseIds.includes(target.id) || target.spouseIds.includes(source.id)
    ? result('error', 'These family members are already partners.')
    : ok
}

export function validatePartnerAgeGap(source: FamilyMember, target: FamilyMember): ValidationOutcome {
  const sourceBirthYear = yearOf(source.birthDate)?.year
  const targetBirthYear = yearOf(target.birthDate)?.year
  return sourceBirthYear !== undefined && targetBirthYear !== undefined && Math.abs(sourceBirthYear - targetBirthYear) > 30
    ? result('warning', 'Age difference over 30 years.')
    : ok
}

export function validatePartnerConstraints(source: FamilyMember, target: FamilyMember): ValidationOutcome[] {
  const outcomes: ValidationOutcome[] = []
  if (source.gender && target.gender && source.gender === target.gender) outcomes.push(result('error', 'Partners must be of different genders.'))
  for (const person of [source, target]) {
    if (person.gender === 'female' && person.spouseIds.some((id) => id !== (person.id === source.id ? target.id : source.id))) {
      outcomes.push(result('error', 'A female family member can have only one husband.'))
      break
    }
  }
  return outcomes
}

export function validateRelationshipRules(members: FamilyMember[], source: FamilyMember, target: FamilyMember, kind: RelationshipKind): ValidationOutcome[] {
  const outcomes: ValidationOutcome[] = [validateSelfRelation(source, target, kind)]
  const shareParent = source.parentIds.some((parentId) => target.parentIds.includes(parentId))
  const areSiblings = shareParent || source.siblingIds.includes(target.id) || target.siblingIds.includes(source.id)
  const isPartner = source.spouseIds.includes(target.id) || target.spouseIds.includes(source.id)
  if (kind === 'partner') {
    outcomes.push(validatePartnerDuplicate(source, target), ...validatePartnerConstraints(source, target))
    if (areSiblings) outcomes.push(result('error', 'This person is already a sibling.'))
    if (reachesAncestor(members, source.id, target.id) || reachesAncestor(members, target.id, source.id)) outcomes.push(result('error', 'A person cannot be their own ancestor.'))
  }
  if (kind === 'sibling') {
    if (!source.parentIds.length) outcomes.push(result('error', 'Add a parent first.'))
    if (source.siblingIds.includes(target.id) || target.siblingIds.includes(source.id)) outcomes.push(result('error', 'These family members are already siblings.'))
    if (reachesAncestor(members, source.id, target.id) || reachesAncestor(members, target.id, source.id)) outcomes.push(result('error', 'An ancestor and descendant cannot be linked as siblings.'))
    if (isPartner) outcomes.push(result('error', 'This person is already a partner.'))
    for (const parentId of source.parentIds) {
      const parent = members.find((person) => person.id === parentId)
      if (!parent || target.parentIds.includes(parentId)) continue
      const role = parent.gender === 'male' ? 'father' : parent.gender === 'female' ? 'mother' : 'parent'
      const conflictingParent = target.parentIds.map((id) => members.find((person) => person.id === id)).find((person) => person && person.id !== parentId && role !== 'parent' && person.gender === parent.gender)
      if (conflictingParent) outcomes.push(result('error', role === 'father' ? 'A person can have only one father.' : 'A person can have only one mother.'))
      outcomes.push(validateAncestorCycle(members, parent, target), validateParentAge(parent, target), validateParentDeath(parent, target, role))
      if (role !== 'parent') outcomes.push(validateParentRole(parent, role))
    }
  }
  if (kind === 'parent' || kind === 'child' || kind === 'adopted') {
    const parent = kind === 'parent' ? target : source
    const child = kind === 'parent' ? source : target
    if (kind === 'parent') {
      if (source.parentIds.length >= 2) outcomes.push(result('error', 'This person already has two parents.'))
      const existingParents = source.parentIds.map((id) => members.find((person) => person.id === id)).filter((person): person is FamilyMember => Boolean(person))
      const sameRole = existingParents.find((person) => person.gender && target.gender && person.gender === target.gender)
      if (sameRole) outcomes.push(result('error', target.gender === 'male' ? 'A person can have only one father.' : 'A person can have only one mother.'))
      if (isPartner) outcomes.push(result('error', 'This person is already a partner.'))
      if (areSiblings) outcomes.push(result('error', 'This person is already a sibling.'))
    }
    if (kind === 'child') {
      if (target.parentIds.length >= 2) outcomes.push(result('error', 'This person already has two parents.'))
      if (isPartner) outcomes.push(result('error', 'This person is already a partner.'))
      if (areSiblings) outcomes.push(result('error', 'This person is already a sibling.'))
    }
    outcomes.push(validateAncestorCycle(members, parent, child))
    outcomes.push(validateParentAge(parent, child))
    const role = parent.gender === 'male' ? 'father' : parent.gender === 'female' ? 'mother' : 'parent'
    outcomes.push(validateParentDeath(parent, child, role))
    if (role !== 'parent') outcomes.push(validateParentRole(parent, role))
  }
  return outcomes
}

export function validateNewPersonRelations(members: FamilyMember[], child: FamilyMember, father: FamilyMember | undefined, mother: FamilyMember | undefined, today: string): ValidationOutcome[] {
  const outcomes: ValidationOutcome[] = [validatePersonDates(child.birthDate, child.deathDate, today), validateAgeLimit(child, today)]
  if (father) outcomes.push(validateAncestorCycle(members, father, child), validateParentAge(father, child), validateParentDeath(father, child, 'father'), validateParentRole(father, 'father'))
  if (mother) outcomes.push(validateAncestorCycle(members, mother, child), validateParentAge(mother, child), validateParentDeath(mother, child, 'mother'), validateParentRole(mother, 'mother'))
  return outcomes
}

export function validateEditedMemberRelations(member: FamilyMember, members: FamilyMember[], birthDate: string | undefined, deathDate: string | undefined, today: string): ValidationOutcome[] {
  const edited = { ...member, birthDate, deathDate }
  const outcomes: ValidationOutcome[] = [validatePersonDates(birthDate, deathDate, today), validateAgeLimit(edited, today)]
  for (const parentId of member.parentIds) {
    const parent = members.find((person) => person.id === parentId)
    if (parent) outcomes.push(validateParentAge(parent, edited), validateParentDeath(parent, edited, parent.gender === 'male' ? 'father' : 'mother'))
  }
  for (const child of members.filter((person) => person.parentIds.includes(member.id))) {
    outcomes.push(validateParentAge(edited, child), validateParentDeath(edited, child, member.gender === 'male' ? 'father' : 'mother'))
  }
  return outcomes
}

export function collectValidationIssues(outcomes: ValidationOutcome[]) {
  const issues = outcomes.flatMap((outcome) => outcome.ok ? [] : [outcome.result])
  const merged: ValidationIssue[] = []
  const processed = new Set<ValidationIssue>()
  const mergePairs = [
    { source: '{parent} must be older than {child}.', result: 'Both parents must be older than {child}.' },
    { source: '{parent} is less than {years} years older than {child}.', result: 'Both parents are less than {years} years older than {child}.' },
  ]
  for (const issue of issues) {
    if (processed.has(issue)) continue
    const mergeRule = mergePairs.find((entry) => issue.messageKey === entry.source)
    const matching = mergeRule ? issues.filter((candidate) => !processed.has(candidate) && candidate.messageKey === mergeRule.source && candidate.values.child === issue.values.child) : []
    if (mergeRule && matching.length > 1) {
      matching.forEach((candidate) => processed.add(candidate))
      merged.push({
        type: issue.type,
        messageKey: mergeRule.result,
        values: { a: matching[0].values.parent, b: matching[1].values.parent, child: issue.values.child, ...(issue.values.years === undefined ? {} : { years: issue.values.years }) },
      })
    } else {
      processed.add(issue)
      merged.push(issue)
    }
  }
  return merged
}

export function isValidTreeSnapshot(members: FamilyMember[], today: string) {
  for (const child of members) {
    if (child.parentIds.includes(child.id) || child.spouseIds.includes(child.id) || child.siblingIds.includes(child.id)) return false
    if (new Set(child.parentIds).size !== child.parentIds.length || new Set(child.spouseIds).size !== child.spouseIds.length || new Set(child.siblingIds).size !== child.siblingIds.length) return false
    const dates = validatePersonDates(child.birthDate, child.deathDate, today)
    if (!dates.ok && dates.result.type === 'error') return false
    for (const parentId of child.parentIds) {
      const parent = members.find((person) => person.id === parentId)
      if (!parent) return false
      if (!validateAncestorCycle(members, parent, child).ok) return false
      const ageResult = validateParentAge(parent, child)
      if (!ageResult.ok && ageResult.result.type === 'error') return false
      const deathResult = validateParentDeath(parent, child, parent.gender === 'male' ? 'father' : 'mother')
      if (!deathResult.ok && deathResult.result.type === 'error') return false
    }
    for (const spouseId of child.spouseIds) {
      const spouse = members.find((person) => person.id === spouseId)
      if (!spouse || !spouse.spouseIds.includes(child.id)) return false
      if (collectValidationIssues(validatePartnerConstraints(child, spouse)).some((issue) => issue.type === 'error')) return false
    }
  }
  return true
}
