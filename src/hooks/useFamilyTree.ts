import { useCallback, useReducer } from 'react'
import { familyMembers } from '../data/family'
import { applyRelationship, createRelatedMember, removeMember, updateMemberProfile } from '../lib/tree-logic'
import { recordTreeChange, redoTreeChange, undoTreeChange, type TreeHistory } from '../lib/tree-history'
import type { FamilyMember, RelationshipKind } from '../types/family'

type State = TreeHistory
type Action =
  | { type: 'add-related'; targetId: string; kind: RelationshipKind; name: string; id: string; birthDate?: string; photo?: string; avatar?: import('../types/family').FamilyMember['avatar'] }
  | { type: 'relationship'; sourceId: string; targetId: string; kind: RelationshipKind }
  | { type: 'delete'; memberId: string }
  | { type: 'update-profile'; memberId: string; photo?: string; avatar: FamilyMember['avatar'] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'restore'; members: import('../types/family').FamilyMember[] }

const initialState: State = { members: familyMembers, past: [], future: [] }

function reducer(state: State, action: Action): State {
  if (action.type === 'undo') return undoTreeChange(state)
  if (action.type === 'redo') return redoTreeChange(state)
  if (action.type === 'restore') return { members: action.members, past: [...state.past.slice(-39), state.members], future: [] }
  let members = state.members
  if (action.type === 'add-related') members = createRelatedMember(members, action.targetId, action.kind, action.name, action.id, action.birthDate, action.photo, action.avatar)
  if (action.type === 'relationship') members = applyRelationship(members, action.sourceId, action.targetId, action.kind)
  if (action.type === 'delete') members = removeMember(members, action.memberId)
  if (action.type === 'update-profile') members = updateMemberProfile(members, action.memberId, action.photo, action.avatar)
  if (members === state.members) return state
  return recordTreeChange(state, members)
}

export function useFamilyTree() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const addRelated = useCallback((targetId: string, kind: RelationshipKind, name: string, birthDate?: string, photo?: string, avatar?: import('../types/family').FamilyMember['avatar']) => dispatch({ type: 'add-related', targetId, kind, name, birthDate, photo, avatar, id: `member-${crypto.randomUUID()}` }), [])
  const updateRelationship = useCallback((sourceId: string, targetId: string, kind: RelationshipKind) => dispatch({ type: 'relationship', sourceId, targetId, kind }), [])
  const deleteMember = useCallback((memberId: string) => dispatch({ type: 'delete', memberId }), [])
  const updateProfile = useCallback((memberId: string, photo: string | undefined, avatar: FamilyMember['avatar']) => dispatch({ type: 'update-profile', memberId, photo, avatar }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const restore = useCallback((members: import('../types/family').FamilyMember[]) => dispatch({ type: 'restore', members }), [])
  return {
    members: state.members,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    addRelated, updateRelationship, deleteMember, updateProfile, undo, redo, restore,
  }
}
