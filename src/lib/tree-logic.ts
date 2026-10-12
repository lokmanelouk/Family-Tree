import type { FamilyMember, RelationshipKind } from '../types/family'

export function getChildren(members: FamilyMember[], memberId: string) {
  return members.filter((member) => member.parentIds.includes(memberId))
}

export function getGenerationMap(members: FamilyMember[]) {
  const byId = new Map(members.map((member) => [member.id, member]))
  const generations = new Map(members.map((member) => [member.id, 0]))
  // Spouses share a display generation; propagate parent depth through those pairs.
  for (let pass = 0; pass <= members.length; pass += 1) {
    let changed = false
    for (const person of members) {
      const parentDepth = Math.max(0, ...person.parentIds.filter((id) => byId.has(id)).map((id) => (generations.get(id) ?? 0) + 1))
      if (parentDepth > (generations.get(person.id) ?? 0)) { generations.set(person.id, parentDepth); changed = true }
      for (const peerId of [...person.spouseIds, ...person.siblingIds]) {
        const spouseDepth = generations.get(peerId)
        if (spouseDepth === undefined) continue
        const depth = Math.max(generations.get(person.id) ?? 0, spouseDepth)
        if (depth !== generations.get(person.id) || depth !== spouseDepth) { generations.set(person.id, depth); generations.set(peerId, depth); changed = true }
      }
    }
    if (!changed) break
  }
  return generations
}

export function getChildCounts(members: FamilyMember[]) {
  const counts = new Map(members.map((member) => [member.id, 0]))
  for (const member of members) for (const parentId of member.parentIds) counts.set(parentId, (counts.get(parentId) ?? 0) + 1)
  return counts
}

/** Return explicit sibling links once per pair, independent of node coordinates. */
export function getSiblingPairs(members: FamilyMember[], visibleIds?: Set<string>) {
  const byId = new Map(members.map((member) => [member.id, member]))
  const pairs: Array<[FamilyMember, FamilyMember]> = []
  const seen = new Set<string>()
  for (const member of members) for (const siblingId of member.siblingIds) {
    const sibling = byId.get(siblingId)
    if (!sibling || (visibleIds && (!visibleIds.has(member.id) || !visibleIds.has(siblingId)))) continue
    const [first, second] = [member, sibling].sort((a, b) => a.id.localeCompare(b.id))
    const key = `${first.id}|${second.id}`
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push([first, second])
  }
  return pairs
}

/** Parent edges already show siblings with a shared parent; direct sibling lines are for the rest. */
export function getSiblingConnectorPairs(members: FamilyMember[], visibleIds?: Set<string>) {
  return getSiblingPairs(members, visibleIds).filter(([first, second]) => !first.parentIds.some((id) => second.parentIds.includes(id)))
}

export function getDescendantIds(members: FamilyMember[], memberId: string): Set<string> {
  const descendants = new Set<string>()
  const visit = (id: string) => {
    for (const child of getChildren(members, id)) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id)
        visit(child.id)
      }
      for (const spouseId of child.spouseIds) {
        if (!descendants.has(spouseId)) {
          descendants.add(spouseId)
          visit(spouseId)
        }
      }
    }
  }
  visit(memberId)
  return descendants
}

export function getHiddenIds(members: FamilyMember[], collapsedIds: Set<string>) {
  const hidden = new Set<string>()
  for (const id of collapsedIds) for (const childId of getDescendantIds(members, id)) hidden.add(childId)
  return hidden
}

function hasAncestor(members: FamilyMember[], ancestorId: string, personId: string, visited = new Set<string>()): boolean {
  if (visited.has(personId)) return false
  visited.add(personId)
  const person = members.find((member) => member.id === personId)
  if (!person) return false
  return person.parentIds.some((parentId) => parentId === ancestorId || hasAncestor(members, ancestorId, parentId, visited))
}

export function validateRelationship(members: FamilyMember[], sourceId: string, targetId: string, kind: RelationshipKind): string | null {
  if (sourceId === targetId) return 'A person cannot be related to themselves.'
  const source = members.find((member) => member.id === sourceId)
  const target = members.find((member) => member.id === targetId)
  if (!source || !target) return 'One of those family members could not be found.'
  if (kind === 'partner') {
    if (source.spouseIds.includes(target.id) || target.spouseIds.includes(source.id)) return 'These family members are already partners.'
    if (source.siblingIds.includes(target.id) || target.siblingIds.includes(source.id) || source.parentIds.some((id) => target.parentIds.includes(id))) return 'Siblings cannot be linked as partners.'
    if (hasAncestor(members, source.id, target.id) || hasAncestor(members, target.id, source.id)) return 'A person cannot partner with their ancestor or descendant.'
    return null
  }
  if (kind === 'sibling') {
    if (source.siblingIds.includes(target.id) || target.siblingIds.includes(source.id)) return 'These family members are already siblings.'
    if (hasAncestor(members, source.id, target.id) || hasAncestor(members, target.id, source.id)) return 'An ancestor and descendant cannot be linked as siblings.'
    return null
  }
  const parentId = kind === 'parent' ? target.id : source.id
  const childId = kind === 'parent' ? source.id : target.id
  const child = members.find((member) => member.id === childId)
  if (!child) return 'The child could not be found.'
  if (child.parentIds.includes(parentId)) return 'That parent relationship already exists.'
  if (hasAncestor(members, childId, parentId)) return 'That would create a family cycle. A descendant cannot become an ancestor.'
  return null
}

