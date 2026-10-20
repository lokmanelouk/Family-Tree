import test from 'node:test'
import assert from 'node:assert/strict'
import { familyMembersToRows, rowsToFamilyMembers } from './tree-data.ts'

test('loads people, adoption links, former partners, and sibling groups from database rows', () => {
  const people = [
    { id: 'a', tree_id: 'tree', first_name: 'James', last_name: 'Morgan', gender: 'male', birth_date: '1938', death_date: '2012', deceased: true, photo_path: null },
    { id: 'b', tree_id: 'tree', first_name: 'Eleanor', last_name: 'Morgan', gender: 'female', birth_date: '1941', death_date: null, deceased: false, photo_path: '/family/eleanor.png' },
    { id: 'c', tree_id: 'tree', first_name: 'David', last_name: 'Morgan', gender: 'male', birth_date: '1967', death_date: null, deceased: false, photo_path: null },
    { id: 'd', tree_id: 'tree', first_name: 'Sam', last_name: null, gender: 'male', birth_date: '2011-09-14', death_date: null, deceased: false, photo_path: null },
  ]
  const parents = [
    { tree_id: 'tree', child_id: 'c', parent_id: 'a', kind: 'biological' },
    { tree_id: 'tree', child_id: 'c', parent_id: 'b', kind: 'biological' },
    { tree_id: 'tree', child_id: 'd', parent_id: 'c', kind: 'adoptive' },
  ]
  const partners = [{ tree_id: 'tree', person_a: 'a', person_b: 'b', status: 'former' }]
  const members = rowsToFamilyMembers(people, parents, partners)
  assert.equal(members[0].name, 'James Morgan')
  assert.equal(members[0].lifeStatus, 'deceased')
  assert.equal(members[1].photo, '/family/eleanor.png')
  assert.deepEqual(members[0].formerSpouseIds, ['b'])
  assert.deepEqual(members[1].formerSpouseIds, ['a'])
  assert.deepEqual(members[2].parentIds, ['a', 'b'])
  assert.deepEqual(members[3].adoptedParentIds, ['c'])
  assert.ok(members[2].siblingIds.includes('d') === false)
})

test('converts app people and links to database rows using text dates and relationship kinds', () => {
  const members = [
    { id: 'a', name: 'James Morgan', firstName: 'James', lastName: 'Morgan', initials: 'JM', relationship: 'Family member', gender: 'male', birthDate: '1938', deathDate: '2012', lifeStatus: 'deceased', parentIds: [], spouseIds: ['b'], formerSpouseIds: [], adoptedParentIds: [], siblingIds: [], avatar: { skin: '#d8b294', hair: '#77766e', shirt: '#aebbb3', hairstyle: 'side' } },
    { id: 'b', name: 'Eleanor Morgan', firstName: 'Eleanor', lastName: 'Morgan', initials: 'EM', relationship: 'Family member', gender: 'female', birthDate: '1941', parentIds: [], spouseIds: ['a'], formerSpouseIds: [], adoptedParentIds: [], siblingIds: [], avatar: { skin: '#d8b294', hair: '#77766e', shirt: '#aebbb3', hairstyle: 'side' } },
    { id: 'c', name: 'Sam', firstName: 'Sam', lastName: '', initials: 'S', relationship: 'Family member', gender: 'male', birthDate: '2011-09-14', parentIds: ['a'], spouseIds: [], formerSpouseIds: [], adoptedParentIds: ['a'], siblingIds: [], avatar: { skin: '#d8b294', hair: '#77766e', shirt: '#aebbb3', hairstyle: 'side' } },
  ]
  const rows = familyMembersToRows('tree', members)
  assert.deepEqual(rows.people.map(({ id, first_name, last_name, birth_date, death_date, deceased }) => ({ id, first_name, last_name, birth_date, death_date, deceased })), [
    { id: 'a', first_name: 'James', last_name: 'Morgan', birth_date: '1938', death_date: '2012', deceased: true },
    { id: 'b', first_name: 'Eleanor', last_name: 'Morgan', birth_date: '1941', death_date: null, deceased: false },
    { id: 'c', first_name: 'Sam', last_name: null, birth_date: '2011-09-14', death_date: null, deceased: false },
  ])
  assert.equal(rows.parentLinks[0].kind, 'adoptive')
  assert.equal(rows.partnerLinks[0].status, 'married')
})

test('splits legacy full names on the final space when saving', () => {
  const rows = familyMembersToRows('tree', [
    { id: 'legacy', name: 'David James Morgan', initials: 'DJ', relationship: 'Family member', gender: 'male', parentIds: [], spouseIds: [], siblingIds: [], avatar: { skin: '#d8b294', hair: '#77766e', shirt: '#aebbb3', hairstyle: 'side' } },
  ])
  assert.equal(rows.people[0].first_name, 'David James')
  assert.equal(rows.people[0].last_name, 'Morgan')
})
