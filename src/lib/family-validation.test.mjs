import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectValidationIssues,
  validateAgeLimit,
  validateAncestorCycle,
  validateParentAge,
  validateParentDeath,
  validateParentRole,
  validatePartnerDuplicate,
  validatePartnerConstraints,
  validatePersonDates,
  validateRelationshipRules,
  validateSelfRelation,
  isValidTreeSnapshot,
} from './family-validation.ts'

function person(id, options = {}) {
  return {
    id,
    name: options.name ?? id,
    firstName: options.name ?? id,
    initials: id.slice(0, 2),
    relationship: 'Family member',
    gender: options.gender,
    birthDate: options.birthDate,
    deathDate: options.deathDate,
    parentIds: options.parentIds ?? [],
    spouseIds: options.spouseIds ?? [],
    siblingIds: options.siblingIds ?? [],
    avatar: { skin: '#c98', hair: '#321', shirt: '#abc', hairstyle: 'waves' },
  }
}

function issue(outcome) {
  return outcome.ok ? null : outcome.result
}

test('parent age uses year precision for year-only dates', () => {
  assert.equal(issue(validateParentAge(person('parent', { birthDate: '1980' }), person('child', { birthDate: '2000' }))), null)
  assert.equal(issue(validateParentAge(person('parent', { birthDate: '2000' }), person('child', { birthDate: '1980' }))).type, 'error')
  assert.equal(issue(validateParentAge(person('parent', { birthDate: '1980-12-31' }), person('child', { birthDate: '1980-01-01' }))).type, 'error')
})

test('parent age gap warns under 15 years and accepts the threshold', () => {
  assert.equal(issue(validateParentAge(person('p', { birthDate: '1990' }), person('c', { birthDate: '2004' }))).type, 'warning')
  assert.equal(issue(validateParentAge(person('p', { birthDate: '1990' }), person('c', { birthDate: '2005' }))), null)
  assert.equal(issue(validateParentAge(person('p'), person('c'))), null)
})

test('ancestor validation follows the complete ancestor chain', () => {
  const root = person('root')
  const grandparent = person('grandparent', { parentIds: ['root'] })
  const parent = person('parent', { parentIds: ['grandparent'] })
  const child = person('child', { parentIds: ['parent'] })
  assert.equal(issue(validateAncestorCycle([root, grandparent, parent, child], child, root)).type, 'error')
  assert.equal(issue(validateAncestorCycle([root, grandparent, parent, child], root, child)), null)
  assert.equal(issue(validateAncestorCycle([root], root, root)).type, 'error')
})

test('self relation is rejected for all supported relation roles', () => {
  const member = person('one')
  for (const kind of ['parent', 'child', 'partner', 'sibling']) assert.equal(issue(validateSelfRelation(member, member, kind)).type, 'error')
  assert.equal(issue(validateSelfRelation(member, person('two'), 'partner')), null)
})

test('duplicate partners are rejected while distinct partners are allowed', () => {
  assert.equal(issue(validatePartnerDuplicate(person('a', { spouseIds: ['b'] }), person('b'))).type, 'error')
  assert.equal(issue(validatePartnerDuplicate(person('a'), person('b'))), null)
  assert.equal(issue(validatePartnerDuplicate(person('a'), person('a'))), null)
})

test('partner constraints preserve monogamy for women and allow multiple wives for men', () => {
  assert.ok(collectValidationIssues(validatePartnerConstraints(person('woman', { gender: 'female', spouseIds: ['husband'] }), person('new', { gender: 'male' }))).some((item) => item.type === 'error'))
  assert.equal(collectValidationIssues(validatePartnerConstraints(person('husband', { gender: 'male', spouseIds: ['wife-1', 'wife-2'] }), person('new-wife', { gender: 'female' }))).length, 0)
  assert.ok(collectValidationIssues(validatePartnerConstraints(person('a', { gender: 'male' }), person('b', { gender: 'male' }))).some((item) => item.type === 'error'))
})

