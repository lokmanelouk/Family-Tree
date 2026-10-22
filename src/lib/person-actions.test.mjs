import test from 'node:test'
import assert from 'node:assert/strict'
import { getCreateRelativeLabelKey, getNextPickerIndex, getPersonContextActions, getRelationshipActionAvailability, hasUnsavedChanges } from './person-actions.ts'

function member(parentIds = []) {
  return { id: 'person', parentIds, spouseIds: [], formerSpouseIds: [], siblingIds: [] }
}

test('discard check ignores unchanged values and detects edited values', () => {
  const initial = { name: 'Eleanor Morgan', birthDate: '', photo: '' }
  assert.equal(hasUnsavedChanges(initial, { ...initial }), false)
  assert.equal(hasUnsavedChanges(initial, { ...initial, name: 'Eleanor Lee' }), true)
})

test('context menu exposes the requested actions and disables impossible additions', () => {
  const actions = getPersonContextActions(member(['father', 'mother']))
  assert.deepEqual(actions.map((action) => action.kind), ['details', 'edit', 'child', 'partner', 'parent', 'sibling', 'delete'])
  assert.equal(actions.find((action) => action.kind === 'parent')?.disabled, true)
  assert.equal(actions.find((action) => action.kind === 'parent')?.reason, 'Already has two parents')
  assert.equal(actions.find((action) => action.kind === 'sibling')?.disabled, false)
})

test('sibling creation is disabled if no parents are linked', () => {
  const sibling = getPersonContextActions(member()).find((action) => action.kind === 'sibling')
  assert.equal(sibling?.disabled, true)
  assert.equal(sibling?.reason, 'Add a parent first')
})

test('relationship action availability applies parent, sibling, and partner validation consistently', () => {
  const twoParents = member(['father', 'mother'])
  const parentAction = getRelationshipActionAvailability(twoParents, [twoParents], 'parent')
  assert.equal(parentAction.disabled, true)
  assert.equal(parentAction.reason, 'Already has two parents')

  const noParents = member()
  const siblingAction = getRelationshipActionAvailability(noParents, [noParents], 'sibling')
  assert.equal(siblingAction.disabled, true)
  assert.equal(siblingAction.reason, 'Add a parent first')

  const marriedWoman = { ...member(), gender: 'female', spouseIds: ['husband'] }
  const partnerAction = getRelationshipActionAvailability(marriedWoman, [marriedWoman], 'partner')
  assert.equal(partnerAction.disabled, true)
  assert.equal(partnerAction.reason, 'A female family member can have only one husband.')

  const man = { ...member(), gender: 'male' }
  assert.equal(getRelationshipActionAvailability(man, [man], 'partner').disabled, false)
  assert.equal(getRelationshipActionAvailability(man, [man], 'child').disabled, false)
})

test('contextual create labels match each relationship', () => {
  assert.equal(getCreateRelativeLabelKey('child'), 'Create new child')
  assert.equal(getCreateRelativeLabelKey('parent'), 'Create new parent')
  assert.equal(getCreateRelativeLabelKey('partner'), 'Create new partner')
  assert.equal(getCreateRelativeLabelKey('sibling'), 'Create new sibling')
})

test('picker keyboard navigation wraps and handles an empty result list', () => {
  assert.equal(getNextPickerIndex(-1, 3, 'next'), 0)
  assert.equal(getNextPickerIndex(2, 3, 'next'), 0)
  assert.equal(getNextPickerIndex(0, 3, 'previous'), 2)
  assert.equal(getNextPickerIndex(0, 0, 'next'), -1)
})