export function applyRelationship(members: FamilyMember[], sourceId: string, targetId: string, kind: RelationshipKind): FamilyMember[] {
  const source = members.find((member) => member.id === sourceId)
  const target = members.find((member) => member.id === targetId)
  if (!source || !target || validateRelationship(members, sourceId, targetId, kind)) return members
  if (kind === 'partner') return members.map((member) => {
    if (member.id === sourceId) return { ...member, spouseIds: [...new Set([...member.spouseIds, targetId])] }
    if (member.id === targetId) return { ...member, spouseIds: [...new Set([...member.spouseIds, sourceId])] }
    return member
  })
  if (kind === 'sibling') return members.map((member) => member.id === sourceId
    ? { ...member, siblingIds: [...member.siblingIds, targetId], relationship: 'Sibling' }
    : member.id === targetId ? { ...member, siblingIds: [...member.siblingIds, sourceId] } : member)
  const parentId = kind === 'parent' ? targetId : sourceId
  const childId = kind === 'parent' ? sourceId : targetId
  const nextMembers = members.map((member) => member.id === childId ? { ...member, parentIds: [...member.parentIds, parentId] } : member)
  return nextMembers
}

export function createRelatedMember(members: FamilyMember[], targetId: string, kind: RelationshipKind, name: string, id: string, birthDate?: string, photo?: string, avatar?: FamilyMember['avatar']): FamilyMember[] {
  const target = members.find((member) => member.id === targetId)
  const cleanName = name.trim()
  if (!cleanName || members.some((member) => member.id === id)) return members
  const names = cleanName.split(/\s+/)
  const looks = [
    { skin: '#d99c79', hair: '#53433b', shirt: '#f2bf7f', hairstyle: 'waves' as const },
    { skin: '#ecc09d', hair: '#6c4d3b', shirt: '#a9c8db', hairstyle: 'curls' as const },
    { skin: '#bd8062', hair: '#3f3935', shirt: '#c4b5dc', hairstyle: 'side' as const },
  ]
  if (!target && members.length > 0) return members
  const newMember: FamilyMember = {
    id, name: cleanName, initials: names.slice(0, 2).map((part) => part[0]).join('').toUpperCase(), ...(birthDate ? { birthDate } : {}), ...(photo ? { photo } : {}),
    relationship: target ? kind === 'partner' ? 'Partner' : kind === 'sibling' ? 'Sibling' : kind === 'parent' ? 'Parent' : 'Child' : 'Family founder',
    parentIds: target ? kind === 'child' ? [target.id] : kind === 'sibling' ? [...target.parentIds] : [] : [], spouseIds: target && kind === 'partner' ? [target.id] : [], siblingIds: target && kind === 'sibling' ? [target.id] : [],
    avatar: avatar ?? looks[cleanName.length % looks.length],
  }
  const result = [...members, newMember]
  if (target && kind === 'partner') return result.map((member) => member.id === target.id ? { ...member, spouseIds: [...member.spouseIds, id] } : member)
  if (target && kind === 'sibling') return result.map((member) => member.id === target.id ? { ...member, siblingIds: [...member.siblingIds, id] } : member)
  if (target && kind === 'parent') return result.map((member) => member.id === target.id ? { ...member, parentIds: [...member.parentIds, id] } : member)
  return result
}

export function removeMember(members: FamilyMember[], memberId: string) {
  return members.filter((member) => member.id !== memberId).map((member) => ({
    ...member,
    parentIds: member.parentIds.filter((id) => id !== memberId),
    spouseIds: member.spouseIds.filter((id) => id !== memberId),
    siblingIds: member.siblingIds.filter((id) => id !== memberId),
  }))
}

export function updateMemberProfile(members: FamilyMember[], memberId: string, photo: string | undefined, avatar: FamilyMember['avatar']): FamilyMember[] {
  const current = members.find((member) => member.id === memberId)
  if (!current) return members
  const sameAvatar = current.avatar.skin === avatar.skin && current.avatar.hair === avatar.hair && current.avatar.shirt === avatar.shirt && current.avatar.hairstyle === avatar.hairstyle && current.avatar.accessory === avatar.accessory
  if (current.photo === photo && sameAvatar) return members
  return members.map((member) => member.id === memberId ? { ...member, photo, avatar } : member)
}
