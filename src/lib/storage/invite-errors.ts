type InviteErrorFields = { code?: unknown; message?: unknown; details?: unknown; hint?: unknown }

export type InviteErrorTranslation =
  | 'This invite link was not found.'
  | 'This invite link has expired.'
  | 'This invite link was revoked.'
  | 'This invite link has reached its use limit.'
  | 'Log in first to accept this invite link.'
  | 'Invite permission denied. Ask the tree owner to check access.'
  | 'Invite service is unavailable. Apply the latest invite migration.'
  | 'Could not reach the invite service. Check your connection and try again.'
  | 'Could not verify this invite link. Please try again.'

export function getInviteErrorTranslation(error: InviteErrorFields | unknown): InviteErrorTranslation {
  const fields = error && typeof error === 'object' ? error as InviteErrorFields : {}
  const code = String(fields.code ?? '').toUpperCase()
  const text = [fields.message, fields.details, fields.hint].map((value) => String(value ?? '')).join(' ').toLowerCase()

  if (text.includes('invite_auth_required') || code === 'PGRST301' || code === '401' || text.includes('invalid jwt') || text.includes('jwt expired')) {
    return 'Log in first to accept this invite link.'
  }
  if (code === '42501' || text.includes('permission denied') || text.includes('not have execute privilege')) {
    return 'Invite permission denied. Ask the tree owner to check access.'
  }
  if (code === 'PGRST202' || code === '42883' || text.includes('function public.accept_invite') || text.includes('could not find the function') || text.includes('invite_response_invalid')) {
    return 'Invite service is unavailable. Apply the latest invite migration.'
  }
  if (text.includes('invite_not_found') || text.includes('invite_invalid') || code === 'P0002' || text.includes('invite link was not found')) {
    return 'This invite link was not found.'
  }
  if (text.includes('invite_expired') || text.includes('invite link has expired')) {
    return 'This invite link has expired.'
  }
  if (text.includes('invite_revoked') || text.includes('invite link was revoked')) {
    return 'This invite link was revoked.'
  }
  if (text.includes('invite_used') || text.includes('invite link has reached its use limit') || text.includes('use limit')) {
    return 'This invite link has reached its use limit.'
  }
  if (error instanceof TypeError || code === 'FETCH_ERROR' || code === 'NETWORK_ERROR' || text.includes('failed to fetch') || text.includes('fetch failed') || text.includes('network') || text.includes('connection') || text.includes('timed out') || text.includes('timeout')) {
    return 'Could not reach the invite service. Check your connection and try again.'
  }
  return 'Could not verify this invite link. Please try again.'
}
