import test from 'node:test'
import assert from 'node:assert/strict'
import { getLayoutDirection, layoutDirection } from './layout.ts'

test('layout direction defaults to keep', () => {
  assert.equal(layoutDirection, 'keep')
  assert.equal(getLayoutDirection('en'), 'ltr')
  assert.equal(getLayoutDirection('ar'), 'ltr')
})

test('mirror mode preserves the existing Arabic RTL layout', () => {
  assert.equal(getLayoutDirection('en', 'mirror'), 'ltr')
  assert.equal(getLayoutDirection('ar', 'mirror'), 'rtl')
})
