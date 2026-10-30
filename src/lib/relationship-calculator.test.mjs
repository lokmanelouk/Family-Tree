import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateRelationship, getRelationshipPathStepLabelKey } from './relationship-calculator.ts'
import { familyMembers } from '../data/family.ts'

function person(id, { gender, parentIds = [], adoptedParentIds = [], spouseIds = [], siblingIds = [], formerSpouseIds = [] } = {}) {
  return { id, name: id, initials: id, relationship: '', gender, parentIds, adoptedParentIds, spouseIds, siblingIds, formerSpouseIds, avatar: { skin: '', hair: '', shirt: '', hairstyle: 'side' } }
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
  assert.equal(siblingForward?.titleKey, 'Sister')
  assert.equal(siblingReverse?.titleKey, 'Brother')
  assert.equal(getRelationshipPathStepLabelKey(siblingForward.steps[0].kind), 'Sibling of')
  assert.equal(getRelationshipPathStepLabelKey(siblingReverse.steps[0].kind), 'Sibling of')
  assert.equal(spouseForward?.titleKey, 'Spouse')
  assert.equal(spouseReverse?.titleKey, 'Spouse')
  assert.equal(getRelationshipPathStepLabelKey(spouseForward.steps[0].kind), 'Spouse of')
  assert.equal(getRelationshipPathStepLabelKey(spouseReverse.steps[0].kind), 'Spouse of')
})

