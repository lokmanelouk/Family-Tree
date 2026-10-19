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
  validatePartnerAgeGap,
  validatePartnerConstraints,
  validatePersonDates,
  validateRelationshipRules,
  validateSelfRelation,
  isValidTreeSnapshot,
  MAX_FATHER_AGE_AT_BIRTH,
  MAX_MOTHER_AGE_AT_BIRTH,
} from './family-validation.ts'
import { interpolateMessageParts } from './message-format.ts'

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
    lifeStatus: options.lifeStatus,
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

test('mother age at a child birth warns only above 55 and skips unknown birth years', () => {
  assert.equal(MAX_MOTHER_AGE_AT_BIRTH, 55)
  const child = person('child', { birthDate: '2000' })
  const normal = issue(validateParentAge(person('mother', { name: 'Mina', gender: 'female', birthDate: '1960' }), child))
  assert.equal(normal, null)
  assert.equal(issue(validateParentAge(person('mother', { gender: 'female', birthDate: '1945' }), child)), null)
  const warning = issue(validateParentAge(person('mother', { name: 'Mina', gender: 'female', birthDate: '1944' }), child))
  assert.deepEqual(warning, { type: 'warning', messageKey: 'Mother age at birth: many', values: { name: 'Mina', age: 56 } })
  assert.equal(issue(validateParentAge(person('mother', { gender: 'female' }), child)), null)
  assert.equal(issue(validateParentAge(person('mother', { gender: 'female', birthDate: '1944' }), person('child'))), null)
})

test('father age at a child birth warns only above 80 and skips unknown birth years', () => {
  assert.equal(MAX_FATHER_AGE_AT_BIRTH, 80)
  const child = person('child', { birthDate: '2000' })
  assert.equal(issue(validateParentAge(person('father', { gender: 'male', birthDate: '1920' }), child)), null)
  const warning = issue(validateParentAge(person('father', { name: 'Omar', gender: 'male', birthDate: '1919' }), child))
  assert.deepEqual(warning, { type: 'warning', messageKey: 'Father age at birth: many', values: { name: 'Omar', age: 81 } })
  assert.equal(issue(validateParentAge(person('father', { gender: 'male' }), child)), null)
  assert.equal(issue(validateParentAge(person('father', { gender: 'male', birthDate: '1919' }), person('child'))), null)
})

test('older adoptive parents produce a warning but adoption remains allowed', () => {
  const mother = person('mother', { name: 'Mina', gender: 'female', birthDate: '1944' })
  const child = person('child', { birthDate: '2000' })
  const issues = collectValidationIssues(validateRelationshipRules([mother, child], mother, child, 'adopted'))
  assert.deepEqual(issues, [{ type: 'warning', messageKey: 'Mother age at birth: many', values: { name: 'Mina', age: 56 } }])
})

test('matching parent age errors and warnings merge into one two-name message', () => {
  const child = person('child', { name: 'Sam', birthDate: '2000' })
  const mother = person('mother', { name: 'Layla', gender: 'female', birthDate: '1990' })
  const father = person('father', { name: 'Zack', gender: 'male', birthDate: '1990' })
  const warning = collectValidationIssues([
    validateParentAge(father, child),
    validateParentAge(mother, child),
  ])
  assert.deepEqual(warning, [{ type: 'warning', messageKey: 'Both parents are less than {years} years older than {child}.', values: { a: 'Zack', b: 'Layla', child: 'Sam', years: 15 } }])
  const error = collectValidationIssues([
    validateParentAge(person('father', { name: 'Zack', birthDate: '2000' }), child),
    validateParentAge(person('mother', { name: 'Layla', birthDate: '2001' }), child),
  ])
  assert.deepEqual(error, [{ type: 'error', messageKey: 'Both parents must be older than {child}.', values: { a: 'Zack', b: 'Layla', child: 'Sam' } }])
})

