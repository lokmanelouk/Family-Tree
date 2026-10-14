import type { FamilyMember } from '../types/family'
import { getGenerationMap } from './tree-logic.ts'

export type TreeNodeMode = 'rectangle' | 'circle'
export type TreePosition = { x: number; y: number; generation: number }
export type TreeLayout = { positions: Map<string, TreePosition>; width: number; height: number; nodeWidth: number; nodeHeight: number }
export type SpouseConnector = { path: string; anchorX: number; anchorY: number }
export const MARRIAGE_ANCHOR_RADIUS = 12
export const CIRCULAR_AVATAR_CENTER_Y = 42.5
export const CIRCULAR_AVATAR_RADIUS = 39.5

const lineageLinePalette = Array.from({ length: 8 }, (_, index) => `var(--branch-${index})`)

/** Give each distinct parental pair a stable, distinct connector color. */
export function getParentalCoupleColors(members: FamilyMember[]): Map<string, string> {
  const coupleKeys = [...new Set(members.filter((member) => member.parentIds.length)
    .map((member) => member.parentIds.slice().sort().join('|')))].sort()
  const hues = [168, 326, 37, 248, 194, 350, 87, 18]
  const colors = coupleKeys.map((key, index) => {
    if (index < lineageLinePalette.length) return [key, lineageLinePalette[index]] as const
    let hue = (index * 137.508 + 19) % 360
    for (let attempt = 0; attempt < 24 && hues.some((assigned) => {
      const distance = Math.abs(assigned - hue)
      return Math.min(distance, 360 - distance) < 17
    }); attempt += 1) hue = (hue + 23) % 360
    hues.push(hue)
    const saturation = index % 2 ? 64 : 72
    const lightness = index % 3 ? 65 : 70
    return [key, `hsl(${Math.round(hue)} ${saturation}% ${lightness}%)`] as const
  })
  return new Map(colors)
}

function nodeCenterX(point: TreePosition, nodeWidth: number): number {
  return point.x + nodeWidth / 2
}

function areConfirmedSpouses(a: FamilyMember, b: FamilyMember): boolean {
  return a.id !== b.id && a.spouseIds.includes(b.id) && b.spouseIds.includes(a.id)
}

function areFormerSpouses(a: FamilyMember, b: FamilyMember): boolean {
  return a.id !== b.id && Boolean(a.formerSpouseIds?.includes(b.id) && b.formerSpouseIds?.includes(a.id))
}

function areCoupled(a: FamilyMember, b: FamilyMember): boolean {
  return areConfirmedSpouses(a, b) || areFormerSpouses(a, b)
}

/** Share one midpoint calculation between the marriage line, its anchor, and child branches. */
export function getSpouseConnector(first: TreePosition, second: TreePosition, nodeWidth: number, nodeHeight: number, options: { anchorOffsetY?: number; edgeInset?: number } = {}): SpouseConnector | null {
  if (first.x === second.x) return null
  const [left, right] = first.x < second.x ? [first, second] : [second, first]
  const edgeInset = options.edgeInset ?? nodeWidth / 2
  const anchorOffsetY = options.anchorOffsetY ?? nodeHeight / 2
  const startX = left.x + nodeWidth / 2 + edgeInset
  const endX = right.x + nodeWidth / 2 - edgeInset
  const startY = left.y + anchorOffsetY
  const endY = right.y + anchorOffsetY
  const anchorX = (startX + endX) / 2
  const anchorY = (startY + endY) / 2
  const path = startY === endY
    ? `M ${startX} ${startY} H ${endX}`
    : `M ${startX} ${startY} H ${anchorX} V ${endY} H ${endX}`
  return { path, anchorX, anchorY }
}

