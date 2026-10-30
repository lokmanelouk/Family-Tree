import type { FamilyMember } from '../types/family'

export type RelationshipPathStep = { fromId: string; toId: string; kind: 'parent' | 'child' | 'spouse' | 'former-spouse' | 'sibling' | 'adoptive-sibling' | 'adoptive-parent' | 'adopted-child' }
export type RelationshipResult = { titleKey: string; values?: Record<string, number>; pathIds: string[]; steps: RelationshipPathStep[] } | null
type KinshipTitle = string | { titleKey: string; values?: Record<string, number> }
type LineSide = 'maternal' | 'paternal'
type RelationshipGraph = { edges: Map<string, RelationshipPathStep[]>; childrenByParent: Map<string, string[]> }

export function getRelationshipPathStepLabelKey(kind: RelationshipPathStep['kind']) {
  if (kind === 'parent') return 'Child of'
  if (kind === 'adoptive-parent') return 'Adopted child of'
  if (kind === 'child') return 'Parent of'
  if (kind === 'adopted-child') return 'Adoptive parent of'
  if (kind === 'former-spouse') return 'Former spouse of'
  if (kind === 'spouse') return 'Spouse of'
  if (kind === 'adoptive-sibling') return 'Adoptive sibling of'
  return 'Sibling of'
}

function getSiblingEdgeKind(first: FamilyMember, second: FamilyMember): 'sibling' | 'adoptive-sibling' {
  const sharedParentIds = first.parentIds.filter((parentId) => second.parentIds.includes(parentId))
  return sharedParentIds.some((parentId) => first.adoptedParentIds?.includes(parentId) || second.adoptedParentIds?.includes(parentId))
    ? 'adoptive-sibling'
    : 'sibling'
}

function getGraph(members: FamilyMember[]) {
  const byId = new Map(members.map((member) => [member.id, member]))
  const edgesByPerson = new Map<string, RelationshipPathStep[]>()
  const childrenByParent = new Map<string, string[]>()
  const add = (fromId: string, toId: string, kind: RelationshipPathStep['kind']) => {
    if (fromId === toId || !byId.has(toId)) return
    const edges = edgesByPerson.get(fromId) ?? []
    if (!edges.some((edge) => edge.toId === toId && edge.kind === kind)) edges.push({ fromId, toId, kind })
    edgesByPerson.set(fromId, edges)
  }
  for (const person of members) {
    edgesByPerson.set(person.id, edgesByPerson.get(person.id) ?? [])
    person.parentIds.forEach((parentId) => {
      const adopted = person.adoptedParentIds?.includes(parentId) ?? false
      add(person.id, parentId, adopted ? 'adoptive-parent' : 'parent')
      add(parentId, person.id, adopted ? 'adopted-child' : 'child')
      if (byId.has(parentId)) childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), person.id])
    })
    person.siblingIds.forEach((siblingId) => {
      const sibling = byId.get(siblingId)
      const kind = sibling ? getSiblingEdgeKind(person, sibling) : 'sibling'
      add(person.id, siblingId, kind)
      add(siblingId, person.id, kind)
    })
  }
  const pairs = new Map<string, [FamilyMember, FamilyMember]>()
  for (const person of members) {
    for (const relativeId of [...person.spouseIds, ...(person.formerSpouseIds ?? [])]) {
      const relative = byId.get(relativeId)
      if (!relative) continue
      const pairKey = [person.id, relative.id].sort().join('|')
      pairs.set(pairKey, [person, relative])
    }
  }
  for (const [first, second] of pairs.values()) {
    const reciprocalCurrent = first.spouseIds.includes(second.id) && second.spouseIds.includes(first.id)
    const hasFormerRecord = Boolean(first.formerSpouseIds?.includes(second.id) || second.formerSpouseIds?.includes(first.id))
    const hasCurrentRecord = first.spouseIds.includes(second.id) || second.spouseIds.includes(first.id)
    const kind = reciprocalCurrent || (hasCurrentRecord && !hasFormerRecord) ? 'spouse' : 'former-spouse'
    add(first.id, second.id, kind)
    add(second.id, first.id, kind)
  }
  return { edges: edgesByPerson, childrenByParent }
}

function getAncestorDistances(members: FamilyMember[], startId: string) {
  const byId = new Map(members.map((member) => [member.id, member]))
  const distances = new Map([[startId, 0]])
  const queue = [startId]
  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index]
    const nextDistance = distances.get(currentId)! + 1
    for (const parentId of byId.get(currentId)?.parentIds ?? []) {
      if (distances.has(parentId) || !byId.has(parentId)) continue
      distances.set(parentId, nextDistance)
      queue.push(parentId)
    }
  }
  return distances
}

