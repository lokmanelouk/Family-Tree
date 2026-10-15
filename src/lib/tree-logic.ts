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
      for (const peerId of [...person.spouseIds, ...(person.formerSpouseIds ?? []), ...person.siblingIds]) {
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
      for (const spouseId of [...child.spouseIds, ...(child.formerSpouseIds ?? [])]) {
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

/** Ancestor/descendant lineage plus direct siblings and their spouses for canvas emphasis. */
export function getLineageFocusIds(members: FamilyMember[], memberId: string): Set<string> {
  const byId = new Map(members.map((member) => [member.id, member]))
  const focus = new Set<string>()
  const ancestorsVisited = new Set<string>()
  const descendantsVisited = new Set<string>()
  const addAncestors = (id: string) => {
    if (ancestorsVisited.has(id)) return
    ancestorsVisited.add(id)
    focus.add(id)
    byId.get(id)?.parentIds.forEach(addAncestors)
  }
  const addDescendants = (id: string) => {
    if (descendantsVisited.has(id)) return
    descendantsVisited.add(id)
    focus.add(id)
    members.filter((member) => member.parentIds.includes(id)).forEach((child) => addDescendants(child.id))
  }
  addAncestors(memberId)
  addDescendants(memberId)
  const selected = byId.get(memberId)
  selected?.siblingIds.forEach((id) => focus.add(id))
  for (const id of [...focus]) byId.get(id)?.spouseIds.forEach((spouseId) => focus.add(spouseId))
  return focus
}

export function getHiddenIds(members: FamilyMember[], collapsedIds: Set<string>) {
  const hidden = new Set<string>()
  for (const id of collapsedIds) for (const childId of getDescendantIds(members, id)) hidden.add(childId)
  return hidden
}

/** Hide only the ancestor side of selected spouse nodes, preserving the spouse itself. */
export function getHiddenAncestorIds(members: FamilyMember[], collapsedAncestorIds: Set<string>) {
  const byId = new Map(members.map((member) => [member.id, member]))
  const hidden = new Set<string>()
  const visitParents = (id: string, visited: Set<string>) => {
    if (visited.has(id)) return
    visited.add(id)
    const person = byId.get(id)
    if (!person) return
    for (const parentId of person.parentIds) {
      hidden.add(parentId)
      visitParents(parentId, visited)
    }
  }
  for (const id of collapsedAncestorIds) visitParents(id, new Set())
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
    const sourceLinked = source.spouseIds.includes(target.id)
    const targetLinked = target.spouseIds.includes(source.id)
    if (sourceLinked && targetLinked) return 'These family members are already partners.'
    if (source.gender && target.gender && source.gender === target.gender) return 'Partners must be of different genders.'
    const female = source.gender === 'female' ? source : target.gender === 'female' ? target : undefined
    const malePartnerId = female === source ? target.id : source.id
    if (female && female.spouseIds.some((id) => id !== malePartnerId && members.find((member) => member.id === id)?.gender === 'male')) return 'A female family member can have only one husband.'
    if (source.siblingIds.includes(target.id) || target.siblingIds.includes(source.id) || source.parentIds.some((id) => target.parentIds.includes(id))) return 'Siblings cannot be linked as partners.'
    if (hasAncestor(members, source.id, target.id) || hasAncestor(members, target.id, source.id)) return 'A person cannot partner with their ancestor or descendant.'
    return null
  }
  if (kind === 'divorced') {
    if (!source.spouseIds.includes(target.id) || !target.spouseIds.includes(source.id)) return 'Only current partners can be marked as divorced.'
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
  const parent = members.find((member) => member.id === parentId)
  if (parent?.gender === 'male' && child.parentIds.some((id) => members.find((member) => member.id === id)?.gender === 'male')) return 'A person can have only one father.'
  if (parent?.gender === 'female' && child.parentIds.some((id) => members.find((member) => member.id === id)?.gender === 'female')) return 'A person can have only one mother.'
  if (child.parentIds.includes(parentId)) return kind === 'adopted' && child.adoptedParentIds?.includes(parentId) ? 'That adoption relationship already exists.' : 'That parent relationship already exists.'
  if (hasAncestor(members, childId, parentId)) return 'That would create a family cycle. A descendant cannot become an ancestor.'
  return null
}

export function applyRelationship(members: FamilyMember[], sourceId: string, targetId: string, kind: RelationshipKind): FamilyMember[] {
  const source = members.find((member) => member.id === sourceId)
  const target = members.find((member) => member.id === targetId)
  if (!source || !target || validateRelationship(members, sourceId, targetId, kind)) return members
  if (kind === 'partner') return members.map((member) => {
    if (member.id === sourceId) return { ...member, spouseIds: [...new Set([...member.spouseIds, targetId])], formerSpouseIds: member.formerSpouseIds?.filter((id) => id !== targetId) }
    if (member.id === targetId) return { ...member, spouseIds: [...new Set([...member.spouseIds, sourceId])], formerSpouseIds: member.formerSpouseIds?.filter((id) => id !== sourceId) }
    return member
  })
  if (kind === 'divorced') return members.map((member) => {
    if (member.id === sourceId) return { ...member, spouseIds: member.spouseIds.filter((id) => id !== targetId), formerSpouseIds: [...new Set([...(member.formerSpouseIds ?? []), targetId])] }
    if (member.id === targetId) return { ...member, spouseIds: member.spouseIds.filter((id) => id !== sourceId), formerSpouseIds: [...new Set([...(member.formerSpouseIds ?? []), sourceId])] }
    return member
  })
  if (kind === 'sibling') return members.map((member) => member.id === sourceId
    ? { ...member, siblingIds: [...new Set([...member.siblingIds, targetId])] }
    : member.id === targetId ? { ...member, siblingIds: [...member.siblingIds, sourceId] } : member)
  const parentId = kind === 'parent' ? targetId : sourceId
  const childId = kind === 'parent' ? sourceId : targetId
  const nextMembers = members.map((member) => member.id === childId ? {
    ...member,
    parentIds: [...member.parentIds, parentId],
    ...(kind === 'adopted' ? { adoptedParentIds: [...new Set([...(member.adoptedParentIds ?? []), parentId])] } : {}),
  } : member)
  return linkRecordedParentCouples(nextMembers)
}

/** Repair missing reciprocal partner links for an explicitly recorded parent pair. */
export function linkRecordedParentCouples(members: FamilyMember[]): FamilyMember[] {
  let result = members
  for (const child of members) {
    if (child.parentIds.length !== 2) continue
    const parents = child.parentIds.map((id) => result.find((member) => member.id === id)).filter((parent): parent is FamilyMember => Boolean(parent))
    const fathers = parents.filter((parent) => parent.gender === 'male')
    const mothers = parents.filter((parent) => parent.gender === 'female')
    if (parents.length !== 2 || fathers.length !== 1 || mothers.length !== 1) continue
    const [father] = fathers
    const [mother] = mothers
    if (father.formerSpouseIds?.includes(mother.id) || mother.formerSpouseIds?.includes(father.id)) continue
    if (father.spouseIds.includes(mother.id) && mother.spouseIds.includes(father.id)) continue
    result = applyRelationship(result, father.id, mother.id, 'partner')
  }
  return result
}

export function createRelatedMember(members: FamilyMember[], targetId: string, kind: RelationshipKind, name: string, id: string, birthDate?: string, photo?: string, avatar?: FamilyMember['avatar'], gender?: FamilyMember['gender'], fatherId?: string, motherId?: string, deathDate?: string, lifeStatus?: FamilyMember['lifeStatus']): FamilyMember[] {
  const target = members.find((member) => member.id === targetId)
  const cleanName = name.trim()
  if (!cleanName || members.some((member) => member.id === id)) return members
  if (kind === 'partner' && target) {
    if ((target.gender && gender && target.gender === gender) || !targetId) return members
    const female = gender === 'female' ? undefined : target
    if (female && female.spouseIds.some((spouseId) => members.find((member) => member.id === spouseId)?.gender === 'male')) return members
    if (kind === 'partner' && target.spouseIds.includes(id)) return members
  }
  const isDescendant = kind === 'child' || kind === 'sibling'
  const father = fatherId ? members.find((member) => member.id === fatherId) : undefined
  const mother = motherId ? members.find((member) => member.id === motherId) : undefined
  const parentPairLinked = Boolean(father && mother && (father.spouseIds.includes(mother.id) || mother.spouseIds.includes(father.id)))
  if (isDescendant && members.length && (!father && !mother
    || (father && father.gender !== 'male') || (mother && mother.gender !== 'female') || (father && mother && father.id === mother.id)
    || (father && mother && !parentPairLinked && validateRelationship(members, father.id, mother.id, 'partner') !== null))) return members
  if (isDescendant && kind === 'child' && target && father?.id !== target.id && mother?.id !== target.id) return members
  if (isDescendant && kind === 'sibling' && target && father && target.id !== father.id) return members
  if (kind === 'parent' && target && target.parentIds.some((parentId) => members.find((member) => member.id === parentId)?.gender === gender)) return members
  const names = cleanName.split(/\s+/)
  const looks = [
    { skin: '#d99c79', hair: '#53433b', shirt: '#f2bf7f', hairstyle: 'waves' as const },
    { skin: '#ecc09d', hair: '#6c4d3b', shirt: '#a9c8db', hairstyle: 'curls' as const },
    { skin: '#bd8062', hair: '#3f3935', shirt: '#c4b5dc', hairstyle: 'side' as const },
  ]
  if (!target && members.length > 0) return members
  const newMember: FamilyMember = {
    id, name: cleanName, initials: names.slice(0, 2).map((part) => part[0]).join('').toUpperCase(), gender, ...(birthDate ? { birthDate } : {}), ...(deathDate ? { deathDate } : {}), ...(lifeStatus ? { lifeStatus } : {}), ...(photo ? { photo } : {}),
    relationship: !target ? 'Family founder' : kind === 'partner' ? gender === 'male' ? 'Husband' : gender === 'female' ? 'Wife' : 'Partner' : kind === 'parent' ? gender === 'male' ? 'Father' : gender === 'female' ? 'Mother' : 'Parent' : gender === 'male' ? 'Son' : gender === 'female' ? 'Daughter' : 'Child',
    parentIds: isDescendant && members.length ? [father?.id, mother?.id].filter((parentId): parentId is string => Boolean(parentId)) : [], spouseIds: target && kind === 'partner' ? [target.id] : [], siblingIds: [],
    avatar: avatar ?? looks[cleanName.length % looks.length],
  }
  let result = [...members, newMember]
  // Recording a father and mother together also records their partnership, so
  // the pair is visible and can be edited consistently anywhere in the tree.
  if (isDescendant && father && mother) result = result.map((member) => {
    if (member.id === father.id) return { ...member, spouseIds: [...new Set([...member.spouseIds, mother.id])] }
    if (member.id === mother.id) return { ...member, spouseIds: [...new Set([...member.spouseIds, father.id])] }
    return member
  })
  if (target && kind === 'partner') return result.map((member) => member.id === target.id ? { ...member, spouseIds: [...member.spouseIds, id] } : member)
  if (target && kind === 'sibling') return result
  if (target && kind === 'parent') {
    result = result.map((member) => member.id === target.id ? { ...member, parentIds: [...new Set([...member.parentIds, id])] } : member)
    const child = result.find((member) => member.id === target.id)
    const parents = child?.parentIds.map((parentId) => result.find((member) => member.id === parentId)).filter((parent): parent is FamilyMember => Boolean(parent)) ?? []
    const father = parents.find((parent) => parent.gender === 'male')
    const mother = parents.find((parent) => parent.gender === 'female')
    if (father && mother && (father.spouseIds.includes(mother.id) || mother.spouseIds.includes(father.id)
      || validateRelationship(result, father.id, mother.id, 'partner') === null)) {
      result = result.map((member) => {
        if (member.id === father.id) return { ...member, spouseIds: [...new Set([...member.spouseIds, mother.id])] }
        if (member.id === mother.id) return { ...member, spouseIds: [...new Set([...member.spouseIds, father.id])] }
        return member
      })
    }
    return result
  }
  return result
}

export function removeMember(members: FamilyMember[], memberId: string) {
  return members.filter((member) => member.id !== memberId).map((member) => ({
    ...member,
    parentIds: member.parentIds.filter((id) => id !== memberId),
    spouseIds: member.spouseIds.filter((id) => id !== memberId),
    formerSpouseIds: member.formerSpouseIds?.filter((id) => id !== memberId),
    adoptedParentIds: member.adoptedParentIds?.filter((id) => id !== memberId),
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

export function updateMemberDetails(members: FamilyMember[], memberId: string, details: Pick<FamilyMember, 'name' | 'gender' | 'birthDate' | 'deathDate' | 'lifeStatus' | 'bio' | 'photo' | 'avatar'>): FamilyMember[] {
  const current = members.find((member) => member.id === memberId)
  const name = details.name.trim()
  if (!current || !name) return members
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase()
  const sameAvatar = current.avatar.skin === details.avatar.skin && current.avatar.hair === details.avatar.hair && current.avatar.shirt === details.avatar.shirt && current.avatar.hairstyle === details.avatar.hairstyle && current.avatar.accessory === details.avatar.accessory
  const unchanged = current.name === name && current.initials === initials && current.gender === details.gender && current.birthDate === details.birthDate && current.deathDate === details.deathDate && current.lifeStatus === details.lifeStatus && current.bio === details.bio && current.photo === details.photo && sameAvatar
  if (unchanged) return members
  return members.map((member) => member.id === memberId ? {
    ...member,
    name,
    initials,
    gender: details.gender,
    lifeStatus: details.lifeStatus,
    photo: details.photo,
    avatar: details.avatar,
    ...(details.birthDate ? { birthDate: details.birthDate } : { birthDate: undefined }),
    ...(details.deathDate ? { deathDate: details.deathDate } : { deathDate: undefined }),
    ...(details.bio?.trim() ? { bio: details.bio.trim() } : { bio: undefined }),
  } : member)
}
