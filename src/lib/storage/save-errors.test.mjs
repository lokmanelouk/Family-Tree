import test from 'node:test'
import assert from 'node:assert/strict'
import { getTreeSaveErrorKey } from './save-errors.ts'

test('permission failures show the edit permission message', () => {
  assert.equal(getTreeSaveErrorKey({ code: '42501', message: 'new row violates row-level security policy' }), "You don't have permission to edit this tree")
  assert.equal(getTreeSaveErrorKey({ status: 403, message: 'Forbidden' }), "You don't have permission to edit this tree")
})

test('other save failures show a retry message', () => {
  assert.equal(getTreeSaveErrorKey(new Error('Network request failed')), 'Could not save, try again')
  assert.equal(getTreeSaveErrorKey(null), 'Could not save, try again')
})
