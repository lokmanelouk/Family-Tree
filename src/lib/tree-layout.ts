import type { FamilyMember } from '../types/family'
import { getGenerationMap } from './tree-logic.ts'

export type TreeNodeMode = 'rectangle' | 'circle'
export type TreePosition = { x: number; y: number; generation: number }
export type TreeLayout = { positions: Map<string, TreePosition>; width: number; height: number; nodeWidth: number; nodeHeight: number }

/** Route relationship-derived parent unions to every child card, even when the family is asymmetric. */
export function getParentChildConnectorPaths(parents: TreePosition[], children: TreePosition[], nodeWidth: number, nodeHeight: number): string[] {
  if (!parents.length || !children.length) return []
  const unionY = Math.max(...parents.map((point) => point.y + nodeHeight)) + 30
  const parentXs = parents.map((point) => point.x + nodeWidth / 2)
  const unionLeft = Math.min(...parentXs)
  const unionRight = Math.max(...parentXs)
  const unionCenter = (unionLeft + unionRight) / 2
  const childrenY = Math.min(...children.map((point) => point.y))
  const branchY = Math.min(childrenY - 30, unionY + 30)
  const childXs = children.map((point) => point.x + nodeWidth / 2)
  const branchLeft = Math.min(unionCenter, ...childXs)
  const branchRight = Math.max(unionCenter, ...childXs)
  const paths = parents.map((point) => {
    const x = point.x + nodeWidth / 2
    return `M ${x} ${point.y + nodeHeight} V ${unionY}`
  })
  if (unionRight > unionLeft) paths.push(`M ${unionLeft} ${unionY} H ${unionRight}`)
  paths.push(`M ${unionCenter} ${unionY} V ${branchY}`)
  if (branchRight > branchLeft) paths.push(`M ${branchLeft} ${branchY} H ${branchRight}`)
  children.forEach((point) => paths.push(`M ${point.x + nodeWidth / 2} ${branchY} V ${point.y}`))
  return paths
}

export function getSiblingConnectorPath(a: TreePosition, b: TreePosition, nodeWidth: number, nodeHeight: number): string | null {
  if (a.generation !== b.generation) return null
  const [left, right] = a.x <= b.x ? [a, b] : [b, a]
  const startX = left.x + nodeWidth / 2
  const endX = right.x + nodeWidth / 2
  const startY = left.y + nodeHeight
  return `M ${startX} ${startY} V ${startY + 18} H ${endX} V ${startY}`
}

/** Derive generation rows from parent links; layout coordinates never enter family records. */
export function computeTreeLayout(members: FamilyMember[], mode: TreeNodeMode = 'rectangle'): TreeLayout {
  const nodeWidth = mode === 'circle' ? 160 : 240
  const nodeHeight = mode === 'circle' ? 172 : 106
  const gapX = mode === 'circle' ? 58 : 50
  const generations = getGenerationMap(members)
  const rows = new Map<number, FamilyMember[]>()
  for (const member of members) {
    const generation = generations.get(member.id) ?? 0
    rows.set(generation, [...(rows.get(generation) ?? []), member])
  }
  const levels = [...rows.keys()].sort((a, b) => a - b)
  const ordered = new Map<number, FamilyMember[]>()
  const centers = new Map<string, number>()
  // Order each generation around the center of its parents and keep partners adjacent.
  for (const level of levels) {
    const row = rows.get(level) ?? []
    const score = (person: FamilyMember) => {
      const parents = person.parentIds.map((id) => centers.get(id)).filter((x): x is number => x !== undefined)
      return parents.length ? parents.reduce((sum, x) => sum + x, 0) / parents.length : Number.POSITIVE_INFINITY
    }
    const remaining = new Map(row.map((person) => [person.id, person]))
    const arranged: FamilyMember[] = []
    while (remaining.size) {
      const next = [...remaining.values()].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))[0]
      arranged.push(next)
      remaining.delete(next.id)
      const partners = next.spouseIds.map((id) => remaining.get(id)).filter((person): person is FamilyMember => Boolean(person))
        .sort((a, b) => score(a) - score(b))
      for (const partner of partners) { arranged.push(partner); remaining.delete(partner.id) }
    }
    ordered.set(level, arranged)
    const rowWidth = arranged.length * nodeWidth + Math.max(0, arranged.length - 1) * gapX
    const start = -rowWidth / 2 + nodeWidth / 2
    arranged.forEach((person, index) => centers.set(person.id, start + index * (nodeWidth + gapX)))
  }
  const maxRow = Math.max(1, ...[...ordered.values()].map((row) => row.length))
  const width = Math.max(940, maxRow * (nodeWidth + gapX) + 140)
  const height = Math.max(380, levels.length * (nodeHeight + 100) + 64)
  const positions = new Map<string, TreePosition>()
  for (const level of levels) {
    const row = ordered.get(level) ?? []
    const rowWidth = row.length * nodeWidth + Math.max(0, row.length - 1) * gapX
    const left = (width - rowWidth) / 2
    row.forEach((person, index) => positions.set(person.id, {
      x: left + index * (nodeWidth + gapX),
      y: 32 + levels.indexOf(level) * (nodeHeight + 100),
      generation: level,
    }))
  }
  return { positions, width, height, nodeWidth, nodeHeight }
}

