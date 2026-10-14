import test from 'node:test'
import assert from 'node:assert/strict'
import { familyMembers } from '../data/family.ts'
import { applyRelationship, createRelatedMember, getGenerationMap, getHiddenIds, getSiblingConnectorPairs, getSiblingPairs, linkRecordedParentCouples, validateRelationship } from './tree-logic.ts'
import { recordTreeChange, redoTreeChange, undoTreeChange } from './tree-history.ts'
import { computeTreeLayout, getParentChildConnectorPaths, getRootBranchMap, getRootBranches, getSiblingConnectorPath, getSpouseConnector, MARRIAGE_ANCHOR_RADIUS, CIRCULAR_AVATAR_CENTER_Y, CIRCULAR_AVATAR_RADIUS } from './tree-layout.ts'
import { findPossibleDuplicates, searchFamilyMembers } from './family-search.ts'
import { exportTree, parseTreeBackup } from './tree-backup.ts'

test('collapsing an ancestor hides its descendant branch and descendant spouse', () => {
  const hidden = getHiddenIds(familyMembers, new Set(['james']))
  assert.deepEqual([...hidden].sort(), ['david', 'jack', 'linda', 'nora', 'sarah'])
})

test('relationship validation rejects self-parenting and ancestry cycles', () => {
  assert.match(validateRelationship(familyMembers, 'sarah', 'sarah', 'parent') ?? '', /themselves/)
  assert.match(validateRelationship(familyMembers, 'james', 'sarah', 'parent') ?? '', /cycle/)
})

test('relationship validation rejects sibling, spouse, and repeated links that are structurally invalid', () => {
  assert.match(validateRelationship(familyMembers, 'james', 'sarah', 'partner') ?? '', /ancestor or descendant/)
  assert.match(validateRelationship(familyMembers, 'sarah', 'jack', 'partner') ?? '', /Siblings cannot/)
  assert.match(validateRelationship(familyMembers, 'sarah', 'jack', 'sibling') ?? '', /already siblings/)
  assert.match(validateRelationship(familyMembers, 'james', 'eleanor', 'partner') ?? '', /already partners/)
})

test('a valid partner relationship is added symmetrically', () => {
  const newMember = { ...familyMembers[4], id: 'alex', name: 'Alex Morgan', parentIds: [], spouseIds: [], siblingIds: [] }
  const graph = [...familyMembers, newMember]
  assert.equal(validateRelationship(graph, 'sarah', 'alex', 'partner'), null)
  const changed = applyRelationship(graph, 'sarah', 'alex', 'partner')
  assert.ok(changed.find((member) => member.id === 'sarah')?.spouseIds.includes('alex'))
  assert.ok(changed.find((member) => member.id === 'alex')?.spouseIds.includes('sarah'))
  assert.deepEqual(familyMembers.find((member) => member.id === 'sarah')?.spouseIds, [])
})

test('multiple partners remain valid and share a display generation with the selected relative', () => {
  const alex = { ...familyMembers[4], id: 'alex', name: 'Alex Morgan', parentIds: [], spouseIds: [], siblingIds: [] }
  const robin = { ...familyMembers[4], id: 'robin', name: 'Robin Morgan', parentIds: [], spouseIds: [], siblingIds: [] }
  const once = applyRelationship([...familyMembers, alex, robin], 'sarah', 'alex', 'partner')
  const twice = applyRelationship(once, 'sarah', 'robin', 'partner')
  assert.equal(validateRelationship(once, 'sarah', 'robin', 'partner'), null)
  assert.deepEqual(twice.find((person) => person.id === 'sarah')?.spouseIds, ['alex', 'robin'])
  const generations = getGenerationMap(twice)
  assert.equal(generations.get('sarah'), generations.get('alex'))
  assert.equal(generations.get('sarah'), generations.get('robin'))
})

test('an invalid proposed relationship leaves the original family graph unchanged', () => {
  assert.equal(applyRelationship(familyMembers, 'james', 'sarah', 'parent'), familyMembers)
})

