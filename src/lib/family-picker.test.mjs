import test from 'node:test'
import assert from 'node:assert/strict'
import { filterPickerMembers, getParentPickerMembers, getParentPickerOptions, getPickerCandidates, normalizePickerSearch } from './family-picker.ts'

function person(id, options = {}) {
  return {
    id,
    name: options.name ?? id,
    firstName: options.firstName ?? options.name ?? id,
    lastName: options.lastName,
    gender: options.gender,
    parentIds: options.parentIds ?? [],
    spouseIds: options.spouseIds ?? [],
    siblingIds: options.siblingIds ?? [],
    birthDate: options.birthDate,
    deathDate: options.deathDate,
  }
}

test('picker search matches first name, surname, accent folds, and Arabic diacritics', () => {
  const source = person('source')
  const members = [
    person('accent', { firstName: 'José', lastName: 'Morgan', name: 'José Morgan' }),
    person('arabic', { firstName: 'عَلِي', name: 'عَلِي' }),
  ]
  assert.deepEqual(filterPickerMembers(source, members, 'partner', 'jose').map((entry) => entry.id), ['accent'])
  assert.deepEqual(filterPickerMembers(source, members, 'partner', 'morgan').map((entry) => entry.id), ['accent'])
  assert.deepEqual(filterPickerMembers(source, members, 'partner', 'علي').map((entry) => entry.id), ['arabic'])
  assert.equal(normalizePickerSearch('ÉLODIE'), 'elodie')
})

test('picker excludes people already linked in that exact relationship', () => {
  const source = person('source', { spouseIds: ['partner'], siblingIds: ['sibling'] })
  const members = [source, person('partner'), person('sibling'), person('child', { parentIds: ['source'] }), person('other')]
  assert.deepEqual(filterPickerMembers(source, members, 'partner', '').map((entry) => entry.id), ['other'])
  assert.deepEqual(filterPickerMembers(source, members, 'child', '').map((entry) => entry.id), ['other'])
  assert.deepEqual(filterPickerMembers(source, members, 'sibling', '').map((entry) => entry.id), [])
})

test('parent options filter by gender and preserve an existing mismatched selection', () => {
  const members = [person('father', { gender: 'male' }), person('mother', { gender: 'female' }), person('legacy', { gender: 'female' })]
  assert.deepEqual(getParentPickerMembers(members, 'male').map((entry) => entry.id), ['father'])
  assert.deepEqual(getParentPickerMembers(members, 'female').map((entry) => entry.id), ['mother', 'legacy'])
  assert.deepEqual(getParentPickerMembers(members, 'male', 'legacy').map((entry) => entry.id), ['father', 'legacy'])
})

test('parent options show all matching genders before birth date and filter impossible parents afterward', () => {
  const candidates = [
    person('valid-father', { gender: 'male', birthDate: '1960' }),
    person('young-father', { gender: 'male', birthDate: '2005' }),
    person('close-father', { gender: 'male', birthDate: '1990' }),
    person('deceased-father', { gender: 'male', birthDate: '1960', deathDate: '1999' }),
    person('unknown-date-father', { gender: 'male' }),
    person('mother', { gender: 'female', birthDate: '1960' }),
  ]
  assert.deepEqual(getParentPickerOptions(candidates, 'male', '').members.map(({ id }) => id), ['valid-father', 'young-father', 'close-father', 'deceased-father', 'unknown-date-father'])
  const filtered = getParentPickerOptions(candidates, 'male', '2000', 'young-father')
  assert.deepEqual(filtered.members.map(({ id }) => id), ['valid-father', 'young-father', 'close-father', 'unknown-date-father'])
  assert.ok(filtered.warningIds.has('close-father'))
  assert.ok(!filtered.warningIds.has('valid-father'))
})

test('parent picker marks older parents with the matching translated note', () => {
  const mother = person('mother', { name: 'Mina', gender: 'female', birthDate: '1944' })
  const father = person('father', { name: 'Omar', gender: 'male', birthDate: '1919' })
  const mothers = getParentPickerOptions([mother], 'female', '2000')
  const fathers = getParentPickerOptions([father], 'male', '2000')
  assert.equal(mothers.warningKeys.get('mother'), 'Mother over 55 at birth')
  assert.equal(fathers.warningKeys.get('father'), 'Father over 80 at birth')
})

