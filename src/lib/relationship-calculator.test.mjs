import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRelationship, getRelationshipPathStepLabelKey } from './relationship-calculator.ts'

function person(id, { gender, parentIds = [], spouseIds = [], siblingIds = [], formerSpouseIds = [] } = {}) {
  return { id, name: id, initials: id, relationship: '', gender, parentIds, spouseIds, siblingIds, formerSpouseIds, avatar: { skin: '', hair: '', shirt: '', hairstyle: 'side' } }
}

const family = [
  person('grandpa', { gender: 'male' }),
  person('grandma', { gender: 'female' }),
  person('parentA', { gender: 'male', parentIds: ['grandpa', 'grandma'], spouseIds: ['parentB'] }),
  person('parentB', { gender: 'female', parentIds: ['grandpa', 'grandma'], spouseIds: ['parentA'] }),
  person('childA', { gender: 'female', parentIds: ['parentA', 'parentB'] }),
  person('childB', { gender: 'male', parentIds: ['parentA', 'parentB'], siblingIds: ['childA'] }),
  person('grandchild', { gender: 'male', parentIds: ['childA'] }),
  person('cousinParent', { gender: 'female', parentIds: ['grandpa', 'grandma'] }),
  person('cousin', { gender: 'female', parentIds: ['cousinParent'] }),
  person('unrelated'),
]

test('calculates direct parent, child, sibling and spouse relationships', () => {
  const parentToChild = calculateRelationship(family, 'parentA', 'childA')
  const childToParent = calculateRelationship(family, 'childA', 'parentA')
  const siblingForward = calculateRelationship(family, 'childA', 'childB')
  const siblingReverse = calculateRelationship(family, 'childB', 'childA')
  const spouseForward = calculateRelationship(family, 'parentA', 'parentB')
  const spouseReverse = calculateRelationship(family, 'parentB', 'parentA')
  assert.equal(parentToChild?.titleKey, 'Parent')
  assert.equal(childToParent?.titleKey, 'Child')
  assert.equal(getRelationshipPathStepLabelKey(parentToChild.steps[0].kind), 'Parent of')
  assert.equal(getRelationshipPathStepLabelKey(childToParent.steps[0].kind), 'Child of')
  assert.equal(siblingForward?.titleKey, 'Sibling')
  assert.equal(siblingReverse?.titleKey, 'Sibling')
  assert.equal(getRelationshipPathStepLabelKey(siblingForward.steps[0].kind), 'Sibling of')
  assert.equal(getRelationshipPathStepLabelKey(siblingReverse.steps[0].kind), 'Sibling of')
  assert.equal(spouseForward?.titleKey, 'Spouse')
  assert.equal(spouseReverse?.titleKey, 'Spouse')
  assert.equal(getRelationshipPathStepLabelKey(spouseForward.steps[0].kind), 'Spouse of')
  assert.equal(getRelationshipPathStepLabelKey(spouseReverse.steps[0].kind), 'Spouse of')
})

test('calculates grandparent, aunt or uncle, niece or nephew and cousin relationships', () => {
  assert.equal(calculateRelationship(family, 'grandpa', 'childA')?.titleKey, 'Grandparent')
  assert.equal(calculateRelationship(family, 'childA', 'grandpa')?.titleKey, 'Grandchild')
  assert.equal(calculateRelationship(family, 'parentA', 'cousin')?.titleKey, 'Uncle')
  assert.equal(calculateRelationship(family, 'cousin', 'parentA')?.titleKey, 'Niece')
  assert.equal(calculateRelationship(family, 'childA', 'cousin')?.titleKey, 'Cousin')
  assert.equal(calculateRelationship(family, 'cousin', 'childA')?.titleKey, 'Cousin')
})

test('returns the shortest path and no result for identical or unconnected people', () => {
  const result = calculateRelationship(family, 'parentA', 'grandchild')
  assert.equal(result?.pathIds.length, 3)
  assert.equal(result?.steps.length, 2)
  assert.equal(calculateRelationship(family, 'childA', 'childA'), null)
  assert.equal(calculateRelationship(family, 'childA', 'unrelated'), null)
})

test('labels a one-way spouse reference consistently from either person', () => {
  const oneWayFamily = [...family, person('formerRecord', { gender: 'female', spouseIds: ['unrelated'] })]
  assert.equal(calculateRelationship(oneWayFamily, 'formerRecord', 'unrelated')?.titleKey, 'Spouse')
  assert.equal(calculateRelationship(oneWayFamily, 'unrelated', 'formerRecord')?.titleKey, 'Spouse')
})

test('uses neutral kinship title when gender is missing and handles cousin degree', () => {
  const neutralFamily = [...family, person('neutralSibling', { parentIds: ['grandpa', 'grandma'] })]
  assert.equal(calculateRelationship(neutralFamily, 'neutralSibling', 'grandchild')?.titleKey, 'Aunt or uncle')
  const distant = [...family, person('great', { parentIds: ['grandchild'] })]
  const cousinResult = calculateRelationship(distant, 'great', 'cousin')
  assert.equal(cousinResult?.titleKey, 'Cousin, {degree} times removed')
  assert.deepEqual(cousinResult?.values, { degree: 2 })
})
