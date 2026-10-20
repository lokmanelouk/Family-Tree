import type { FamilyMember } from '../../types/family.ts'
import { requireSupabase } from '../supabase/client.ts'
import { familyMembersToRows, rowsToFamilyMembers, type ParentLinkRow, type PartnerLinkRow, type PersonRow } from './tree-data.ts'

export type TreeRecord = { id: string; name: string }

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function loadTree(): Promise<{ tree: TreeRecord | null; members: FamilyMember[] }> {
  const client = requireSupabase()
  const { data: trees, error: treeError } = await client.from('trees').select('id,name').order('created_at', { ascending: true }).limit(1)
  throwIfError(treeError)
  const tree = trees?.[0] as TreeRecord | undefined
  if (!tree) return { tree: null, members: [] }
  const [peopleResult, parentsResult, partnersResult] = await Promise.all([
    client.from('people').select('id,tree_id,first_name,last_name,gender,birth_date,death_date,deceased,photo_path').eq('tree_id', tree.id),
    client.from('parent_links').select('tree_id,child_id,parent_id,kind').eq('tree_id', tree.id),
    client.from('partner_links').select('tree_id,person_a,person_b,status').eq('tree_id', tree.id),
  ])
  throwIfError(peopleResult.error)
  throwIfError(parentsResult.error)
  throwIfError(partnersResult.error)
  return {
    tree,
    members: rowsToFamilyMembers(peopleResult.data as PersonRow[], parentsResult.data as ParentLinkRow[], partnersResult.data as PartnerLinkRow[]),
  }
}

export async function createTree(name: string, ownerId: string): Promise<TreeRecord> {
  const client = requireSupabase()
  const { data, error } = await client.from('trees').insert({ name: name.trim(), owner_id: ownerId }).select('id,name').single()
  throwIfError(error)
  return data as TreeRecord
}

export async function addPerson(treeId: string, member: FamilyMember) {
  const client = requireSupabase()
  const { people } = familyMembersToRows(treeId, [member])
  const { error } = await client.from('people').upsert(people[0], { onConflict: 'id', ignoreDuplicates: true })
  throwIfError(error)
}

export async function editPerson(treeId: string, member: FamilyMember) {
  const client = requireSupabase()
  const { people } = familyMembersToRows(treeId, [member])
  const { id, tree_id, ...changes } = people[0]
  void tree_id
  const { error } = await client.from('people').update(changes).eq('tree_id', treeId).eq('id', id)
  throwIfError(error)
}

export async function deletePerson(treeId: string, personId: string) {
  const client = requireSupabase()
  const { error } = await client.from('people').delete().eq('tree_id', treeId).eq('id', personId)
  throwIfError(error)
}

export async function addParentLink(link: ParentLinkRow) {
  const client = requireSupabase()
  const { error } = await client.from('parent_links').upsert(link, { onConflict: 'tree_id,child_id,parent_id', ignoreDuplicates: true })
  throwIfError(error)
}

export async function removeParentLink(treeId: string, childId: string, parentId: string) {
  const client = requireSupabase()
  const { error } = await client.from('parent_links').delete().eq('tree_id', treeId).eq('child_id', childId).eq('parent_id', parentId)
  throwIfError(error)
}

export async function addPartnerLink(link: PartnerLinkRow) {
  const client = requireSupabase()
  const { error } = await client.from('partner_links').upsert(link, { onConflict: 'tree_id,person_a,person_b', ignoreDuplicates: true })
  throwIfError(error)
}

export async function removePartnerLink(treeId: string, personA: string, personB: string) {
  const client = requireSupabase()
  const [person_a, person_b] = [personA, personB].sort()
  const { error } = await client.from('partner_links').delete().eq('tree_id', treeId).eq('person_a', person_a).eq('person_b', person_b)
  throwIfError(error)
}

export async function changePartnerLink(treeId: string, personA: string, personB: string, status: PartnerLinkRow['status']) {
  const client = requireSupabase()
  const [person_a, person_b] = [personA, personB].sort()
  const { error } = await client.from('partner_links').update({ status }).eq('tree_id', treeId).eq('person_a', person_a).eq('person_b', person_b)
  throwIfError(error)
}

export async function saveTreeChanges(treeId: string, before: FamilyMember[], after: FamilyMember[]) {
  const oldRows = familyMembersToRows(treeId, before)
  const newRows = familyMembersToRows(treeId, after)
  const oldPeople = new Map(oldRows.people.map((person) => [person.id, person]))
  const newPeople = new Map(newRows.people.map((person) => [person.id, person]))
  const oldParents = new Map(oldRows.parentLinks.map((link) => [`${link.child_id}|${link.parent_id}`, link]))
  const newParents = new Map(newRows.parentLinks.map((link) => [`${link.child_id}|${link.parent_id}`, link]))
  const oldPartners = new Map(oldRows.partnerLinks.map((link) => [`${link.person_a}|${link.person_b}`, link]))
  const newPartners = new Map(newRows.partnerLinks.map((link) => [`${link.person_a}|${link.person_b}`, link]))
  for (const link of oldParents.values()) {
    const next = newParents.get(`${link.child_id}|${link.parent_id}`)
    if (!next || next.kind !== link.kind) await removeParentLink(treeId, link.child_id, link.parent_id)
  }
  for (const link of oldPartners.values()) {
    const next = newPartners.get(`${link.person_a}|${link.person_b}`)
    if (!next) await removePartnerLink(treeId, link.person_a, link.person_b)
    else if (next.status !== link.status) await changePartnerLink(treeId, link.person_a, link.person_b, next.status)
  }
  for (const person of newPeople.values()) {
    const previous = oldPeople.get(person.id)
    const member = after.find((candidate) => candidate.id === person.id)!
    if (!previous) await addPerson(treeId, member)
    else if (JSON.stringify(previous) !== JSON.stringify(person)) await editPerson(treeId, member)
  }
  for (const link of newParents.values()) {
    const previous = oldParents.get(`${link.child_id}|${link.parent_id}`)
    if (!previous || previous.kind !== link.kind) await addParentLink(link)
  }
  for (const link of newPartners.values()) {
    const previous = oldPartners.get(`${link.person_a}|${link.person_b}`)
    if (!previous) await addPartnerLink(link)
  }
  for (const personId of oldPeople.keys()) {
    if (!newPeople.has(personId)) await deletePerson(treeId, personId)
  }
}