test('calculates grandparent, aunt or uncle, niece or nephew and cousin relationships', () => {
  assert.equal(calculateRelationship(family, 'grandpa', 'childA')?.titleKey, 'Grandfather')
  assert.equal(calculateRelationship(family, 'childA', 'grandpa')?.titleKey, 'Grandchild')
  assert.equal(calculateRelationship(family, 'parentA', 'cousin')?.titleKey, 'Maternal uncle')
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

test('distinguishes maternal and paternal grandparents and aunts or uncles when parent links identify the branch', () => {
  const branchFamily = [
    person('paternalGrandfather', { gender: 'male' }),
    person('paternalGrandmother', { gender: 'female' }),
    person('maternalGrandfather', { gender: 'male' }),
    person('maternalGrandmother', { gender: 'female' }),
    person('father', { gender: 'male', parentIds: ['paternalGrandfather', 'paternalGrandmother'] }),
    person('mother', { gender: 'female', parentIds: ['maternalGrandfather', 'maternalGrandmother'] }),
    person('paternalAunt', { gender: 'female', parentIds: ['paternalGrandfather', 'paternalGrandmother'] }),
    person('maternalUncle', { gender: 'male', parentIds: ['maternalGrandfather', 'maternalGrandmother'] }),
    person('child', { gender: 'female', parentIds: ['father', 'mother'] }),
  ]
  assert.equal(calculateRelationship(branchFamily, 'paternalGrandfather', 'child')?.titleKey, 'Paternal grandfather')
  assert.equal(calculateRelationship(branchFamily, 'paternalGrandmother', 'child')?.titleKey, 'Paternal grandmother')
  assert.equal(calculateRelationship(branchFamily, 'maternalGrandfather', 'child')?.titleKey, 'Maternal grandfather')
  assert.equal(calculateRelationship(branchFamily, 'maternalGrandmother', 'child')?.titleKey, 'Maternal grandmother')
  assert.equal(calculateRelationship(branchFamily, 'paternalAunt', 'child')?.titleKey, 'Paternal aunt')
  assert.equal(calculateRelationship(branchFamily, 'maternalUncle', 'child')?.titleKey, 'Maternal uncle')
  assert.equal(calculateRelationship(branchFamily, 'child', 'maternalUncle')?.titleKey, 'Niece')
  assert.equal(calculateRelationship(branchFamily, 'child', 'paternalAunt')?.titleKey, 'Niece')
})

test('uses a generic grandparent title when repeated ancestry makes the side ambiguous', () => {
  assert.equal(calculateRelationship(family, 'grandpa', 'childA')?.titleKey, 'Grandfather')
})

test('distinguishes full siblings by the first selected person gender in both directions', () => {
  const fullSiblings = [
    person('father', { gender: 'male' }),
    person('mother', { gender: 'female' }),
    person('brother', { gender: 'male', parentIds: ['father', 'mother'] }),
    person('sister', { gender: 'female', parentIds: ['father', 'mother'] }),
    person('unknownSibling', { parentIds: ['father', 'mother'] }),
  ]
  assert.equal(calculateRelationship(fullSiblings, 'brother', 'sister')?.titleKey, 'Brother')
  assert.equal(calculateRelationship(fullSiblings, 'sister', 'brother')?.titleKey, 'Sister')
  assert.equal(calculateRelationship(fullSiblings, 'unknownSibling', 'brother')?.titleKey, 'Sibling')
})

test('identifies maternal and paternal half-siblings only with known distinct other parents', () => {
  const familyWithHalfSiblings = [
    person('mother', { gender: 'female' }),
    person('fatherA', { gender: 'male' }),
    person('fatherB', { gender: 'male' }),
    person('fatherC', { gender: 'male' }),
    person('motherA', { gender: 'female' }),
    person('motherB', { gender: 'female' }),
    person('maternalSister', { gender: 'female', parentIds: ['mother', 'fatherA'] }),
    person('maternalBrother', { gender: 'male', parentIds: ['mother', 'fatherB'] }),
    person('paternalSister', { gender: 'female', parentIds: ['fatherC', 'motherA'] }),
    person('paternalBrother', { gender: 'male', parentIds: ['fatherC', 'motherB'] }),
    person('partialRecord', { gender: 'female', parentIds: ['mother'] }),
  ]
  assert.equal(calculateRelationship(familyWithHalfSiblings, 'maternalSister', 'maternalBrother')?.titleKey, 'Maternal half-sister')
  assert.equal(calculateRelationship(familyWithHalfSiblings, 'maternalBrother', 'maternalSister')?.titleKey, 'Maternal half-brother')
  assert.equal(calculateRelationship(familyWithHalfSiblings, 'paternalSister', 'paternalBrother')?.titleKey, 'Paternal half-sister')
  assert.equal(calculateRelationship(familyWithHalfSiblings, 'paternalBrother', 'paternalSister')?.titleKey, 'Paternal half-brother')
  assert.equal(calculateRelationship(familyWithHalfSiblings, 'maternalSister', 'partialRecord')?.titleKey, 'Sibling')
})

test('keeps incomplete or unknown parent information generic instead of assuming a full or half sibling', () => {
  const incomplete = [
    person('mother', { gender: 'female' }),
    person('unknownParent'),
    person('first', { gender: 'female', parentIds: ['mother'] }),
    person('second', { gender: 'male', parentIds: ['mother', 'unknownParent'] }),
    person('third', { gender: 'female', parentIds: ['mother', 'unknownParent'] }),
  ]
  assert.equal(calculateRelationship(incomplete, 'first', 'second')?.titleKey, 'Sibling')
  assert.equal(calculateRelationship(incomplete, 'second', 'third')?.titleKey, 'Sibling')
})

test('identifies Sarah and Nora as adoptive siblings from the available family data', () => {
  const sarahToNora = calculateRelationship(familyMembers, 'sarah', 'nora')
  const noraToSarah = calculateRelationship(familyMembers, 'nora', 'sarah')
  assert.equal(sarahToNora?.titleKey, 'Adoptive sister')
  assert.equal(noraToSarah?.titleKey, 'Adoptive sister')
  assert.deepEqual(sarahToNora?.pathIds, ['sarah', 'nora'])
  assert.deepEqual(noraToSarah?.pathIds, ['nora', 'sarah'])
  assert.equal(getRelationshipPathStepLabelKey(sarahToNora.steps[0].kind), 'Adoptive sibling of')
  assert.equal(getRelationshipPathStepLabelKey(noraToSarah.steps[0].kind), 'Adoptive sibling of')
})

test('labels adopted parent and child paths in both directions', () => {
  const adoptedFamily = [
    person('adopter', { gender: 'female' }),
    person('adopted', { gender: 'male', parentIds: ['adopter'], adoptedParentIds: ['adopter'] }),
  ]
  const toParent = calculateRelationship(adoptedFamily, 'adopted', 'adopter')
  const toChild = calculateRelationship(adoptedFamily, 'adopter', 'adopted')
  assert.equal(toParent?.titleKey, 'Adopted child')
  assert.equal(toChild?.titleKey, 'Adoptive parent')
  assert.equal(getRelationshipPathStepLabelKey(toParent.steps[0].kind), 'Adopted child of')
  assert.equal(getRelationshipPathStepLabelKey(toChild.steps[0].kind), 'Adoptive parent of')
})

test('distinguishes current and former spouse paths and supports multiple current marriages', () => {
  const spouseFamily = [
    person('personA', { spouseIds: ['personB', 'personC'], formerSpouseIds: ['former'] }),
    person('personB', { spouseIds: ['personA'] }),
    person('personC', { spouseIds: ['personA'] }),
    person('former', { formerSpouseIds: ['personA'] }),
  ]
  const current = calculateRelationship(spouseFamily, 'personA', 'personB')
  const previous = calculateRelationship(spouseFamily, 'personA', 'former')
  assert.equal(current?.titleKey, 'Spouse')
  assert.equal(previous?.titleKey, 'Former spouse')
  assert.equal(getRelationshipPathStepLabelKey(previous.steps[0].kind), 'Former spouse of')
})

test('identifies common in-law and step relationships in both directions', () => {
  const inLawFamily = [
    person('parent'),
    person('child', { parentIds: ['parent'], spouseIds: ['childSpouse'] }),
    person('childSpouse', { spouseIds: ['child'] }),
    person('stepparent', { spouseIds: ['parent'] }),
    person('siblingParent'),
    person('siblingA', { parentIds: ['siblingParent'] }),
    person('siblingB', { parentIds: ['siblingParent'], spouseIds: ['siblingSpouse'] }),
    person('siblingSpouse', { spouseIds: ['siblingB'] }),
  ]
  assert.equal(calculateRelationship(inLawFamily, 'parent', 'childSpouse')?.titleKey, 'Parent-in-law')
  assert.equal(calculateRelationship(inLawFamily, 'childSpouse', 'parent')?.titleKey, 'Child-in-law')
  assert.equal(calculateRelationship(inLawFamily, 'stepparent', 'child')?.titleKey, 'Step-parent')
  assert.equal(calculateRelationship(inLawFamily, 'child', 'stepparent')?.titleKey, 'Step-child')
  assert.equal(calculateRelationship(inLawFamily, 'siblingA', 'siblingSpouse')?.titleKey, 'Sibling-in-law')
  assert.equal(calculateRelationship(inLawFamily, 'siblingSpouse', 'siblingA')?.titleKey, 'Sibling-in-law')
})

test('returns a generic relationship for connected but ambiguous ancestry and no result for missing links', () => {
  const ambiguous = [
    person('ancestor', { gender: 'male' }),
    person('parentA', { gender: 'male', parentIds: ['ancestor'] }),
    person('parentB', { gender: 'female', parentIds: ['ancestor'] }),
    person('child', { gender: 'female', parentIds: ['parentA', 'parentB'] }),
  ]
  assert.equal(calculateRelationship(ambiguous, 'ancestor', 'child')?.titleKey, 'Grandfather')
  assert.equal(calculateRelationship([person('missingParentChild', { parentIds: ['missing'] }), person('other')], 'missingParentChild', 'other'), null)
})
