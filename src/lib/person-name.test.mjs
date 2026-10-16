import test from 'node:test'
import assert from 'node:assert/strict'
import { getPersonNameDirection } from './person-name.ts'
import { getDisambiguatedFullName } from './member-name.ts'

test('mixed Arabic and Latin names follow the page direction', () => {
  const sentence = 'Born in 1840, حسن Morgan would be over 120 years old.'
  const name = sentence.match(/حسن Morgan/u)?.[0] ?? ''
  assert.equal(getPersonNameDirection(name, 'en'), 'ltr')
  assert.equal(getPersonNameDirection(name, 'ar'), 'rtl')
})

test('single-script names retain automatic direction', () => {
  assert.equal(getPersonNameDirection('David Morgan', 'ar'), 'auto')
  assert.equal(getPersonNameDirection('حسن Morgan', 'en'), 'ltr')
  assert.equal(getPersonNameDirection('حسن', 'en'), 'auto')
})

test('duplicate full names show birth years while unique names stay unchanged', () => {
  const older = { id: 'older', name: 'David Morgan', firstName: 'David', lastName: 'Morgan', birthDate: '1967', parentIds: [], spouseIds: [], siblingIds: [] }
  const younger = { ...older, id: 'younger', birthDate: '1998' }
  const unique = { ...older, id: 'unique', name: 'James Morgan', firstName: 'James', birthDate: '1940' }
  const members = [older, younger, unique]
  assert.equal(getDisambiguatedFullName(older, members), 'David Morgan (1967)')
  assert.equal(getDisambiguatedFullName(younger, members), 'David Morgan (1998)')
  assert.equal(getDisambiguatedFullName(unique, members), 'James Morgan')
})
