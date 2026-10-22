import { requireSupabase } from '../supabase/client'
import { acceptInviteRpcArgs } from './invite-token'

export type ShareRole = 'viewer' | 'editor'
export type TreeInvite = {
  id: string
  tree_id: string
  token: string
  role: ShareRole
  expires_at: string
  max_uses: number
  uses: number
  revoked: boolean
  created_at: string
}
export type TreeMemberAccess = {
  user_id: string
  email: string | null
  role: 'owner' | ShareRole
  joined_at: string
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function createInviteToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createTreeInvite(treeId: string, role: ShareRole, expiresInDays: number) {
  const client = requireSupabase()
  const token = createInviteToken()
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
  const { data, error } = await client.from('invites').insert({ tree_id: treeId, token, role, expires_at: expiresAt, max_uses: 100 }).select('id,tree_id,token,role,expires_at,max_uses,uses,revoked,created_at').single()
  throwIfError(error)
  return data as TreeInvite
}

export async function listTreeInvites(treeId: string) {
  const { data, error } = await requireSupabase().from('invites').select('id,tree_id,token,role,expires_at,max_uses,uses,revoked,created_at').eq('tree_id', treeId).order('created_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as TreeInvite[]
}

export async function revokeTreeInvite(inviteId: string) {
  const { error } = await requireSupabase().from('invites').update({ revoked: true }).eq('id', inviteId)
  throwIfError(error)
}

export async function listTreeMembers(treeId: string) {
  const { data, error } = await requireSupabase().rpc('list_tree_members', { target_tree_id: treeId })
  throwIfError(error)
  return (data ?? []) as TreeMemberAccess[]
}

export async function updateTreeMemberRole(treeId: string, userId: string, role: ShareRole) {
  const { error } = await requireSupabase().from('tree_members').update({ role }).eq('tree_id', treeId).eq('user_id', userId)
  throwIfError(error)
}

export async function removeTreeMember(treeId: string, userId: string) {
  const { error } = await requireSupabase().from('tree_members').delete().eq('tree_id', treeId).eq('user_id', userId)
  throwIfError(error)
}

export type AcceptedTreeInvite = { treeId: string; alreadyMember: boolean }

export async function acceptTreeInvite(token: string): Promise<AcceptedTreeInvite> {
  try {
    const { data, error } = await requireSupabase().rpc('accept_invite', acceptInviteRpcArgs(token))
    if (error) throw error
    const result = data as { tree_id: string; already_member: boolean } | null
    if (!result?.tree_id) throw new Error('INVITE_RESPONSE_INVALID')
    return { treeId: result.tree_id, alreadyMember: result.already_member }
  } catch (error) {
    const fields = error && typeof error === 'object' ? error as Record<string, unknown> : {}
    console.error('accept_invite failed', {
      code: fields.code ?? null,
      message: fields.message ?? String(error),
      details: fields.details ?? null,
      hint: fields.hint ?? null,
    })
    throw error
  }
}