test('divorce preserves former-spouse links while keeping shared children biologically linked', () => {
  const zack = familyMembers.find((person) => person.id === 'zack')
  const layla = familyMembers.find((person) => person.id === 'layla')
  const sam = familyMembers.find((person) => person.id === 'sam')
  assert.ok(zack && layla && sam)
  assert.equal(validateRelationship(familyMembers, 'david', 'linda', 'divorced'), null)
  const result = applyRelationship(familyMembers, 'david', 'linda', 'divorced')
  assert.ok(!result.find((person) => person.id === 'david')?.spouseIds.includes('linda'))
  assert.ok(result.find((person) => person.id === 'david')?.formerSpouseIds?.includes('linda'))
  assert.ok(result.find((person) => person.id === 'linda')?.formerSpouseIds?.includes('david'))
  assert.deepEqual(sam.parentIds, ['zack', 'layla'])
  assert.deepEqual(zack.formerSpouseIds, ['layla'])
})

test('adoption records adoptive parent links separately from biological parent data', () => {
  const child = { ...familyMembers[4], id: 'adopted-test', name: 'Test child', parentIds: [], spouseIds: [], siblingIds: [] }
  const graph = [...familyMembers, child]
  assert.equal(validateRelationship(graph, 'david', 'adopted-test', 'adopted'), null)
  const result = applyRelationship(graph, 'david', 'adopted-test', 'adopted')
  assert.deepEqual(result.find((person) => person.id === 'adopted-test')?.parentIds, ['david'])
  assert.deepEqual(result.find((person) => person.id === 'adopted-test')?.adoptedParentIds, ['david'])
  assert.deepEqual(familyMembers.find((person) => person.id === 'nora')?.adoptedParentIds, ['david', 'linda'])
})

test('adding a relative links the requested relation and empty trees accept a founder', () => {
  const withPartner = createRelatedMember(familyMembers, 'sarah', 'partner', 'Alex Morgan', 'alex', undefined, undefined, undefined, 'male')
  assert.deepEqual(withPartner.find((member) => member.id === 'alex')?.spouseIds, ['sarah'])
  assert.ok(withPartner.find((member) => member.id === 'sarah')?.spouseIds.includes('alex'))
  const founder = createRelatedMember([], '', 'child', 'Avery Morgan', 'avery', undefined, undefined, undefined, 'male')
  assert.equal(founder[0]?.relationship, 'Family founder')
})

test('adding a second parent links a valid father and mother as spouses', () => {
  const child = { ...familyMembers[4], id: 'test-child', name: 'Test Child', parentIds: [], spouseIds: [], siblingIds: [] }
  const withFather = createRelatedMember([child], child.id, 'parent', 'Test Father', 'test-father', undefined, undefined, undefined, 'male')
  const completedFamily = createRelatedMember(withFather, child.id, 'parent', 'Test Mother', 'test-mother', undefined, undefined, undefined, 'female')
  assert.ok(completedFamily.find((member) => member.id === 'test-father')?.spouseIds.includes('test-mother'))
  assert.ok(completedFamily.find((member) => member.id === 'test-mother')?.spouseIds.includes('test-father'))
})

test('tree edits support undo and redo snapshots', () => {
  const friend = { ...familyMembers[4], id: 'alex', name: 'Alex Morgan', parentIds: [], spouseIds: [], siblingIds: [] }
  const graph = [...familyMembers, friend]
  const edited = applyRelationship(graph, 'sarah', 'alex', 'partner')
  const changed = recordTreeChange({ members: graph, past: [], future: [] }, edited)
  const undone = undoTreeChange(changed)
  assert.equal(undone.members, graph)
  const redone = redoTreeChange(undone)
  assert.equal(redone.members, edited)
})

test('layout derives ordered generations from parent links and supports circles and missing dates', () => {
  const layout = computeTreeLayout(familyMembers, 'rectangle')
  const circles = computeTreeLayout(familyMembers, 'circle')
  assert.equal(layout.positions.get('james')?.generation, 0)
  assert.equal(layout.positions.get('sarah')?.generation, 2)
  assert.equal(layout.positions.size, familyMembers.length)
  assert.notEqual(layout.nodeWidth, circles.nodeWidth)
  assert.equal(circles.positions.get('sarah')?.generation, 2)
  const james = layout.positions.get('james')
  const eleanor = layout.positions.get('eleanor')
  const david = layout.positions.get('david')
  assert.ok(james && eleanor && david)
  assert.equal((james.x + layout.nodeWidth / 2 + eleanor.x + layout.nodeWidth / 2) / 2, david.x + layout.nodeWidth / 2)
})

