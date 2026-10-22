import type { FamilyMember, RelationshipKind } from '../types/family'
import { validateRelationshipRules } from './family-validation.ts'

export type PersonContextAction = {
  kind: 'details' | 'edit' | 'child' | 'partner' | 'parent' | 'sibling' | 'delete'
  relationship?: RelationshipKind
  disabled?: boolean
  reason?: string
}

export function getPersonContextActions(member: FamilyMember, members: FamilyMember[] = [member]): PersonContextAction[] {
  return [
    { kind: 'details' },
    { kind: 'edit' },
    actionFor(member, members, 'child'),
    actionFor(member, members, 'partner'),
    actionFor(member, members, 'parent'),
    actionFor(member, members, 'sibling'),
    { kind: 'delete' },
  ]
}

export function getCreateRelativeLabelKey(kind: RelationshipKind) {
  if (kind === 'parent') return 'Create new parent'
  if (kind === 'partner') return 'Create new partner'
  if (kind === 'sibling') return 'Create new sibling'
  return 'Create new child'
}

export function getRelationshipActionAvailability(member: FamilyMember, members: FamilyMember[], kind: Extract<RelationshipKind, 'child' | 'parent' | 'partner' | 'sibling'>) {
  const existingParents = member.parentIds.map((id) => members.find((person) => person.id === id)).filter((person): person is FamilyMember => Boolean(person))
  const candidateGender: FamilyMember['gender'] = kind === 'partner'
    ? member.gender === 'female' ? 'male' : 'female'
    : kind === 'parent' && !existingParents.some((person) => person.gender === 'male') ? 'male' : 'female'
  const candidate = {
    ...member,
    id: '__new_relationship_candidate__',
    name: '',
    firstName: '',
    lastName: undefined,
    gender: candidateGender,
    birthDate: undefined,
    deathDate: undefined,
    lifeStatus: 'living' as const,
    parentIds: [],
    spouseIds: [],
    formerSpouseIds: [],
    siblingIds: [],
    adoptedParentIds: [],
  }
  const issue = validateRelationshipRules(members, member, candidate, kind).find((outcome) => !outcome.ok)?.result
  if (!issue) return { disabled: false, reason: undefined }
  const reason = issue.messageKey === 'This person already has two parents.'
    ? 'Already has two parents'
    : issue.messageKey === 'Add a parent first.'
      ? 'Add a parent first'
      : issue.messageKey
  return { disabled: true, reason }
}

export function getNextPickerIndex(currentIndex: number, optionCount: number, direction: 'next' | 'previous') {
  if (optionCount <= 0) return -1
  if (direction === 'next') return currentIndex < 0 || currentIndex >= optionCount - 1 ? 0 : currentIndex + 1
  return currentIndex <= 0 || currentIndex >= optionCount ? optionCount - 1 : currentIndex - 1
}

function actionFor(member: FamilyMember, members: FamilyMember[], kind: Extract<RelationshipKind, 'child' | 'parent' | 'partner' | 'sibling'>): PersonContextAction {
  const availability = getRelationshipActionAvailability(member, members, kind)
  return { kind, relationship: kind, ...availability }
}

export function hasUnsavedChanges(initial: unknown, current: unknown): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current)
}