function getPath(graph: RelationshipGraph, members: FamilyMember[], startId: string, endId: string) {
  const byId = new Map(members.map((member) => [member.id, member]))
  const previous = new Map<string, RelationshipPathStep>()
  const visited = new Set([startId])
  const queue = [startId]
  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index]
    if (currentId === endId) break
    const current = byId.get(currentId)
    const inferredSiblingEdges = current ? current.parentIds.flatMap((parentId) => (graph.childrenByParent.get(parentId) ?? []).filter((siblingId) => siblingId !== currentId).map((siblingId) => {
      const sibling = byId.get(siblingId)
      return { fromId: currentId, toId: siblingId, kind: sibling ? getSiblingEdgeKind(current, sibling) : 'sibling' as const }
    })) : []
    for (const edge of [...(graph.edges.get(currentId) ?? []), ...inferredSiblingEdges]) {
      if (visited.has(edge.toId)) continue
      visited.add(edge.toId)
      previous.set(edge.toId, edge)
      queue.push(edge.toId)
    }
  }
  if (!visited.has(endId)) return null
  const steps: RelationshipPathStep[] = []
  let cursor = endId
  while (cursor !== startId) {
    const edge = previous.get(cursor)
    if (!edge) return null
    steps.push(edge)
    cursor = edge.fromId
  }
  steps.reverse()
  return { pathIds: [startId, ...steps.map((step) => step.toId)], steps }
}

function genderTitle(member: FamilyMember | undefined, maleKey: string, femaleKey: string, neutralKey: string) {
  return member?.gender === 'male' ? maleKey : member?.gender === 'female' ? femaleKey : neutralKey
}

function getLineSide(members: FamilyMember[], second: FamilyMember, ancestorId: string, distance: number): LineSide | null {
  if (distance !== 2) return null
  const byId = new Map(members.map((member) => [member.id, member]))
  const parentCandidates = second.parentIds
    .map((parentId) => byId.get(parentId))
    .filter((parent): parent is FamilyMember => Boolean(parent))
    .filter((parent) => parent.parentIds.includes(ancestorId))
  if (parentCandidates.length !== 1) return null
  const gender = parentCandidates[0].gender
  return gender === 'male' ? 'paternal' : gender === 'female' ? 'maternal' : null
}

function getGrandparentTitle(first: FamilyMember, side: LineSide | null): KinshipTitle {
  if (side === 'paternal') return genderTitle(first, 'Paternal grandfather', 'Paternal grandmother', 'Paternal grandparent')
  if (side === 'maternal') return genderTitle(first, 'Maternal grandfather', 'Maternal grandmother', 'Maternal grandparent')
  return genderTitle(first, 'Grandfather', 'Grandmother', 'Grandparent')
}

function getUncleTitle(first: FamilyMember, side: LineSide | null): KinshipTitle {
  if (side === 'paternal') return genderTitle(first, 'Paternal uncle', 'Paternal aunt', 'Paternal aunt or uncle')
  if (side === 'maternal') return genderTitle(first, 'Maternal uncle', 'Maternal aunt', 'Maternal aunt or uncle')
  return genderTitle(first, 'Uncle', 'Aunt', 'Aunt or uncle')
}

