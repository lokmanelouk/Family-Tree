import test from 'node:test'
import assert from 'node:assert/strict'
import { getVisibleRelatives, isRelationshipSectionCollapsed, popDetailsNavigation, pushDetailsNavigation } from './details-panel.ts'

test('relationship sections expand by default only when populated except siblings', () => {
  assert.equal(isRelationshipSectionCollapsed('partners', 1), false)
  assert.equal(isRelationshipSectionCollapsed('children', 1), false)
  assert.equal(isRelationshipSectionCollapsed('parents', 1), false)
  assert.equal(isRelationshipSectionCollapsed('siblings', 1), true)
  assert.equal(isRelationshipSectionCollapsed('partners', 0), true)
})

test('manual section choice overrides the default', () => {
  assert.equal(isRelationshipSectionCollapsed('siblings', 2, false), false)
  assert.equal(isRelationshipSectionCollapsed('parents', 0, false), false)
})

test('relative previews show five items until expanded', () => {
  const people = Array.from({ length: 12 }, (_, index) => index)
  assert.deepEqual(getVisibleRelatives(people, false), [0, 1, 2, 3, 4])
  assert.deepEqual(getVisibleRelatives(people, true), people)
})

test('details back navigation follows visited people in reverse order', () => {
  const history = pushDetailsNavigation(pushDetailsNavigation([], 'james'), 'david')
  assert.deepEqual(popDetailsNavigation(history), { personId: 'david', history: ['james'] })
  assert.deepEqual(popDetailsNavigation(['james']), { personId: 'james', history: [] })
  assert.deepEqual(popDetailsNavigation([]), { personId: null, history: [] })
})
