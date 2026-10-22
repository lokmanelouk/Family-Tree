export function inviteTokenForLookup(token: string) {
  return token
}

export function acceptInviteRpcArgs(token: string) {
  return { invite_token: token }
}

export function inviteTokensMatch(storedToken: string, submittedToken: string) {
  return storedToken === inviteTokenForLookup(submittedToken)
}

const pendingInviteKey = 'kinfolk-pending-invite'

export function rememberInviteFromUrl() {
  const token = new URLSearchParams(window.location.search).get('invite')
  if (token) {
    window.sessionStorage.setItem(pendingInviteKey, token)
    return token
  }
  return window.sessionStorage.getItem(pendingInviteKey)
}

export function clearPendingInvite() {
  window.sessionStorage.removeItem(pendingInviteKey)
  const query = new URLSearchParams(window.location.search)
  if (!query.has('invite')) return
  query.delete('invite')
  window.history.replaceState(null, '', `${window.location.pathname}${query.size ? `?${query}` : ''}${window.location.hash}`)
}
