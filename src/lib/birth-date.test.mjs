import test from 'node:test'
import assert from 'node:assert/strict'
import { getBirthDateError, getDeathDateError } from './birth-date.ts'
import { validatePersonDates } from './family-validation.ts'

const now = new Date(2026, 9, 30, 12)

test('birth date validation preserves supported partial and complete date strings', () => {
  for (const value of ['1967', '1967-05', '1967-05-12']) assert.equal(getBirthDateError(value, now), '')
})

test('birth date validation rejects malformed, impossible, and future values', () => {
  assert.equal(getBirthDateError('1967-5', now), 'Enter a four-digit year, year and month, or complete date.')
  assert.equal(getBirthDateError('1967-13', now), 'Enter a month from 01 to 12.')
  assert.equal(getBirthDateError('1967-02-29', now), 'Enter a valid day for this month.')
  assert.equal(getBirthDateError('2027', now), 'Birth dates cannot be in the future.')
  assert.equal(getBirthDateError('2026-11', now), 'Birth dates cannot be in the future.')
  assert.equal(getBirthDateError('2026-10-31', now), 'Birth dates cannot be in the future.')
})

test('death date validation compares only the precision known by both values', () => {
  assert.equal(getDeathDateError('2012', '1967', now), '')
  assert.equal(getDeathDateError('1967-06', '1967-05', now), '')
  assert.equal(getDeathDateError('1967-05-13', '1967-05-12', now), '')
  assert.equal(getDeathDateError('1967-05', '1967-06', now), 'Death date must be after birth date.')
  assert.equal(getDeathDateError('1967-05', '1967', now), 'Death date must be after birth date.')
  assert.equal(getDeathDateError('1967-05-12', '1967-05-12', now), 'Death date must be after birth date.')
})

test('date rules accept year-month values without filling in missing parts', () => {
  assert.deepEqual(validatePersonDates('1967-05', '2012-06', '2026-10-30'), { ok: true })
  assert.equal(validatePersonDates('1967-05', '1967-04', '2026-10-30').ok, false)
  assert.equal(validatePersonDates('1967', '1967-05', '2026-10-30').ok, false)
})