test('relationship rules check partner duplicates and parent cycles', () => {
  const a = person('a', { spouseIds: ['b'] })
  const b = person('b')
  assert.ok(collectValidationIssues(validateRelationshipRules([a, b], a, b, 'partner')).some((item) => item.type === 'error'))
  const parent = person('parent', { parentIds: ['child'], birthDate: '1940' })
  const child = person('child', { birthDate: '2000' })
  assert.ok(collectValidationIssues(validateRelationshipRules([parent, child], parent, child, 'child')).some((item) => item.messageKey === 'A person cannot be their own ancestor.'))
})

test('date validation checks ordering, calendar validity, future dates, and year-only values', () => {
  assert.equal(issue(validatePersonDates('1982', '2010', '2026-01-01')), null)
  assert.equal(issue(validatePersonDates('1982-02-29', undefined, '2026-01-01')).type, 'error')
  assert.equal(issue(validatePersonDates('2000', '2000', '2026-01-01')).type, 'error')
  assert.equal(issue(validatePersonDates('2027', undefined, '2026-01-01')).type, 'error')
  assert.equal(issue(validatePersonDates(undefined, '2027', '2026-01-01')).type, 'error')
})

test('death date must follow birth date and father gets a one-year tolerance', () => {
  assert.equal(issue(validateParentDeath(person('mother', { deathDate: '2000' }), person('child', { birthDate: '2001' }), 'mother')).type, 'error')
  assert.equal(issue(validateParentDeath(person('father', { deathDate: '2000' }), person('child', { birthDate: '2001' }), 'father')), null)
  assert.equal(issue(validateParentDeath(person('father', { deathDate: '1999' }), person('child', { birthDate: '2001' }), 'father')).type, 'error')
  assert.equal(issue(validatePersonDates('2000', '1999', '2026')).type, 'error')
})

test('age limit warns above 120 and accepts the edge', () => {
  assert.equal(issue(validateAgeLimit(person('member', { birthDate: '1905' }), '2026')).type, 'warning')
  assert.equal(issue(validateAgeLimit(person('member', { birthDate: '1906' }), '2026')), null)
  assert.equal(issue(validateAgeLimit(person('member'), '2026')), null)
})

test('parent role mismatch is a warning', () => {
  assert.equal(issue(validateParentRole(person('father', { gender: 'male' }), 'father')), null)
  assert.equal(issue(validateParentRole(person('parent', { gender: 'female' }), 'father')).type, 'warning')
  assert.equal(issue(validateParentRole(person('parent'), 'mother')).type, 'warning')
})

test('tree snapshots reject cycles, invalid dates, and duplicate or one-sided partner links', () => {
  const parent = person('parent', { gender: 'male', birthDate: '1950', spouseIds: ['partner'] })
  const partner = person('partner', { gender: 'female', birthDate: '1952', spouseIds: ['parent'] })
  const child = person('child', { birthDate: '1980', parentIds: ['parent', 'partner'] })
  assert.equal(isValidTreeSnapshot([parent, partner, child], '2026-10-15'), true)
  assert.equal(isValidTreeSnapshot([person('ancestor', { birthDate: '1940', parentIds: ['descendant'] }), person('descendant', { birthDate: '2000', parentIds: ['ancestor'] })], '2026-10-15'), false)
  assert.equal(isValidTreeSnapshot([person('bad', { birthDate: '2000', deathDate: '1999' })], '2026-10-15'), false)
  assert.equal(isValidTreeSnapshot([person('one', { spouseIds: ['two'] }), person('two')], '2026-10-15'), false)
  assert.equal(isValidTreeSnapshot([person('one', { parentIds: ['missing'] })], '2026-10-15'), false)
  const husbandA = person('husband-a', { gender: 'male', spouseIds: ['wife'] })
  const husbandB = person('husband-b', { gender: 'male', spouseIds: ['wife'] })
  const wife = person('wife', { gender: 'female', spouseIds: ['husband-a', 'husband-b'] })
  assert.equal(isValidTreeSnapshot([husbandA, husbandB, wife], '2026-10-15'), false)
  const husband = person('husband', { gender: 'male', spouseIds: ['wife-a', 'wife-b'] })
  const wifeA = person('wife-a', { gender: 'female', spouseIds: ['husband'] })
  const wifeB = person('wife-b', { gender: 'female', spouseIds: ['husband'] })
  assert.equal(isValidTreeSnapshot([husband, wifeA, wifeB], '2026-10-15'), true)
})