test('child picker hides older people, partners, siblings, full-parent children, and children born after death', () => {
  const source = person('source', { name: 'Alex', gender: 'male', birthDate: '1950', deathDate: '2000', spouseIds: ['partner'], siblingIds: ['sibling'] })
  const sharedParent = person('shared-parent')
  source.parentIds = ['shared-parent']
  const candidates = [
    source,
    sharedParent,
    person('partner', { gender: 'female', spouseIds: ['source'], birthDate: '1952' }),
    person('sibling', { parentIds: ['shared-parent'], birthDate: '1960' }),
    person('older-child', { birthDate: '1940' }),
    person('already-has-parents', { birthDate: '1980', parentIds: ['p1', 'p2'] }),
    person('after-death', { birthDate: '2001' }),
    person('valid-child', { birthDate: '1980' }),
    person('unknown-date'),
  ]
  const result = getPickerCandidates(source, candidates, 'child')
  assert.deepEqual(result.visible.map(({ person: item }) => item.id), ['valid-child', 'unknown-date'])
  assert.deepEqual(result.hidden.map(({ person: item }) => item.id), ['after-death', 'already-has-parents', 'older-child', 'partner', 'sibling', 'shared-parent'])
})

test('parent picker filters by missing parent role and disables full parent pairs', () => {
  const source = person('source', { name: 'Alex', gender: 'female', birthDate: '1980', parentIds: ['father'] })
  const father = person('father', { gender: 'male', birthDate: '1950' })
  const members = [source, father, person('mother-candidate', { gender: 'female', birthDate: '1955' }), person('father-candidate', { gender: 'male', birthDate: '1952' }), person('too-young', { gender: 'female', birthDate: '1990' })]
  assert.deepEqual(filterPickerMembers(source, members, 'parent').map((member) => member.id), ['mother-candidate'])
  const full = person('full', { birthDate: '1980', parentIds: ['father', 'mother'] })
  assert.deepEqual(getPickerCandidates(full, [...members, person('mother', { gender: 'female' })], 'parent').visible, [])
})

test('picker leaves age-uncertain people at the end and sorts each group by name', () => {
  const source = person('source', { gender: 'male', birthDate: '1980' })
  const members = [source, person('Zoe', { name: 'Zoe', gender: 'female', birthDate: '1990' }), person('Adam', { name: 'Adam', gender: 'female', birthDate: '1990' }), person('Ben', { name: 'Ben', gender: 'female' })]
  assert.deepEqual(filterPickerMembers(source, members, 'child').map((member) => member.id), ['Adam', 'Zoe', 'Ben'])
})

test('partner and sibling picker hide ancestor, descendant, sibling, and partner candidates', () => {
  const ancestor = person('ancestor', { birthDate: '1940' })
  const source = person('source', { name: 'Alex', birthDate: '1980', parentIds: ['ancestor'], spouseIds: ['partner'], siblingIds: ['sibling'] })
  const members = [ancestor, source, person('partner', { spouseIds: ['source'] }), person('sibling', { parentIds: ['ancestor'], siblingIds: ['source'] }), person('descendant', { parentIds: ['source'], birthDate: '2000' }), person('other')]
  assert.deepEqual(filterPickerMembers(source, members, 'partner').map((member) => member.id), ['other'])
  assert.deepEqual(filterPickerMembers(source, members, 'sibling').map((member) => member.id), ['other'])
})

test('partner picker marks age differences over 30 years with a short note', () => {
  const source = person('source', { name: 'Eleanor', gender: 'female', birthDate: '1940' })
  const partner = person('partner', { name: 'Zack', gender: 'male', birthDate: '1980' })
  const result = getPickerCandidates(source, [source, partner], 'partner')
  assert.equal(result.visible[0].warningKey, 'Age difference over 30 years')
})