function getSiblingTitle(members: FamilyMember[], first: FamilyMember, second: FamilyMember): KinshipTitle {
  const byId = new Map(members.map((member) => [member.id, member]))
  const firstParents = [...new Set(first.parentIds)].filter((id) => byId.has(id))
  const secondParents = [...new Set(second.parentIds)].filter((id) => byId.has(id))
  const firstBiologicalParents = firstParents.filter((id) => !first.adoptedParentIds?.includes(id))
  const secondBiologicalParents = secondParents.filter((id) => !second.adoptedParentIds?.includes(id))
  const knownParentGenders = firstBiologicalParents.map((id) => byId.get(id)?.gender)
  const sameTwoBiologicalParents = firstBiologicalParents.length === 2
    && secondBiologicalParents.length === 2
    && firstBiologicalParents.every((id) => secondBiologicalParents.includes(id))
    && secondBiologicalParents.every((id) => firstBiologicalParents.includes(id))
    && knownParentGenders.includes('male')
    && knownParentGenders.includes('female')
  if (sameTwoBiologicalParents) return genderTitle(first, 'Brother', 'Sister', 'Sibling')

  const firstFatherIds = firstBiologicalParents.filter((id) => byId.get(id)?.gender === 'male')
  const secondFatherIds = secondBiologicalParents.filter((id) => byId.get(id)?.gender === 'male')
  const firstMotherIds = firstBiologicalParents.filter((id) => byId.get(id)?.gender === 'female')
  const secondMotherIds = secondBiologicalParents.filter((id) => byId.get(id)?.gender === 'female')
  const sharedFathers = firstFatherIds.filter((id) => secondFatherIds.includes(id))
  const sharedMothers = firstMotherIds.filter((id) => secondMotherIds.includes(id))
  const hasDifferentKnownFathers = firstFatherIds.length === 1 && secondFatherIds.length === 1 && firstFatherIds[0] !== secondFatherIds[0]
  const hasDifferentKnownMothers = firstMotherIds.length === 1 && secondMotherIds.length === 1 && firstMotherIds[0] !== secondMotherIds[0]

  if (firstBiologicalParents.length === 2 && secondBiologicalParents.length === 2 && sharedMothers.length === 1 && sharedFathers.length === 0 && hasDifferentKnownFathers) {
    return genderTitle(first, 'Maternal half-brother', 'Maternal half-sister', 'Maternal half-sibling')
  }
  if (firstBiologicalParents.length === 2 && secondBiologicalParents.length === 2 && sharedFathers.length === 1 && sharedMothers.length === 0 && hasDifferentKnownMothers) {
    return genderTitle(first, 'Paternal half-brother', 'Paternal half-sister', 'Paternal half-sibling')
  }

  const sharedParents = firstParents.filter((id) => secondParents.includes(id))
  if (sharedParents.some((id) => first.adoptedParentIds?.includes(id) || second.adoptedParentIds?.includes(id))) {
    return genderTitle(first, 'Adoptive brother', 'Adoptive sister', 'Adoptive sibling')
  }
  return 'Sibling'
}

function areSiblings(first: FamilyMember, second: FamilyMember) {
  return first.siblingIds.includes(second.id) || second.siblingIds.includes(first.id) || first.parentIds.some((parentId) => second.parentIds.includes(parentId))
}

function areCurrentSpouses(first: FamilyMember, second: FamilyMember) {
  const hasCurrentRecord = first.spouseIds.includes(second.id) || second.spouseIds.includes(first.id)
  const isReciprocalCurrent = first.spouseIds.includes(second.id) && second.spouseIds.includes(first.id)
  const hasFormerRecord = first.formerSpouseIds?.includes(second.id) || second.formerSpouseIds?.includes(first.id)
  return isReciprocalCurrent || (hasCurrentRecord && !hasFormerRecord)
}

function getMarriageRelativeTitle(members: FamilyMember[], first: FamilyMember, second: FamilyMember, steps: RelationshipPathStep[]): KinshipTitle | null {
  if (steps.length === 2) {
  const kinds = steps.map((step) => step.kind)
  const parentToChild = (kind: RelationshipPathStep['kind']) => kind === 'child' || kind === 'adopted-child'
  const childToParent = (kind: RelationshipPathStep['kind']) => kind === 'parent' || kind === 'adoptive-parent'
  const siblingKind = (kind: RelationshipPathStep['kind']) => kind === 'sibling' || kind === 'adoptive-sibling'
  if ((kinds[0] === 'spouse' && siblingKind(kinds[1])) || (siblingKind(kinds[0]) && kinds[1] === 'spouse')) return 'Sibling-in-law'
  if (parentToChild(kinds[0]) && kinds[1] === 'spouse') return 'Parent-in-law'
  if (kinds[0] === 'spouse' && childToParent(kinds[1])) return 'Child-in-law'
  if (kinds[0] === 'spouse' && parentToChild(kinds[1])) return 'Step-parent'
  if (childToParent(kinds[0]) && kinds[1] === 'spouse') return 'Step-child'
  }
  const spouseOfSecond = members.find((member) => member.id !== first.id && areCurrentSpouses(member, second) && areSiblings(first, member))
  if (spouseOfSecond) return 'Sibling-in-law'
  const spouseOfFirst = members.find((member) => member.id !== second.id && areCurrentSpouses(member, first) && areSiblings(member, second))
  if (spouseOfFirst) return 'Sibling-in-law'
  const firstChild = members.find((member) => member.parentIds.includes(first.id) && areCurrentSpouses(member, second))
  if (firstChild) return 'Parent-in-law'
  const secondChild = members.find((member) => member.parentIds.includes(second.id) && areCurrentSpouses(member, first))
  if (secondChild) return 'Child-in-law'
  const secondParentSpouse = second.parentIds.map((parentId) => members.find((member) => member.id === parentId)).find((parent): parent is FamilyMember => Boolean(parent && areCurrentSpouses(first, parent)))
  if (secondParentSpouse) return 'Step-parent'
  const firstParentSpouse = first.parentIds.map((parentId) => members.find((member) => member.id === parentId)).find((parent): parent is FamilyMember => Boolean(parent && areCurrentSpouses(second, parent)))
  if (firstParentSpouse) return 'Step-child'
  return null
}

