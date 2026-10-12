import type { FamilyMember } from '../types/family'

export type TreeHistory = { members: FamilyMember[]; past: FamilyMember[][]; future: FamilyMember[][] }

export function recordTreeChange(history: TreeHistory, members: FamilyMember[]): TreeHistory {
  if (members === history.members) return history
  return { members, past: [...history.past.slice(-39), history.members], future: [] }
}

export function undoTreeChange(history: TreeHistory): TreeHistory {
  const previous = history.past.at(-1)
  return previous ? { members: previous, past: history.past.slice(0, -1), future: [history.members, ...history.future] } : history
}

export function redoTreeChange(history: TreeHistory): TreeHistory {
  const next = history.future[0]
  return next ? { members: next, past: [...history.past.slice(-39), history.members], future: history.future.slice(1) } : history
}
