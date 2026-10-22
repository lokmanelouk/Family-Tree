import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptInviteRpcArgs, inviteTokenForLookup, inviteTokensMatch } from './invite-token.ts'

test('invite tokens are looked up as the raw token stored in the table', () => {
  const token = 'a'.repeat(64)
  assert.equal(inviteTokenForLookup(token), token)
  assert.deepEqual(acceptInviteRpcArgs(token), { invite_token: token })
  assert.equal(inviteTokensMatch(token, token), true)
  assert.equal(inviteTokensMatch(token, `${token}b`), false)
})

test('URL-encoded invite token is compared after URLSearchParams decoding', () => {
  const token = 'aB09-._~'.repeat(8)
  const decoded = new URLSearchParams(`invite=${encodeURIComponent(token)}`).get('invite')
  assert.equal(decoded, token)
  assert.equal(inviteTokensMatch(token, decoded ?? ''), true)
})

test('hashed tokens do not match a raw invite token', () => {
  const token = 'a'.repeat(64)
  assert.equal(inviteTokensMatch(token, 'sha256:' + token), false)
})
