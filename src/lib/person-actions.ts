import type { FamilyMember, RelationshipKind } from '../types/family'

export type PersonContextAction = {
  kind: 'details' | 'edit' | 'child' | 'partner' | 'parent' | 'sibling' | 'center' | 'delete'
  relationship?: RelationshipKind
  disabled?: boolean
  reason?: string
}

export function getPersonContextActions(member: FamilyMember): PersonContextAction[] {
  return [
    { kind: 'details' },
    { kind: 'edit' },
    { kind: 'child', relationship: 'child' },
    { kind: 'partner', relationship: 'partner' },
    { kind: 'parent', relationship: 'parent', disabled: member.parentIds.length >= 2, reason: member.parentIds.length >= 2 ? 'Already has two parents' : undefined },
    { kind: 'sibling', relationship: 'sibling', disabled: member.parentIds.length === 0, reason: member.parentIds.length === 0 ? 'Add a parent first' : undefined },
    { kind: 'center' },
    { kind: 'delete' },
  ]
}

export function hasUnsavedChanges(initial: unknown, current: unknown): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current)
}
