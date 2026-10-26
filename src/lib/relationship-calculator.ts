import type { FamilyMember } from '../types/family'

export type RelationshipPathStep = { fromId: string; toId: string; kind: 'parent' | 'child' | 'spouse' | 'sibling' }
export type RelationshipResult = { titleKey: string; values?: Record<string, number>; pathIds: string[]; steps: RelationshipPathStep[] } | null
type KinshipTitle = string | { titleKey: string; values?: Record<string, number> }

export function getRelationshipPathStepLabelKey(kind: RelationshipPathStep['kind']) {
  if (kind === 'parent') return 'Child of'
  if (kind === 'child') return 'Parent of'
  if (kind === 'spouse') return 'Spouse of'
  return 'Sibling of'
}

function getGraph(members: FamilyMember[]) {
  const graph = new Map<string, RelationshipPathStep[]>()
  const add = (fromId: string, toId: string, kind: RelationshipPathStep['kind']) => {
    if (fromId === toId || !members.some((member) => member.id === toId)) return
    const edges = graph.get(fromId) ?? []
    if (!edges.some((edge) => edge.toId === toId && edge.kind === kind)) edges.push({ fromId, toId, kind })
    graph.set(fromId, edges)
  }
  for (const person of members) {
    graph.set(person.id, graph.get(person.id) ?? [])
    person.parentIds.forEach((parentId) => {
      add(person.id, parentId, 'parent')
      add(parentId, person.id, 'child')
    })
    person.spouseIds.forEach((spouseId) => {
      add(person.id, spouseId, 'spouse')
      add(spouseId, person.id, 'spouse')
    })
    person.formerSpouseIds?.forEach((spouseId) => {
      add(person.id, spouseId, 'spouse')
      add(spouseId, person.id, 'spouse')
    })
    person.siblingIds.forEach((siblingId) => {
      add(person.id, siblingId, 'sibling')
      add(siblingId, person.id, 'sibling')
    })
  }
  return graph
}

function getAncestorDistances(members: FamilyMember[], startId: string) {
  const byId = new Map(members.map((member) => [member.id, member]))
  const distances = new Map([[startId, 0]])
  const queue = [startId]
  while (queue.length) {
    const currentId = queue.shift()!
    const nextDistance = distances.get(currentId)! + 1
    for (const parentId of byId.get(currentId)?.parentIds ?? []) {
      if (distances.has(parentId) || !byId.has(parentId)) continue
      distances.set(parentId, nextDistance)
      queue.push(parentId)
    }
  }
  return distances
}

function getPath(graph: Map<string, RelationshipPathStep[]>, startId: string, endId: string) {
  const previous = new Map<string, RelationshipPathStep>()
  const visited = new Set([startId])
  const queue = [startId]
  while (queue.length) {
    const currentId = queue.shift()!
    if (currentId === endId) break
    for (const edge of graph.get(currentId) ?? []) {
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

function getKinshipTitle(members: FamilyMember[], first: FamilyMember, second: FamilyMember): KinshipTitle {
  if (first.spouseIds.includes(second.id) || second.spouseIds.includes(first.id) || first.formerSpouseIds?.includes(second.id) || second.formerSpouseIds?.includes(first.id)) return 'Spouse'
  if (first.siblingIds.includes(second.id) || second.siblingIds.includes(first.id)) return 'Sibling'
  const firstAncestors = getAncestorDistances(members, first.id)
  const secondAncestors = getAncestorDistances(members, second.id)
  const shared = [...firstAncestors.keys()].filter((id) => secondAncestors.has(id))
    .sort((a, b) => (firstAncestors.get(a)! + secondAncestors.get(a)!) - (firstAncestors.get(b)! + secondAncestors.get(b)!))
  if (!shared.length) return 'Connected through marriage'
  const ancestorId = shared[0]
  const firstDistance = firstAncestors.get(ancestorId)!
  const secondDistance = secondAncestors.get(ancestorId)!
  if (firstDistance === 0 && secondDistance === 1) return 'Parent'
  if (firstDistance === 1 && secondDistance === 0) return 'Child'
  if (firstDistance === 1 && secondDistance === 1) return 'Sibling'
  if (firstDistance === 0 && secondDistance >= 2) return secondDistance === 2 ? 'Grandparent' : 'Great-grandparent'
  if (firstDistance >= 2 && secondDistance === 0) return firstDistance === 2 ? 'Grandchild' : 'Great-grandchild'
  if (firstDistance === 1 && secondDistance >= 2) {
    if (secondDistance === 2) return genderTitle(first, 'Uncle', 'Aunt', 'Aunt or uncle')
    return genderTitle(first, 'Great-uncle', 'Great-aunt', 'Aunt or uncle')
  }
  if (firstDistance >= 2 && secondDistance === 1) {
    if (firstDistance === 2) return genderTitle(first, 'Nephew', 'Niece', 'Niece or nephew')
    return genderTitle(first, 'Great-nephew', 'Great-niece', 'Niece or nephew')
  }
  if (firstDistance >= 2 && secondDistance >= 2) {
    const degree = Math.min(firstDistance, secondDistance) - 1
    const removed = Math.abs(firstDistance - secondDistance)
    return removed ? { titleKey: 'Cousin, {degree} times removed', values: { degree: removed } } : degree === 1 ? 'Cousin' : { titleKey: 'Cousin, {degree} degree', values: { degree } }
  }
  return 'Connected through marriage'
}

export function calculateRelationship(members: FamilyMember[], firstId: string, secondId: string): RelationshipResult {
  if (firstId === secondId) return null
  const first = members.find((member) => member.id === firstId)
  const second = members.find((member) => member.id === secondId)
  if (!first || !second) return null
  const route = getPath(getGraph(members), firstId, secondId)
  if (!route) return null
  const title = getKinshipTitle(members, first, second)
  return { titleKey: typeof title === 'string' ? title : title.titleKey, ...((typeof title === 'string' || !title.values) ? {} : { values: title.values }), ...route }
}
