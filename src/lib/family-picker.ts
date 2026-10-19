import type { FamilyMember, RelationshipKind } from '../types/family'
import { defaultAvatar } from '../data/avatar-presets.ts'
import { collectValidationIssues, getParentAgeWarningNoteKey, validateChildBornAfterParentDeath, validateParentAge, validateParentDeath, validatePartnerAgeGap, validateRelationshipRules, type ValidationIssue } from './family-validation.ts'
import { getFullName, getNameParts } from './member-name.ts'

export type PickerCandidate = {
  person: FamilyMember
  issues: ValidationIssue[]
  reasonKey?: string
  warningKey?: string
}

export function normalizePickerSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').toLocaleLowerCase().trim()
}

export function getPickerCandidates(source: FamilyMember, members: FamilyMember[], kind: RelationshipKind, query = '', language = 'en') {
  const normalizedQuery = normalizePickerSearch(query)
  const parentRoles = source.parentIds.map((id) => members.find((member) => member.id === id)).filter((member): member is FamilyMember => Boolean(member))
  const hasFather = parentRoles.some((parent) => parent.gender === 'male')
  const hasMother = parentRoles.some((parent) => parent.gender === 'female')
  const alphabetical = new Intl.Collator(language, { sensitivity: 'base', usage: 'sort' })
  const assessed = members.filter((person) => {
    if (person.id === source.id) return false
    if (kind === 'partner' && (source.spouseIds.includes(person.id) || person.spouseIds.includes(source.id))) return false
    if (kind === 'parent' && source.parentIds.includes(person.id)) return false
    if (kind === 'child' && person.parentIds.includes(source.id)) return false
    if (kind === 'sibling' && (source.siblingIds.includes(person.id) || person.siblingIds.includes(source.id) || source.parentIds.some((parentId) => person.parentIds.includes(parentId)))) return false
    if (kind === 'parent' && parentRoles.length >= 2) return false
    if (kind === 'parent' && hasFather && person.gender !== 'female') return false
    if (kind === 'parent' && hasMother && person.gender !== 'male') return false
    if (!normalizedQuery) return true
    const { firstName, lastName } = getNameParts(person)
    return [firstName, lastName, getFullName(person)].some((name) => normalizePickerSearch(name).includes(normalizedQuery))
  }).map((person) => {
    const outcomes = validateRelationshipRules(members, source, person, kind)
    if (kind === 'child') outcomes.push(validateChildBornAfterParentDeath(source, person))
    if (kind === 'partner') outcomes.push(validatePartnerAgeGap(source, person))
    const issues = collectValidationIssues(outcomes)
    const error = issues.find((issue) => issue.type === 'error')
    const warning = issues.find((issue) => issue.type === 'warning')
    return {
      person,
      issues,
      ...(error ? { reasonKey: hiddenReason(error, kind) } : {}),
      ...(warning ? { warningKey: warningReason(warning) } : {}),
    }
  })
  const visible = assessed.filter((candidate) => !candidate.reasonKey)
  const hidden = assessed.filter((candidate) => Boolean(candidate.reasonKey))
  const sort = (left: PickerCandidate, right: PickerCandidate) => {
    const leftHasBirth = Boolean(left.person.birthDate)
    const rightHasBirth = Boolean(right.person.birthDate)
    const leftRank = !leftHasBirth ? 2 : left.warningKey ? 1 : 0
    const rightRank = !rightHasBirth ? 2 : right.warningKey ? 1 : 0
    return leftRank - rightRank || alphabetical.compare(getFullName(left.person), getFullName(right.person))
  }
  visible.sort(sort)
  hidden.sort(sort)
  return { visible, hidden }
}

export function filterPickerMembers(source: FamilyMember, members: FamilyMember[], kind: RelationshipKind, query: string, language = 'en') {
  return getPickerCandidates(source, members, kind, query, language).visible.map((entry) => entry.person)
}

export function getParentPickerMembers(members: FamilyMember[], gender: 'male' | 'female', selectedId = '') {
  return members.filter((member) => member.gender === gender || member.id === selectedId)
}

export function getParentPickerOptions(members: FamilyMember[], gender: 'male' | 'female', childBirthDate: string, selectedId = '') {
  const candidates = getParentPickerMembers(members, gender, selectedId)
  if (!childBirthDate) return { members: candidates, warningIds: new Set<string>(), warningKeys: new Map<string, string>() }
  const child = {
    id: '__new-parent-picker-child__',
    name: '',
    firstName: '',
    initials: '',
    relationship: '',
    gender: undefined,
    birthDate: childBirthDate,
    avatar: defaultAvatar,
    parentIds: [],
    spouseIds: [],
    siblingIds: [],
  } as FamilyMember
  const eligible: FamilyMember[] = []
  const warningIds = new Set<string>()
  const warningKeys = new Map<string, string>()
  for (const parent of candidates) {
    const outcomes = [validateParentAge(parent, child), validateParentDeath(parent, child, gender === 'male' ? 'father' : 'mother'), validateChildBornAfterParentDeath(parent, child)]
    const issues = collectValidationIssues(outcomes)
    if (parent.id === selectedId || !issues.some((issue) => issue.type === 'error')) eligible.push(parent)
    const warnings = issues.filter((issue) => issue.type === 'warning')
    if (warnings.length) {
      warningIds.add(parent.id)
      const noteKey = warnings.map(getParentAgeWarningNoteKey).find(Boolean)
      if (noteKey) warningKeys.set(parent.id, noteKey)
      else warningKeys.set(parent.id, 'Small age gap')
    }
  }
  return { members: eligible, warningIds, warningKeys }
}

function hiddenReason(issue: ValidationIssue, kind: RelationshipKind) {
  if (issue.messageKey === 'This person already has two parents.') return 'Already has two parents'
  if (issue.messageKey === 'A person cannot be their own ancestor.') return 'Would create an ancestor loop'
  if (issue.messageKey === '{parent} must be older than {child}.') return kind === 'child' ? 'Must be younger' : 'Must be older'
  if (issue.messageKey === '{parent} died before {child} was born.') return 'Died before birth'
  if (issue.messageKey === 'Child was born after parent died.') return 'Born after death'
  if (issue.messageKey === 'This person is already a partner.') return 'Already a partner'
  if (issue.messageKey === 'This person is already a sibling.') return 'Already a sibling'
  if (issue.messageKey === 'These family members are already partners.') return 'Already a partner'
  if (issue.messageKey === 'These family members are already siblings.') return 'Already a sibling'
  if (issue.messageKey === 'Partners must be of different genders.') return 'Gender does not match'
  if (issue.messageKey === 'A female family member can have only one husband.') return 'Already a partner'
  if (issue.messageKey === 'An ancestor and descendant cannot be linked as siblings.') return 'Would create an ancestor loop'
  if (issue.messageKey === 'A person can have only one father.' || issue.messageKey === 'A person can have only one mother.') return 'Already has this parent role'
  return 'Already linked'
}

function warningReason(issue: ValidationIssue) {
  const parentAgeNote = getParentAgeWarningNoteKey(issue)
  if (parentAgeNote) return parentAgeNote
  if (issue.messageKey === 'Age difference over 30 years.') return 'Age difference over 30 years'
  if (issue.messageKey.includes('less than')) return 'Small age gap'
  if (issue.messageKey.startsWith('Born in ')) return 'Unusually old'
  if (issue.messageKey.includes('is not marked')) return 'Gender does not match'
  return 'Unlikely relationship'
}