test('validation message interpolation replaces every named value without marker text', () => {
  const parts = interpolateMessageParts('{a} and {b} must be older than {child}.', { a: 'Zack', b: 'Layla', child: 'Sam' })
  const message = parts.map((part) => part.value).join('')
  assert.equal(message, 'Zack and Layla must be older than Sam.')
  assert.doesNotMatch(message, /__VALUE/)
  const arabicParts = interpolateMessageParts('يجب أن يكون كل من {a} و{b} أكبر سنًا من {child}.', { a: 'زكريا', b: 'ليلى', child: 'سام' })
  const arabicMessage = arabicParts.map((part) => part.value).join('')
  assert.equal(arabicMessage, 'يجب أن يكون كل من زكريا وليلى أكبر سنًا من سام.')
  assert.doesNotMatch(arabicMessage, /__VALUE/)
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

test('partner age gap warns only when both known birth years differ by more than 30 years', () => {
  assert.deepEqual(issue(validatePartnerAgeGap(person('a', { birthDate: '1940' }), person('b', { birthDate: '1980' }))), { type: 'warning', messageKey: 'Age difference over 30 years.', values: {} })
  assert.equal(issue(validatePartnerAgeGap(person('a', { birthDate: '1950' }), person('b', { birthDate: '1980' }))), null)
  assert.equal(issue(validatePartnerAgeGap(person('a', { birthDate: '1950' }), person('b'))), null)
})

test('relationship rules check partner duplicates and parent cycles', () => {
  const a = person('a', { spouseIds: ['b'] })
  const b = person('b')
  assert.ok(collectValidationIssues(validateRelationshipRules([a, b], a, b, 'partner')).some((item) => item.type === 'error'))
  const parent = person('parent', { parentIds: ['child'], birthDate: '1940' })
  const child = person('child', { birthDate: '2000' })
  assert.ok(collectValidationIssues(validateRelationshipRules([parent, child], parent, child, 'child')).some((item) => item.messageKey === 'A person cannot be their own ancestor.'))
})

test('sibling linking requires a linked parent and validates inherited parent relationships', () => {
  const personWithoutParents = person('current')
  const candidate = person('candidate')
  assert.ok(collectValidationIssues(validateRelationshipRules([personWithoutParents, candidate], personWithoutParents, candidate, 'sibling')).some((item) => item.messageKey === 'Add a parent first.'))

  const father = person('father', { gender: 'male', birthDate: '1950' })
  const current = person('current', { birthDate: '1990', parentIds: ['father'] })
  const sibling = person('sibling', { birthDate: '1992' })
  const issues = collectValidationIssues(validateRelationshipRules([father, current, sibling], current, sibling, 'sibling'))
  assert.equal(issues.length, 0)
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
  assert.equal(issue(validateAgeLimit(person('member', { birthDate: '1905', lifeStatus: 'living' }), '2026')).type, 'warning')
  assert.equal(issue(validateAgeLimit(person('member', { birthDate: '1906', lifeStatus: 'living' }), '2026')), null)
  assert.equal(issue(validateAgeLimit(person('member'), '2026')), null)
})

test('age limit checks living people against today and deceased people at death', () => {
  const living = person('ancient', { name: 'Hasan', gender: 'male', birthDate: '1840', lifeStatus: 'living' })
  assert.deepEqual(issue(validateAgeLimit(living, '2026')), {
    type: 'warning',
    messageKey: 'Born in {year}, {name} would be over 120 years old (male).',
    values: { name: 'Hasan', year: 1840 },
  })

  assert.equal(issue(validateAgeLimit(person('deceased', { birthDate: '1800', deathDate: '1900', lifeStatus: 'deceased' }), '2026')), null)
  assert.equal(issue(validateAgeLimit(person('centenarian', { birthDate: '1800', deathDate: '1930', lifeStatus: 'deceased' }), '2026')).type, 'warning')
  assert.equal(issue(validateAgeLimit(person('unknown-death', { birthDate: '1800', lifeStatus: 'deceased' }), '2026')), null)
  assert.equal(issue(validateAgeLimit(person('living-record-with-death', { birthDate: '1800', deathDate: '1850', lifeStatus: 'living' }), '2026')), null)
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
