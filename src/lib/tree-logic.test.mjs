import test from 'node:test'
import assert from 'node:assert/strict'
import { familyMembers } from '../data/family.ts'
import { applyRelationship, createRelatedMember, getGenerationMap, getHiddenIds, getSiblingConnectorPairs, getSiblingPairs, validateRelationship } from './tree-logic.ts'
import { recordTreeChange, redoTreeChange, undoTreeChange } from './tree-history.ts'
import { computeTreeLayout, getParentChildConnectorPaths, getRootBranchMap, getRootBranches, getSiblingConnectorPath } from './tree-layout.ts'
import { findPossibleDuplicates, searchFamilyMembers } from './family-search.ts'
import { exportTree, parseTreeBackup } from './tree-backup.ts'

test('collapsing an ancestor hides its descendant branch and descendant spouse', () => {
  const hidden = getHiddenIds(familyMembers, new Set(['james']))
  assert.deepEqual([...hidden].sort(), ['david', 'jack', 'linda', 'sarah'])
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

test('adding a relative links the requested relation and empty trees accept a founder', () => {
  const withPartner = createRelatedMember(familyMembers, 'sarah', 'partner', 'Alex Morgan', 'alex')
  assert.deepEqual(withPartner.find((member) => member.id === 'alex')?.spouseIds, ['sarah'])
  assert.ok(withPartner.find((member) => member.id === 'sarah')?.spouseIds.includes('alex'))
  const founder = createRelatedMember([], '', 'child', 'Avery Morgan', 'avery')
  assert.equal(founder[0]?.relationship, 'Family founder')
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
})

test('parent union connector reaches an offset single child card', () => {
  const paths = getParentChildConnectorPaths(
    [{ x: 10, y: 20, generation: 0 }, { x: 300, y: 20, generation: 0 }],
    [{ x: 10, y: 160, generation: 1 }], 100, 60,
  )
  assert.ok(paths.includes('M 60 130 H 205'))
  assert.ok(paths.includes('M 60 130 V 160'))
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
  assert.equal(branches.length, 2)
  assert.equal(branches[0]?.member.id, 'james')
  assert.equal(branches[0]?.partner?.id, 'eleanor')
  assert.equal(branches[1]?.member.id, 'linda')
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
  assert.equal(parseTreeBackup({ people: [{ id: 'bad', name: 'Bad' }] }), null)
})