/** Route relationship-derived parent unions to every child card, even when the family is asymmetric. */
function getParentBranchGeometry(parents: TreePosition[], children: TreePosition[], nodeWidth: number, nodeHeight: number, lane: number, coupleAnchorOffsetY: number) {
  if (!parents.length || !children.length) return null
  const parentXs = parents.map((point) => nodeCenterX(point, nodeWidth))
  const unionCenter = (Math.min(...parentXs) + Math.max(...parentXs)) / 2
  // A couple's branch starts at the marriage-line anchor. Single-parent
  // families have no marriage line, so start at the parent's bottom edge.
  const unionY = parents.length > 1
    ? parents.reduce((sum, point) => sum + point.y + coupleAnchorOffsetY, 0) / parents.length
    : parents[0].y + nodeHeight
  // For a couple, begin immediately below the marriage badge. This keeps the
  // vertical branch connected to both parents through their shared union.
  const unionBottomY = parents.length > 1 ? unionY + MARRIAGE_ANCHOR_RADIUS : unionY
  const parentBottom = Math.max(...parents.map((point) => point.y + nodeHeight))
  const childrenY = Math.min(...children.map((point) => point.y))
  // Each parental unit owns a distinct horizontal channel. The parent stem
  // begins at the exact midpoint of the couple's marriage line.
  const branchY = Math.min(childrenY - 30, parentBottom + 30 + lane * 14)
  const childXs = children.map((point) => nodeCenterX(point, nodeWidth))
  return { unionCenter, unionBottomY, branchY, childXs }
}

export function getParentChildBranchJunction(parents: TreePosition[], children: TreePosition[], nodeWidth: number, nodeHeight: number, lane = 0, coupleAnchorOffsetY = nodeHeight / 2) {
  const geometry = getParentBranchGeometry(parents, children, nodeWidth, nodeHeight, lane, coupleAnchorOffsetY)
  return geometry ? { x: geometry.unionCenter, y: geometry.branchY } : null
}

export function getParentChildConnectorPaths(parents: TreePosition[], children: TreePosition[], nodeWidth: number, nodeHeight: number, lane = 0, coupleAnchorOffsetY = nodeHeight / 2): string[] {
  const geometry = getParentBranchGeometry(parents, children, nodeWidth, nodeHeight, lane, coupleAnchorOffsetY)
  if (!geometry) return []
  const { unionCenter, unionBottomY, branchY, childXs } = geometry
  const branchLeft = Math.min(unionCenter, ...childXs)
  const branchRight = Math.max(unionCenter, ...childXs)
  const paths = [`M ${unionCenter} ${unionBottomY} V ${branchY}`]
  if (branchRight > branchLeft) paths.push(`M ${branchLeft} ${branchY} H ${branchRight}`)
  children.forEach((point) => paths.push(`M ${nodeCenterX(point, nodeWidth)} ${branchY} V ${point.y}`))
  return paths
}

export function getSiblingConnectorPath(a: TreePosition, b: TreePosition, nodeWidth: number, nodeHeight: number): string | null {
  if (a.generation !== b.generation) return null
  const [left, right] = a.x <= b.x ? [a, b] : [b, a]
  const startX = nodeCenterX(left, nodeWidth)
  const endX = nodeCenterX(right, nodeWidth)
  const startY = left.y + nodeHeight
  return `M ${startX} ${startY} V ${startY + 18} H ${endX} V ${startY}`
}

