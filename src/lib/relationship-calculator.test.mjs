import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRelationship } from './relationship-calculator.ts'

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
  assert.equal(calculateRelationship(family, 'parentA', 'childA')?.titleKey, 'Parent')
  assert.equal(calculateRelationship(family, 'childA', 'parentA')?.titleKey, 'Child')
  assert.equal(calculateRelationship(family, 'childA', 'childB')?.titleKey, 'Sibling')
  assert.equal(calculateRelationship(family, 'parentA', 'parentB')?.titleKey, 'Spouse')
})

test('calculates grandparent, aunt or uncle, niece or nephew and cousin relationships', () => {
  assert.equal(calculateRelationship(family, 'grandpa', 'childA')?.titleKey, 'Grandparent')
  assert.equal(calculateRelationship(family, 'parentA', 'cousin')?.titleKey, 'Uncle')
  assert.equal(calculateRelationship(family, 'cousin', 'parentA')?.titleKey, 'Niece')
  assert.equal(calculateRelationship(family, 'childA', 'cousin')?.titleKey, 'Cousin')
})

test('returns the shortest path and no result for identical or unconnected people', () => {
  const result = calculateRelationship(family, 'parentA', 'grandchild')
  assert.equal(result?.pathIds.length, 3)
  assert.equal(result?.steps.length, 2)
  assert.equal(calculateRelationship(family, 'childA', 'childA'), null)
  assert.equal(calculateRelationship(family, 'childA', 'unrelated'), null)
})

test('uses neutral kinship title when gender is missing and handles cousin degree', () => {
  const neutralFamily = [...family, person('neutralSibling', { parentIds: ['grandpa', 'grandma'] })]
  assert.equal(calculateRelationship(neutralFamily, 'neutralSibling', 'grandchild')?.titleKey, 'Aunt or uncle')
  const distant = [...family, person('great', { parentIds: ['grandchild'] })]
  const cousinResult = calculateRelationship(distant, 'great', 'cousin')
  assert.equal(cousinResult?.titleKey, 'Cousin, {degree} times removed')
  assert.deepEqual(cousinResult?.values, { degree: 2 })
})
