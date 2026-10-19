import test from 'node:test'
import assert from 'node:assert/strict'
import { getPersonContextActions, hasUnsavedChanges } from './person-actions.ts'

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
  assert.deepEqual(actions.map((action) => action.kind), ['details', 'edit', 'child', 'partner', 'parent', 'sibling', 'center', 'delete'])
  assert.equal(actions.find((action) => action.kind === 'parent')?.disabled, true)
  assert.equal(actions.find((action) => action.kind === 'parent')?.reason, 'Already has two parents')
  assert.equal(actions.find((action) => action.kind === 'sibling')?.disabled, false)
})

test('sibling creation is disabled if no parents are linked', () => {
  const sibling = getPersonContextActions(member()).find((action) => action.kind === 'sibling')
  assert.equal(sibling?.disabled, true)
  assert.equal(sibling?.reason, 'Add a parent first')
})