/** Derive generation rows from parent links; layout coordinates never enter family records. */
export function computeTreeLayout(members: FamilyMember[], mode: TreeNodeMode = 'rectangle'): TreeLayout {
  const nodeWidth = mode === 'circle' ? 160 : 240
  // Fit the avatar, compact labels, and relationship badge into the circular node box.
  const nodeHeight = mode === 'circle' ? 144 : 106
  const gapX = mode === 'circle' ? 34 : 34
  const familyGap = mode === 'circle' ? 260 : 340
  const generations = getGenerationMap(members)
  const rows = new Map<number, FamilyMember[]>()
  for (const member of members) {
    const generation = generations.get(member.id) ?? 0
    rows.set(generation, [...(rows.get(generation) ?? []), member])
  }
  const levels = [...rows.keys()].sort((a, b) => a - b)
  const parentGroupCounts = new Map<number, Set<string>>()
  members.forEach((member) => {
    if (!member.parentIds.length) return
    const generation = generations.get(member.id) ?? 0
    const keys = parentGroupCounts.get(generation) ?? new Set<string>()
    keys.add(member.parentIds.slice().sort().join('|'))
    parentGroupCounts.set(generation, keys)
  })
  const maxParentGroups = Math.max(1, ...[...parentGroupCounts.values()].map((keys) => keys.size))
  const generationGap = Math.max(100, 90 + (maxParentGroups - 1) * 14)
  const orderedUnits = new Map<number, FamilyMember[][]>()
  const orderedUnitFamilies = new Map<number, string[]>()
  const birthOrder = (member: FamilyMember) => {
    if (!member.birthDate) return Number.POSITIVE_INFINITY
    const yearOnly = /^\d{4}$/.test(member.birthDate) ? `${member.birthDate}-01-01` : member.birthDate
    const parsed = Date.parse(yearOnly)
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
  }
  const chronological = (a: FamilyMember, b: FamilyMember) => birthOrder(a) - birthOrder(b) || a.name.localeCompare(b.name)
  const familyKeyFor = (person: FamilyMember) => `parents:${person.parentIds.slice().sort().join('|')}`
  const familyGroups = new Map<string, FamilyMember[]>()
  for (const person of members) if (person.parentIds.length) {
    const key = familyKeyFor(person)
    familyGroups.set(key, [...(familyGroups.get(key) ?? []), person])
  }
  const siblingOrderFor = (siblings: FamilyMember[]) => siblings.slice().sort(chronological)
  // Marriage links between natal sibling clusters impose outside-edge ordering:
  // an in-law branch is placed before a spouse at the left edge or after one at
  // the right edge. Topological ordering keeps those column constraints stable.
  const familyEdges = new Map<string, Set<string>>()
  const familyIndegree = new Map([...familyGroups.keys()].map((key) => [key, 0]))
  const addFamilyEdge = (from: string, to: string) => {
    if (from === to || !familyIndegree.has(from) || !familyIndegree.has(to)) return
    const outgoing = familyEdges.get(from) ?? new Set<string>()
    if (outgoing.has(to)) return
    outgoing.add(to); familyEdges.set(from, outgoing)
    familyIndegree.set(to, (familyIndegree.get(to) ?? 0) + 1)
  }
  for (const [key, group] of familyGroups) {
    const siblings = siblingOrderFor(group)
    siblings.forEach((person, index) => [...person.spouseIds, ...(person.formerSpouseIds ?? [])].forEach((spouseId) => {
      const spouse = members.find((candidate) => candidate.id === spouseId)
      if (!spouse || !areCoupled(person, spouse) || !spouse.parentIds.length) return
      const spouseKey = familyKeyFor(spouse)
      if (spouseKey === key || !familyGroups.has(spouseKey)) return
      if (index <= (siblings.length - 1) / 2) addFamilyEdge(spouseKey, key)
      else addFamilyEdge(key, spouseKey)
    }))
  }
  const familyOrder: string[] = []
  const pendingFamilyKeys = new Set(familyGroups.keys())
  while (pendingFamilyKeys.size) {
    const next = [...pendingFamilyKeys].filter((key) => (familyIndegree.get(key) ?? 0) === 0).sort()[0]
    if (!next) { familyOrder.push(...[...pendingFamilyKeys].sort()); break }
    pendingFamilyKeys.delete(next); familyOrder.push(next)
    for (const childKey of familyEdges.get(next) ?? []) familyIndegree.set(childKey, (familyIndegree.get(childKey) ?? 0) - 1)
  }
  const familyRank = new Map(familyOrder.map((key, index) => [key, index]))
  // Date ordering is deliberately confined to exact shared-parent clusters.
  for (const level of levels) {
    const row = rows.get(level) ?? []
    // Build each row from confirmed couple blocks first. This prevents an in-law
    // spouse from being pulled away from their partner while sibling families
    // are ordered around their shared parents.
    const byId = new Map(row.map((person) => [person.id, person]))
    const coupleBlocks: FamilyMember[][] = []
    const visited = new Set<string>()
    for (const person of row) {
      if (visited.has(person.id)) continue
      const component: FamilyMember[] = []
      const queue = [person]
      visited.add(person.id)
      while (queue.length) {
        const current = queue.shift()!
        component.push(current)
        for (const spouseId of [...current.spouseIds, ...(current.formerSpouseIds ?? [])]) {
          const spouse = byId.get(spouseId)
          if (spouse && areCoupled(current, spouse) && !visited.has(spouse.id)) {
            visited.add(spouse.id)
            queue.push(spouse)
          }
        }
      }
      // Put a male partner first, yielding the requested husband—wife order;
      // otherwise use the family's deterministic ordering.
      component.sort((a, b) => Number(b.gender === 'male') - Number(a.gender === 'male') || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      coupleBlocks.push(component)
    }
    const blockAnchor = (block: FamilyMember[]) => block
      .filter((person) => person.parentIds.length)
      .sort((a, b) => (familyGroups.get(familyKeyFor(b))?.length ?? 0) - (familyGroups.get(familyKeyFor(a))?.length ?? 0)
        || (familyRank.get(familyKeyFor(a)) ?? Number.POSITIVE_INFINITY)
        - (familyRank.get(familyKeyFor(b)) ?? Number.POSITIVE_INFINITY)
        || a.id.localeCompare(b.id))[0] ?? block[0]
    const blocksByFamily = new Map<string, FamilyMember[][]>()
    const rootBlocks: FamilyMember[][] = []
    for (const block of coupleBlocks) {
      const anchor = blockAnchor(block)
      if (!anchor.parentIds.length) rootBlocks.push(block)
      else {
        const key = familyKeyFor(anchor)
        blocksByFamily.set(key, [...(blocksByFamily.get(key) ?? []), block])
      }
    }
    const orderedFamilies = [...blocksByFamily.entries()].sort(([keyA], [keyB]) =>
      (familyRank.get(keyA) ?? Number.POSITIVE_INFINITY) - (familyRank.get(keyB) ?? Number.POSITIVE_INFINITY)
      || keyA.localeCompare(keyB))
    const units: FamilyMember[][] = []
    const unitFamilies: string[] = []
    for (const [key, blocks] of orderedFamilies) {
      const orderedSiblings = siblingOrderFor(blocks.map(blockAnchor))
      const blockByAnchor = new Map(blocks.map((block) => [blockAnchor(block).id, block]))
      orderedSiblings.forEach((sibling, index) => {
        const block = blockByAnchor.get(sibling.id) ?? [sibling]
        const partners = block.filter((person) => person.id !== sibling.id)
        // Put an in-law's own branch on the outside of the local sibling row.
        // The marriage block remains intact, while the child-side column has
        // room to align above the spouse's own parent couple.
        const placePartnerFirst = index < (orderedSiblings.length - 1) / 2
        const unit = placePartnerFirst ? [...partners, sibling] : [sibling, ...partners]
        units.push(unit)
        unitFamilies.push(key)
      })
    }
    // Root couples sit above the family cluster their children belong to. Use
    // that cluster's rank so in-law ancestral columns stay on the outside.
    const rootFamilyRank = (component: FamilyMember[]) => familyRank.get(
      `parents:${component.map((person) => person.id).sort().join('|')}`,
    ) ?? Number.POSITIVE_INFINITY
    for (const component of [...rootBlocks].sort((a, b) =>
      rootFamilyRank(a) - rootFamilyRank(b)
      || a.map((person) => person.id).sort().join('|').localeCompare(b.map((person) => person.id).sort().join('|')),
    )) {
      units.push(component)
      unitFamilies.push(`root:${component.map((person) => person.id).sort().join('|')}`)
    }
    orderedUnits.set(level, units)
    orderedUnitFamilies.set(level, unitFamilies)
  }
  const positions = new Map<string, TreePosition>()
  const unitWidth = (people: FamilyMember[]) => people.length * nodeWidth + Math.max(0, people.length - 1) * gapX
  // Work upward from the youngest generation. Each parental couple is centered
  // over its direct child, or over the span of its direct siblings.
  for (const level of [...levels].reverse()) {
    const units = orderedUnits.get(level) ?? []
    const unitFamilies = orderedUnitFamilies.get(level) ?? []
    const targetForUnit = (people: FamilyMember[]) => {
      const parentIds = new Set(people.map((person) => person.id))
      const children = members.filter((child) => {
        const parents = child.parentIds.slice().sort()
        return parents.length === parentIds.size && parents.every((id) => parentIds.has(id))
      })
      const childCenters = children.map((child) => {
        const position = positions.get(child.id)
        return position ? position.x + nodeWidth / 2 : null
      }).filter((center): center is number => center !== null)
      return childCenters.length ? (Math.min(...childCenters) + Math.max(...childCenters)) / 2 : null
    }
    const rowUnits = units.map((people, index) => ({ people, index, family: unitFamilies[index], target: targetForUnit(people) }))
    // Parent couples follow the actual horizontal order of their child columns.
    // Keep direct sibling blocks in their already established local birth order.
    rowUnits.sort((a, b) => {
      if (a.family === b.family) return a.index - b.index
      if (a.target !== null && b.target !== null) return a.target - b.target || a.index - b.index
      return a.index - b.index
    })
    const placed: Array<{ people: FamilyMember[]; left: number; width: number }> = []
    for (const [index, entry] of rowUnits.entries()) {
      const { people, family } = entry
      const width = unitWidth(people)
      const targetCenter = entry.target
      const requestedLeft = targetCenter === null ? 0 : targetCenter - width / 2
      const previous = placed.at(-1)
      const sameSiblingFamily = index > 0 && family === rowUnits[index - 1].family
      const minLeft = previous ? previous.left + previous.width + (sameSiblingFamily ? familyGap : gapX) : Number.NEGATIVE_INFINITY
      const left = Math.max(minLeft, requestedLeft)
      placed.push({ people, left, width })
    }
    if (placed.length) {
      // Preserve the requested parent-to-child X alignment between generation
      // rows. The entire tree is shifted together after placement below.
      placed.forEach((unit) => {
        unit.people.forEach((person, index) => positions.set(person.id, {
          x: unit.left + index * (nodeWidth + gapX),
          y: 32 + levels.indexOf(level) * (nodeHeight + generationGap),
          generation: level,
        }))
      })
    }
  }
  const minX = Math.min(0, ...[...positions.values()].map((position) => position.x))
  if (minX < 70) for (const [id, position] of positions) positions.set(id, { ...position, x: position.x + 70 - minX })
  const maxX = Math.max(0, ...[...positions.values()].map((position) => position.x + nodeWidth))
  const width = Math.max(940, maxX + 70)
  const height = Math.max(380, levels.length * (nodeHeight + generationGap) + 64)
  return { positions, width, height, nodeWidth, nodeHeight }
}

export function getImmediateFamilyIds(members: FamilyMember[], memberId: string): Set<string> {
  const person = members.find((member) => member.id === memberId)
  if (!person) return new Set()
  return new Set([memberId, ...person.parentIds, ...person.spouseIds, ...(person.formerSpouseIds ?? []), ...person.siblingIds,
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
      const partnerRoot = [...person.spouseIds, ...(person.formerSpouseIds ?? [])].map((id) => byId.get(id)).find((item) => item && item.parentIds.length === 0)
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
    const partner = [...member.spouseIds, ...(member.formerSpouseIds ?? [])].map((id) => byId.get(id)).find((candidate) => candidate && !candidate.parentIds.length && !visited.has(candidate.id)) ?? null
    visited.add(member.id)
    if (partner) visited.add(partner.id)
    branches.push({ id: member.id, member, partner, color: colors.get(member.id) ?? null })
  }
  return branches
}
