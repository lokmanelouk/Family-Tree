export type TreeRole = 'owner' | 'editor' | 'viewer'

export function canEditTree(role: TreeRole | null | undefined) {
  return role === 'owner' || role === 'editor'
}

export function canManageTree(role: TreeRole | null | undefined) {
  return role === 'owner'
}