export function getImmediateFamilyIds(members: FamilyMember[], memberId: string): Set<string> {
  const person = members.find((member) => member.id === memberId)
  if (!person) return new Set()
  return new Set([memberId, ...person.parentIds, ...person.spouseIds, ...person.siblingIds,
    ...members.filter((member) => member.parentIds.includes(memberId)).map((member) => member.id)])
}

/** Assign a stable origin only when a person has exactly one root family lineage. */
export function getRootBranchMap(members: FamilyMember[]): Map<string, string | null> {
  const byId = new Map(members.map((member) => [member.id, member]))
  const rootsByPerson = new Map<string, Set<string>>()
  const getRoots = (person: FamilyMember, active = new Set<string>()): Set<string> => {
    const cached = rootsByPerson.get(person.id)
    if (cached) return cached
    if (active.has(person.id)) return new Set()
    const nextActive = new Set(active).add(person.id)
    const parents = person.parentIds.map((id) => byId.get(id)).filter((item): item is FamilyMember => Boolean(item))
    if (!parents.length) {
      const partnerRoot = person.spouseIds.map((id) => byId.get(id)).find((item) => item && item.parentIds.length === 0)
      const roots = new Set([partnerRoot ? [person.id, partnerRoot.id].sort().join('+') : person.id])
      rootsByPerson.set(person.id, roots)
      return roots
    }
    const roots = new Set(parents.flatMap((parent) => [...getRoots(parent, nextActive)]))
    rootsByPerson.set(person.id, roots)
    return roots
  }
  for (const person of members) getRoots(person)
  const branchIds = [...new Set([...rootsByPerson.values()].flatMap((roots) => [...roots]))].sort()
  const paletteIndex = new Map(branchIds.map((id, index) => [id, index < 6 ? index : null]))
  return new Map(members.map((person) => {
    const roots = rootsByPerson.get(person.id) ?? new Set<string>()
    const colors = [...roots].map((root) => paletteIndex.get(root)).filter((color): color is number => color !== null && color !== undefined).sort((a, b) => a - b)
    if (!colors.length || colors.length !== roots.size) return [person.id, null]
    let color = `var(--branch-${colors[0]})`
    colors.slice(1).forEach((nextColor, index) => {
      const previousCount = index + 1
      color = `color-mix(in srgb, ${color} ${Math.round(previousCount / (previousCount + 1) * 100)}%, var(--branch-${nextColor}))`
    })
    return [person.id, color]
  }))
}

export type RootFamilyBranch = { id: string; member: FamilyMember; partner: FamilyMember | null; color: string | null }

/** List each parentless founder once, grouping two root spouses as one navigable branch. */
export function getRootBranches(members: FamilyMember[]): RootFamilyBranch[] {
  const byId = new Map(members.map((member) => [member.id, member]))
  const colors = getRootBranchMap(members)
  const visited = new Set<string>()
  const branches: RootFamilyBranch[] = []
  for (const member of members) {
    if (member.parentIds.length || visited.has(member.id)) continue
    const partner = member.spouseIds.map((id) => byId.get(id)).find((candidate) => candidate && !candidate.parentIds.length && !visited.has(candidate.id)) ?? null
    visited.add(member.id)
    if (partner) visited.add(partner.id)
    branches.push({ id: member.id, member, partner, color: colors.get(member.id) ?? null })
  }
  return branches
}
