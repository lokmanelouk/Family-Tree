export function getTreeSaveErrorKey(error: unknown) {
  if (!error || typeof error !== 'object') return 'Could not save, try again'
  const value = error as { code?: unknown; message?: unknown; status?: unknown }
  const code = typeof value.code === 'string' ? value.code : ''
  const message = typeof value.message === 'string' ? value.message : ''
  const status = typeof value.status === 'number' ? value.status : null
  if (code === '42501' || status === 403 || /permission denied|row-level security|not authorized|insufficient privilege/i.test(message)) {
    return "You don't have permission to edit this tree"
  }
  return 'Could not save, try again'
}
