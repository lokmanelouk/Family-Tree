import test from 'node:test'
import assert from 'node:assert/strict'
import { canEditTree, canManageTree } from './tree-permissions.ts'

test('viewers cannot edit family trees', () => {
  assert.equal(canEditTree('viewer'), false)
  assert.equal(canEditTree(null), false)
})

test('editors can edit but cannot manage sharing', () => {
  assert.equal(canEditTree('editor'), true)
  assert.equal(canManageTree('editor'), false)
})

test('only owners can manage sharing and membership', () => {
  assert.equal(canManageTree('owner'), true)
  assert.equal(canEditTree('owner'), true)
  assert.equal(canManageTree('editor'), false)
  assert.equal(canManageTree('viewer'), false)
})
