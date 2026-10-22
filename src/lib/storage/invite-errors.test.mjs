import test from 'node:test'
import assert from 'node:assert/strict'
import { getInviteErrorTranslation } from './invite-errors.ts'

test('invite SQL errors map to distinct user messages', () => {
  assert.equal(getInviteErrorTranslation({ code: 'P0001', message: 'INVITE_NOT_FOUND' }), 'This invite link was not found.')
  assert.equal(getInviteErrorTranslation({ code: 'P0001', message: 'INVITE_EXPIRED' }), 'This invite link has expired.')
  assert.equal(getInviteErrorTranslation({ code: 'P0001', message: 'INVITE_REVOKED' }), 'This invite link was revoked.')
  assert.equal(getInviteErrorTranslation({ code: 'P0001', message: 'INVITE_USED' }), 'This invite link has reached its use limit.')
  assert.equal(getInviteErrorTranslation({ code: 'P0001', message: 'INVITE_AUTH_REQUIRED' }), 'Log in first to accept this invite link.')
})

test('PostgREST function and database permission failures are identified', () => {
  assert.equal(getInviteErrorTranslation({ code: 'PGRST202', message: 'Function not found' }), 'Invite service is unavailable. Apply the latest invite migration.')
  assert.equal(getInviteErrorTranslation({ code: '42883', message: 'function public.accept_invite does not exist' }), 'Invite service is unavailable. Apply the latest invite migration.')
  assert.equal(getInviteErrorTranslation({ code: '42501', message: 'permission denied for function accept_invite' }), 'Invite permission denied. Ask the tree owner to check access.')
})

test('network errors are not reported as invalid invite links', () => {
  assert.equal(getInviteErrorTranslation(new TypeError('Failed to fetch')), 'Could not reach the invite service. Check your connection and try again.')
  assert.equal(getInviteErrorTranslation({ code: 'FETCH_ERROR', message: 'request failed' }), 'Could not reach the invite service. Check your connection and try again.')
})

test('errors with an unknown cause use the fallback only when no known cause exists', () => {
  assert.equal(getInviteErrorTranslation({ code: 'XX000', message: 'unclassified failure' }), 'Could not verify this invite link. Please try again.')
})
