import { useCallback, useReducer } from 'react'
import { familyMembers } from '../data/family'
import { applyRelationship, createRelatedMemberWithNames, linkRecordedParentCouples, removeMember, updateMemberDetails, updateMemberProfile } from '../lib/tree-logic'
import { recordTreeChange, redoTreeChange, undoTreeChange, type TreeHistory } from '../lib/tree-history'
import type { FamilyMember, RelationshipKind } from '../types/family'
import { migrateMemberNames } from '../lib/member-name'
import { isValidTreeSnapshot } from '../lib/family-validation'

type State = TreeHistory
type Action =
  | { type: 'add-related'; targetId: string; kind: RelationshipKind; firstName: string; lastName: string; gender?: FamilyMember['gender']; id: string; birthDate?: string; deathDate?: string; lifeStatus?: FamilyMember['lifeStatus']; photo?: string; avatar?: import('../types/family').FamilyMember['avatar']; fatherId?: string; motherId?: string }
  | { type: 'relationship'; sourceId: string; targetId: string; kind: RelationshipKind }
  | { type: 'delete'; memberId: string }
  | { type: 'update-profile'; memberId: string; photo?: string; avatar: FamilyMember['avatar'] }
  | { type: 'update-details'; memberId: string; details: Pick<FamilyMember, 'name' | 'firstName' | 'lastName' | 'gender' | 'birthDate' | 'deathDate' | 'lifeStatus' | 'bio' | 'photo' | 'avatar'> }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'restore'; members: import('../types/family').FamilyMember[] }

function createInitialState(members: FamilyMember[] = familyMembers): State {
  return { members: linkRecordedParentCouples(migrateMemberNames(members)), past: [], future: [] }
}

function reducer(state: State, action: Action): State {
  if (action.type === 'undo') {
    const next = undoTreeChange(state)
    return isValidTreeSnapshot(next.members, new Date().toISOString().slice(0, 10)) ? next : state
  }
  if (action.type === 'redo') {
    const next = redoTreeChange(state)
    return isValidTreeSnapshot(next.members, new Date().toISOString().slice(0, 10)) ? next : state
  }
  if (action.type === 'restore') {
    const restored = linkRecordedParentCouples(migrateMemberNames(action.members))
    return { members: restored, past: [...state.past.slice(-39), state.members], future: [] }
  }
  let members = state.members
  if (action.type === 'add-related') members = createRelatedMemberWithNames(members, action.targetId, action.kind, action.firstName, action.lastName, action.id, action.birthDate, action.photo, action.avatar, action.gender, action.fatherId, action.motherId, action.deathDate, action.lifeStatus)
  if (action.type === 'relationship') members = applyRelationship(members, action.sourceId, action.targetId, action.kind)
  if (action.type === 'delete') members = removeMember(members, action.memberId)
  if (action.type === 'update-profile') members = updateMemberProfile(members, action.memberId, action.photo, action.avatar)
  if (action.type === 'update-details') members = updateMemberDetails(members, action.memberId, action.details)
  if (members === state.members) return state
  return recordTreeChange(state, members)
}

export function useFamilyTree(initialMembers?: FamilyMember[]) {
  const [state, dispatch] = useReducer(reducer, initialMembers ?? familyMembers, createInitialState)
  const addRelated = useCallback((targetId: string, kind: RelationshipKind, firstName: string, lastName: string, gender?: FamilyMember['gender'], birthDate?: string, photo?: string, avatar?: import('../types/family').FamilyMember['avatar'], fatherId?: string, motherId?: string, deathDate?: string, lifeStatus?: FamilyMember['lifeStatus']) => dispatch({ type: 'add-related', targetId, kind, firstName, lastName, gender, birthDate, deathDate, lifeStatus, photo, avatar, fatherId, motherId, id: crypto.randomUUID() }), [])
  const updateRelationship = useCallback((sourceId: string, targetId: string, kind: RelationshipKind) => dispatch({ type: 'relationship', sourceId, targetId, kind }), [])
  const deleteMember = useCallback((memberId: string) => dispatch({ type: 'delete', memberId }), [])
  const updateProfile = useCallback((memberId: string, photo: string | undefined, avatar: FamilyMember['avatar']) => dispatch({ type: 'update-profile', memberId, photo, avatar }), [])
  const updateDetails = useCallback((memberId: string, details: Pick<FamilyMember, 'name' | 'firstName' | 'lastName' | 'gender' | 'birthDate' | 'deathDate' | 'lifeStatus' | 'bio' | 'photo' | 'avatar'>) => dispatch({ type: 'update-details', memberId, details }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const restore = useCallback((members: import('../types/family').FamilyMember[]) => dispatch({ type: 'restore', members }), [])
  return {
    members: state.members,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    addRelated, updateRelationship, deleteMember, updateProfile, updateDetails, undo, redo, restore,
  }
}