function getBloodTitle(members: FamilyMember[], first: FamilyMember, second: FamilyMember, firstDistance: number, secondDistance: number, side: LineSide | null): KinshipTitle {
  if (firstDistance === 0 && secondDistance === 1) return 'Parent'
  if (firstDistance === 1 && secondDistance === 0) return 'Child'
  if (firstDistance === 1 && secondDistance === 1) return getSiblingTitle(members, first, second)
  if (firstDistance === 0 && secondDistance === 2) return getGrandparentTitle(first, side)
  if (firstDistance === 0 && secondDistance > 2) return 'Great-grandparent'
  if (firstDistance === 2 && secondDistance === 0) return 'Grandchild'
  if (firstDistance > 2 && secondDistance === 0) return 'Great-grandchild'
  if (firstDistance === 1 && secondDistance === 2) return getUncleTitle(first, side)
  if (firstDistance === 1 && secondDistance > 2) return genderTitle(first, 'Great-uncle', 'Great-aunt', 'Aunt or uncle')
  if (firstDistance >= 2 && secondDistance === 1) return genderTitle(first, 'Nephew', 'Niece', 'Niece or nephew')
  if (firstDistance >= 2 && secondDistance >= 2) {
    const degree = Math.min(firstDistance, secondDistance) - 1
    const removed = Math.abs(firstDistance - secondDistance)
    return removed ? { titleKey: 'Cousin, {degree} times removed', values: { degree: removed } } : degree === 1 ? 'Cousin' : { titleKey: 'Cousin, {degree} degree', values: { degree } }
  }
  return 'Related family member'
}

function titleIdentity(title: KinshipTitle) {
  return typeof title === 'string' ? title : `${title.titleKey}:${JSON.stringify(title.values ?? {})}`
}

function getKinshipTitle(members: FamilyMember[], first: FamilyMember, second: FamilyMember, steps: RelationshipPathStep[]): KinshipTitle {
  if (steps.length === 1) {
    const kind = steps[0].kind
    if (kind === 'spouse') return 'Spouse'
    if (kind === 'former-spouse') return 'Former spouse'
    if (kind === 'sibling' || kind === 'adoptive-sibling') return getSiblingTitle(members, first, second)
    if (kind === 'adoptive-parent') return 'Adopted child'
    if (kind === 'adopted-child') return 'Adoptive parent'
    if (kind === 'child') return 'Parent'
    if (kind === 'parent') return 'Child'
  }
  const marriageTitle = getMarriageRelativeTitle(members, first, second, steps)
  if (marriageTitle) return marriageTitle
  const firstAncestors = getAncestorDistances(members, first.id)
  const secondAncestors = getAncestorDistances(members, second.id)
  const shared = [...firstAncestors.keys()].filter((id) => secondAncestors.has(id))
    .map((id) => ({ id, firstDistance: firstAncestors.get(id)!, secondDistance: secondAncestors.get(id)! }))
    .sort((a, b) => (a.firstDistance + a.secondDistance) - (b.firstDistance + b.secondDistance))
  if (!shared.length) return steps.some((step) => step.kind === 'spouse' || step.kind === 'former-spouse') ? 'Connected through marriage' : 'Related family member'
  const shortestDistance = shared[0].firstDistance + shared[0].secondDistance
  const closest = shared.filter((candidate) => candidate.firstDistance + candidate.secondDistance === shortestDistance)
  const titles = closest.map((candidate) => getBloodTitle(members, first, second, candidate.firstDistance, candidate.secondDistance, getLineSide(members, second, candidate.id, candidate.secondDistance)))
  const uniqueTitles = new Map(titles.map((title) => [titleIdentity(title), title]))
  if (uniqueTitles.size === 1) return [...uniqueTitles.values()][0]
  const distances = new Set(closest.map(({ firstDistance, secondDistance }) => `${firstDistance}:${secondDistance}`))
  if (distances.size !== 1) return 'Related family member'
  const { firstDistance, secondDistance } = closest[0]
  return getBloodTitle(members, first, second, firstDistance, secondDistance, null)
}

export function calculateRelationship(members: FamilyMember[], firstId: string, secondId: string): RelationshipResult {
  if (firstId === secondId) return null
  const first = members.find((member) => member.id === firstId)
  const second = members.find((member) => member.id === secondId)
  if (!first || !second) return null
  const route = getPath(getGraph(members), members, firstId, secondId)
  if (!route) return null
  const title = getKinshipTitle(members, first, second, route.steps)
  return { titleKey: typeof title === 'string' ? title : title.titleKey, ...((typeof title === 'string' || !title.values) ? {} : { values: title.values }), ...route }
}
