import test from 'node:test'
import assert from 'node:assert/strict'
import { formatFamilyDate } from './display-date.ts'

test('full dates use a localized human-friendly format without changing year-only values', () => {
  assert.equal(formatFamilyDate('2021', 'en'), '2021')
  assert.equal(formatFamilyDate('2021-04-08', 'en'), '08 Apr 2021')
  assert.match(formatFamilyDate('2021-04-08', 'ar'), /٢٠٢١|2021/)
  assert.equal(formatFamilyDate('2021-02-30', 'en'), '2021-02-30')
  assert.equal(formatFamilyDate(undefined, 'en'), null)
})