test('parent drop connector starts at the couple midpoint and uses isolated channels', () => {
  const parents = [{ x: 10, y: 20, generation: 0 }, { x: 300, y: 20, generation: 0 }]
  const marriage = getSpouseConnector(parents[0], parents[1], 100, 60)
  assert.deepEqual(marriage, { path: 'M 110 50 H 300', anchorX: 205, anchorY: 50 })
  const paths = getParentChildConnectorPaths(
    parents,
    [{ x: 10, y: 160, generation: 1 }], 100, 60,
  )
  assert.equal(marriage.anchorX, (parents[0].x + 50 + parents[1].x + 50) / 2)
  assert.equal(marriage.anchorY, 50)
  assert.ok(paths.includes(`M 205 ${marriage.anchorY + MARRIAGE_ANCHOR_RADIUS} V 110`))
  assert.ok(paths.includes('M 60 110 H 205'))
  assert.ok(paths.includes('M 60 110 V 160'))
  const nextChannel = getParentChildConnectorPaths(
    [{ x: 10, y: 20, generation: 0 }, { x: 300, y: 20, generation: 0 }],
    [{ x: 10, y: 160, generation: 1 }], 100, 60, 1,
  )
  assert.ok(nextChannel.includes(`M 205 ${marriage.anchorY + MARRIAGE_ANCHOR_RADIUS} V 124`))
  const singleParent = getParentChildConnectorPaths(
    [{ x: 10, y: 20, generation: 0 }],
    [{ x: 10, y: 160, generation: 1 }], 100, 60,
  )
  assert.ok(singleParent.includes('M 60 80 V 110'))
  const centeredOnlyChild = getParentChildConnectorPaths(
    parents,
    [{ x: 155, y: 160, generation: 1 }], 100, 60,
  )
  assert.deepEqual(centeredOnlyChild, ['M 205 62 V 110', 'M 205 110 V 160'])
  const circleMarriage = getSpouseConnector(
    { x: 0, y: 0, generation: 0 }, { x: 194, y: 0, generation: 0 }, 160, 144,
    { anchorOffsetY: CIRCULAR_AVATAR_CENTER_Y, edgeInset: CIRCULAR_AVATAR_RADIUS },
  )
  assert.deepEqual(circleMarriage, { path: 'M 119.5 42.5 H 234.5', anchorX: 177, anchorY: 42.5 })
  const circleChildPaths = getParentChildConnectorPaths(
    [{ x: 0, y: 0, generation: 0 }, { x: 194, y: 0, generation: 0 }],
    [{ x: 194, y: 238, generation: 1 }], 160, 144, 0, CIRCULAR_AVATAR_CENTER_Y,
  )
  assert.ok(circleChildPaths[0].startsWith(`M 177 ${CIRCULAR_AVATAR_CENTER_Y + MARRIAGE_ANCHOR_RADIUS} V`))
})

test('recorded father and mother pairs are linked as reciprocal spouses', () => {
  const parentChild = familyMembers.find((member) => member.id === 'david')
  const unlinked = familyMembers.map((member) => member.id === 'james' || member.id === 'eleanor'
    ? { ...member, spouseIds: member.spouseIds.filter((id) => id !== 'eleanor' && id !== 'james') }
    : member)
  assert.ok(parentChild)
  const normalized = linkRecordedParentCouples(unlinked)
  assert.ok(normalized.find((member) => member.id === 'james')?.spouseIds.includes('eleanor'))
  assert.ok(normalized.find((member) => member.id === 'eleanor')?.spouseIds.includes('james'))
})

test('explicit sibling relationships have one connector pair and disappear with collapsed members', () => {
  const pairs = getSiblingPairs(familyMembers)
  assert.deepEqual(pairs.map(([first, second]) => [first.id, second.id]), [['jack', 'sarah']])
  assert.deepEqual(getSiblingConnectorPairs(familyMembers), [])
  assert.deepEqual(getSiblingPairs(familyMembers, new Set(['jack'])), [])
  const peers = [{ ...familyMembers[4], id: 'one', parentIds: [], spouseIds: [], siblingIds: ['two'] }, { ...familyMembers[5], id: 'two', parentIds: [], spouseIds: [], siblingIds: ['one'] }]
  assert.deepEqual(getSiblingConnectorPairs(peers).map(([first, second]) => [first.id, second.id]), [['one', 'two']])
  assert.equal(getSiblingConnectorPath({ x: 10, y: 20, generation: 0 }, { x: 300, y: 20, generation: 0 }, 100, 60), 'M 60 80 V 98 H 350 V 80')
  assert.equal(getSiblingConnectorPath({ x: 10, y: 20, generation: 0 }, { x: 300, y: 150, generation: 1 }, 100, 60), null)
})

