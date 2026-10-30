import assert from 'node:assert/strict'
import test from 'node:test'
import { strToU8, unzipSync, zipSync } from 'fflate'
import {
  createTreeArchive,
  getTreeArchiveFilename,
  parseTreeArchive,
  shouldShowBackupReminder,
} from './tree-archive.ts'

function person(id, name, gender, birthDate) {
  return {
    id,
    initials: name.slice(0, 1),
    name,
    firstName: name,
    lastName: '',
    relationship: 'Family member',
    gender,
    birthDate,
    parentIds: [],
    spouseIds: [],
    formerSpouseIds: [],
    adoptedParentIds: [],
    siblingIds: [],
    avatar: { skin: '#f1c7a5', hair: '#342b29', shirt: '#7182a3', hairstyle: 'waves' },
  }
}

const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const imageFixtures = [
  ['image/png', 'png', pngBytes],
  ['image/jpeg', 'jpg', Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])],
  ['image/webp', 'webp', Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])],
  ['image/gif', 'gif', Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0x80, 0, 0, 0, 0, 0, 0xff, 0xff, 0xff, 0x21, 0xf9, 4, 1, 0, 0, 0, 0, 0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 1, 0, 0x3b])],
]

async function archiveFor(members = [person('person-a', 'أمين Morgan', 'male', '1960')]) {
  const photos = new Map([[members[0]?.id ?? 'person-a', new Blob([pngBytes.slice().buffer], { type: 'image/png' })]])
  return createTreeArchive({
    tree: { id: 'tree-id', name: 'شجرة Morgan', createdAt: 1, updatedAt: 2 },
    members,
    settings: { theme: 'chocolate', nodeMode: 'rectangle' },
    photos,
    exportDate: '2026-10-26T12:00:00.000Z',
  })
}

test('tree ZIP export and import preserve Unicode names, links, photos, settings and branch colors', async () => {
  const father = person('father', 'James Morgan', 'male', '1960')
  const mother = person('mother', 'Eleanor Morgan', 'female', '1962')
  const child = person('child', 'ليلى Morgan', 'female', '1990')
  father.spouseIds = ['mother']
  mother.spouseIds = ['father']
  child.parentIds = ['father', 'mother']
  child.adoptedParentIds = ['mother']
  const bytes = await archiveFor([father, mother, child])
  const imported = parseTreeArchive(bytes)

  assert.equal(imported.treeName, 'شجرة Morgan')
  assert.equal(imported.exportDate, '2026-10-26T12:00:00.000Z')
  assert.deepEqual(imported.settings, { theme: 'chocolate', nodeMode: 'rectangle' })
  assert.equal(imported.members.find((item) => item.id === 'child').name, 'ليلى Morgan')
  assert.deepEqual(imported.members.find((item) => item.id === 'child').parentIds, ['father', 'mother'])
  assert.deepEqual(imported.members.find((item) => item.id === 'child').adoptedParentIds, ['mother'])
  assert.deepEqual(imported.members.find((item) => item.id === 'father').spouseIds, ['mother'])
  assert.equal(imported.photos.get('father').type, 'image/png')
  assert.deepEqual(imported.branchColors, { father: 'var(--branch-0)', mother: 'var(--branch-0)', child: 'var(--branch-0)' })
})

test('tree ZIP export and import preserve PNG, JPEG, WebP, and GIF photos', async () => {
  for (const [mimeType, extension, bytes] of imageFixtures) {
    const member = { ...person(`photo-${extension}`, `Photo ${extension}`, 'female', '1990'), photo: `blob:${extension}` }
    const archive = await createTreeArchive({
      tree: { id: 'tree-id', name: 'Image tree', createdAt: 1, updatedAt: 2 },
      members: [member],
      settings: {},
      photos: new Map([[member.id, new Blob([bytes], { type: mimeType })]]),
      exportDate: '2026-10-26T12:00:00.000Z',
    })
    const zipEntries = unzipSync(archive)
    assert.ok(zipEntries[`images/${member.id}.${extension}`])
    const imported = parseTreeArchive(archive)
    const photo = imported.photos.get(member.id)
    assert.equal(photo.type, mimeType)
    assert.deepEqual(new Uint8Array(await photo.arrayBuffer()), bytes)
  }
})

test('tree ZIP export rejects unsupported or missing photos instead of omitting them', async () => {
  const member = { ...person('unsupported-photo', 'Unsupported Photo', 'female', '1990'), photo: 'blob:unsupported' }
  const input = { tree: { id: 'tree-id', name: 'Image tree', createdAt: 1, updatedAt: 2 }, members: [member], settings: {}, photos: new Map() }
  await assert.rejects(createTreeArchive(input), /A photo could not be included in the backup\./)
  await assert.rejects(createTreeArchive({ ...input, photos: new Map([[member.id, new Blob([pngBytes], { type: 'image/bmp' })]]) }), /A photo uses an unsupported format\./)
  await assert.rejects(createTreeArchive({ ...input, photos: new Map([[member.id, new Blob([pngBytes], { type: 'image/gif' })]]) }), /An image is invalid or too large\./)
  await assert.rejects(createTreeArchive({ ...input, members: [person('no-photo', 'No Photo', 'female', '1990')], photos: new Map([[member.id, new Blob([pngBytes], { type: 'image/png' })]]) }), /A photo could not be included in the backup\./)
})

test('version 1 archives without a revision field remain importable', async () => {
  const legacyBytes = await archiveFor([person('legacy-person', 'Legacy Person', 'male', '1960')])
  const legacyEntries = unzipSync(legacyBytes)
  const family = JSON.parse(new TextDecoder().decode(legacyEntries['family.json']))
  assert.equal(family.version, 1)
  assert.equal(Object.hasOwn(family.tree, 'revision'), false)
  assert.equal(parseTreeArchive(legacyBytes).members[0].id, 'legacy-person')
})

test('tree ZIP parser rejects broken ZIP data', () => {
  assert.throws(() => parseTreeArchive(Uint8Array.from([0, 1, 2, 3])), /This ZIP file is broken or incomplete\./)
})

test('tree ZIP parser rejects unsafe archive paths', async () => {
  const valid = await archiveFor()
  const entries = unzipSync(valid)
  const zipped = zipSync({ ...entries, '../outside.txt': strToU8('ignored') })
  assert.throws(() => parseTreeArchive(zipped), /The archive contains an unsafe path\./)
})

test('tree ZIP parser rejects links to missing people', async () => {
  const child = person('child', 'Child Morgan', 'female', '1990')
  child.parentIds = ['missing-parent']
  const invalid = await archiveFor([child])
  assert.throws(() => parseTreeArchive(invalid), /A relationship points to a person that does not exist\./)
})

test('tree ZIP parser enforces the archive byte limit before reading entries', () => {
  assert.throws(() => parseTreeArchive(new Uint8Array(10), { maxArchiveBytes: 9, maxImageBytes: 100, maxPeople: 10, maxUncompressedBytes: 100, maxFamilyJsonBytes: 100 }), /The ZIP file is too large\./)
})

test('tree ZIP filename keeps Arabic names and date-safe characters', () => {
  assert.equal(getTreeArchiveFilename('شجرة Morgan / 2026', new Date('2026-10-26T00:00:00.000Z')), 'شجرة-Morgan-2026-2026-10-26.zip')
})

test('backup reminder waits 30 days and only appears after a tree change', () => {
  const day = 24 * 60 * 60 * 1000
  const tree = { createdAt: 0, updatedAt: 0, lastBackupAt: 0 }
  assert.equal(shouldShowBackupReminder(tree, day * 31), false)
  assert.equal(shouldShowBackupReminder({ ...tree, updatedAt: 1 }, day * 29), false)
  assert.equal(shouldShowBackupReminder({ ...tree, updatedAt: 1 }, day * 30), true)
  assert.equal(shouldShowBackupReminder({ ...tree, updatedAt: day * 35, lastBackupAt: day * 5 }, day * 36), true)
})