test('root branch colors are relationship-derived and descendants blend their colored parent branches', () => {
  const branches = getRootBranchMap(familyMembers)
  assert.equal(branches.get('james'), branches.get('eleanor'))
  assert.equal(branches.get('james'), branches.get('david'))
  assert.notEqual(branches.get('david'), branches.get('linda'))
  assert.match(branches.get('sarah') ?? '', /color-mix/)
  assert.match(branches.get('sarah') ?? '', /--branch-/)
  const moreRoots = [...familyMembers]
  for (let index = 0; index < 8; index += 1) moreRoots.push({ ...familyMembers[0], id: `root-${index}`, name: `Root ${index}`, spouseIds: [], parentIds: [], siblingIds: [] })
  const extended = getRootBranchMap(moreRoots)
  assert.ok(new Set([...extended.values()].filter((color) => color?.startsWith('var(--branch-'))).size >= 6)
  assert.equal([...extended.values()].filter((color) => color === null).length >= 2, true)
})

test('root branch navigation groups founding partners and counts independent root families once', () => {
  const branches = getRootBranches(familyMembers)
  assert.equal(branches.length, 3)
  assert.equal(branches[0]?.member.id, 'james')
  assert.equal(branches[0]?.partner?.id, 'eleanor')
  assert.equal(branches[1]?.member.id, 'linda')
  assert.equal(branches[2]?.member.id, 'zack')
  assert.equal(branches[2]?.partner?.id, 'layla')
})

test('possible duplicate lookup distinguishes matching identity details and preserves same-name people', () => {
  const sameName = { ...familyMembers[4], id: 'sarah-2', birthDate: '1992-07-01' }
  const people = [...familyMembers, sameName]
  const matches = findPossibleDuplicates(people, '  SARAH   Morgan ', '1992-07-01')
  assert.equal(matches.length, 2)
  assert.ok(matches.some((match) => match.sameBirthDate))
  assert.equal(searchFamilyMembers(people, 'Sarah').length, 2)
})

test('large trees and collapsed branches receive fresh non-overlapping positions', () => {
  const large = [...familyMembers]
  let previous = 'sarah'
  for (let index = 0; index < 120; index += 1) {
    const person = { ...familyMembers[4], id: `descendant-${index}`, name: `Person ${index}`, birthDate: undefined, parentIds: [previous], spouseIds: [], siblingIds: [] }
    large.push(person)
    previous = person.id
  }
  const full = computeTreeLayout(large)
  const visible = large.filter((person) => !getHiddenIds(large, new Set(['david'])).has(person.id))
  const collapsed = computeTreeLayout(visible)
  assert.equal(full.positions.size, large.length)
  assert.equal(collapsed.positions.size, visible.length)
  for (const point of full.positions.values()) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y))
  const byGeneration = new Map()
  for (const [id, point] of full.positions) byGeneration.set(point.generation, [...(byGeneration.get(point.generation) ?? []), { id, x: point.x }])
  for (const row of byGeneration.values()) {
    row.sort((a, b) => a.x - b.x)
    for (let index = 1; index < row.length; index += 1) assert.ok(row[index].x >= row[index - 1].x + full.nodeWidth)
  }
})

test('backup export and restore round-trip selected family branches without dangling links', () => {
  const branch = parseTreeBackup(JSON.parse(exportTree(familyMembers, 'david')))
  assert.ok(branch)
  assert.ok(branch.some((person) => person.id === 'sarah'))
  assert.ok(branch.some((person) => person.id === 'linda'))
  assert.ok(branch.every((person) => [...person.parentIds, ...person.spouseIds, ...person.siblingIds].every((id) => branch.some((candidate) => candidate.id === id))))
  assert.deepEqual(branch.find((person) => person.id === 'nora')?.adoptedParentIds, ['david', 'linda'])
  const formerFamily = parseTreeBackup(JSON.parse(exportTree(familyMembers, 'zack')))
  assert.ok(formerFamily?.some((person) => person.id === 'layla' && person.formerSpouseIds?.includes('zack')))
  assert.ok(formerFamily?.some((person) => person.id === 'sam' && person.parentIds.includes('zack')))
  assert.equal(parseTreeBackup({ people: [{ id: 'bad', name: 'Bad' }] }), null)
})
