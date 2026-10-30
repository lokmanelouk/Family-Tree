import assert from 'node:assert/strict'
import test from 'node:test'
import { familyMembers } from '../../data/family.ts'
import { addParentLink, addPartnerLink, addPerson, createTree, deletePerson, deleteTree, editPerson, importTreeData, listTrees, loadTree, loadTreePhotos, removeParentLink, renameTree, saveTreeChanges, saveTreeSettings } from './local-tree-storage.ts'
import { createTreeArchive, parseTreeArchive } from '../tree-archive.ts'

class FakeRequest {
  result
  error
  onsuccess = null
  onerror = null
}

class FakeStore {
  constructor(transaction, name, definition, records) {
    this.transaction = transaction
    this.name = name
    this.definition = definition
    this.records = records
  }
  add(value) { return this.run(() => { const key = value[this.definition.keyPath]; if (this.records.has(key)) throw new Error('ConstraintError'); this.records.set(key, structuredClone(value)); return key }) }
  put(value) { return this.run(() => { const key = value[this.definition.keyPath]; this.records.set(key, structuredClone(value)); return key }) }
  get(key) { return this.run(() => { const value = this.records.get(key); return value === undefined ? undefined : structuredClone(value) }) }
  getAll() { return this.run(() => [...this.records.values()].map((value) => structuredClone(value))) }
  delete(key) { return this.run(() => this.records.delete(key)) }
  createIndex(name, property) { this.definition.indexes.set(name, property); return this.index(name) }
  index(name) {
    const property = this.definition.indexes.get(name)
    return {
      getAll: (value) => this.run(() => [...this.records.values()].filter((row) => row[property] === value).map((row) => structuredClone(row))),
      getAllKeys: (value) => this.run(() => [...this.records].filter(([, row]) => row[property] === value).map(([key]) => key)),
    }
  }
  run(operation) {
    const request = new FakeRequest()
    this.transaction.pending += 1
    queueMicrotask(async () => {
      await this.transaction.ready
      if (this.transaction.aborted) return
      try {
        request.result = operation()
        request.onsuccess?.({ target: request })
      } catch (error) {
        request.error = error
        request.onerror?.({ target: request })
        this.transaction.abort(error)
      } finally {
        this.transaction.pending -= 1
        this.transaction.scheduleComplete()
      }
    })
    return request
  }
}

class FakeTransaction {
  oncomplete = null
  onabort = null
  onerror = null
  error = null
  pending = 0
  aborted = false
  completionTimer = null
  constructor(database, names, ready = Promise.resolve(), release = () => {}) { this.database = database; this.names = new Set(Array.isArray(names) ? names : [names]); this.ready = ready; this.release = release }
  objectStore(name) {
    if (!this.names.has(name)) throw new Error('NotFoundError')
    return new FakeStore(this, name, this.database.definitions.get(name), this.database.records.get(name))
  }
  abort(error) {
    if (this.aborted) return
    this.aborted = true
    this.error = error ?? new Error('AbortError')
    clearTimeout(this.completionTimer)
    this.release()
    queueMicrotask(() => { this.onerror?.({ target: this }); this.onabort?.({ target: this }) })
  }
  scheduleComplete() {
    if (this.aborted || this.pending || this.completionTimer) return
    this.completionTimer = setTimeout(() => {
      this.completionTimer = null
      if (!this.aborted && !this.pending) {
        this.release()
        this.oncomplete?.({ target: this })
      }
    }, 0)
  }
}

class FakeDatabase {
  objectStoreNames = { contains: (name) => this.definitions.has(name) }
  definitions = new Map()
  records = new Map()
  transactionTail = Promise.resolve()
  createObjectStore(name, options) {
    this.definitions.set(name, { keyPath: options.keyPath, indexes: new Map() })
    this.records.set(name, new Map())
    return new FakeStore(new FakeTransaction(this, [name]), name, this.definitions.get(name), this.records.get(name))
  }
  transaction(names) {
    const ready = this.transactionTail
    let release
    this.transactionTail = new Promise((resolve) => { release = resolve })
    return new FakeTransaction(this, names, ready, release)
  }
  close() {}
}

const databases = new Map()
globalThis.indexedDB = {
  open(name) {
    const request = new FakeRequest()
    queueMicrotask(() => {
      let database = databases.get(name)
      if (!database) {
        database = new FakeDatabase()
        databases.set(name, database)
        request.result = database
        request.onupgradeneeded?.({ target: request })
      }
      request.result = database
      request.onsuccess?.({ target: request })
    })
    return request
  },
}

function person(id, name) {
  const base = familyMembers[0]
  return { ...base, id, name, firstName: name, lastName: '', parentIds: [], spouseIds: [], formerSpouseIds: [], adoptedParentIds: [], siblingIds: [], photo: undefined }
}

test('local storage creates, reloads, edits, links, deletes and switches trees', async () => {
  const firstTree = await createTree('Local tree one')
  const secondTree = await createTree('Local tree two')
  const parent = person('local-parent', 'Local Parent')
  const child = person('local-child', 'Local Child')

  await addPerson(firstTree.id, parent)
  await addPerson(firstTree.id, child)
  await addParentLink({ tree_id: firstTree.id, child_id: child.id, parent_id: parent.id, kind: 'biological' })
  await addPartnerLink({ tree_id: firstTree.id, person_a: parent.id, person_b: child.id, status: 'former' })
  await saveTreeSettings(firstTree.id, { theme: 'chocolate', nodeMode: 'rectangle' })

  const reloaded = await loadTree(firstTree.id)
  assert.equal(reloaded.tree?.name, 'Local tree one')
  assert.deepEqual(reloaded.settings, { theme: 'chocolate', nodeMode: 'rectangle' })
  assert.deepEqual(reloaded.members.find((member) => member.id === child.id)?.parentIds, [parent.id])
  assert.deepEqual(reloaded.members.find((member) => member.id === parent.id)?.formerSpouseIds, [child.id])

  const edited = { ...reloaded.members.find((member) => member.id === child.id), name: 'Edited Child', firstName: 'Edited Child' }
  await editPerson(firstTree.id, edited)
  assert.equal((await loadTree(firstTree.id)).members.find((member) => member.id === child.id)?.name, 'Edited Child')

  await removeParentLink(firstTree.id, child.id, parent.id)
  assert.deepEqual((await loadTree(firstTree.id)).members.find((member) => member.id === child.id)?.parentIds, [])
  await deletePerson(firstTree.id, parent.id)
  assert.deepEqual((await loadTree(firstTree.id)).members.map((member) => member.id), [child.id])

  await addPerson(secondTree.id, person('other-tree-person', 'Other Tree Person'))
  assert.deepEqual((await loadTree(secondTree.id)).members.map((member) => member.name), ['Other Tree Person'])
  assert.equal((await loadTree(firstTree.id)).members[0].name, 'Edited Child')

  await renameTree(secondTree.id, 'Renamed local tree')
  assert.equal((await listTrees()).find((tree) => tree.id === secondTree.id)?.name, 'Renamed local tree')
  await deleteTree(firstTree.id)
  assert.equal((await loadTree(firstTree.id)).tree, null)
  await deleteTree(secondTree.id)
  assert.equal((await listTrees()).length, 0)
})

test('tree revisions allow normal saves and isolate separate trees', async () => {
  const firstTree = await createTree('Revision tree one')
  const secondTree = await createTree('Revision tree two')
  const firstMember = person('revision-first', 'Revision First')
  const secondMember = person('revision-second', 'Revision Second')

  const [firstRevision, secondRevision] = await Promise.all([
    saveTreeChanges(firstTree.id, [], [firstMember], firstTree.revision ?? 0),
    saveTreeChanges(secondTree.id, [], [secondMember], secondTree.revision ?? 0),
  ])

  assert.equal(firstRevision, 1)
  assert.equal(secondRevision, 1)
  assert.deepEqual((await loadTree(firstTree.id)).members.map((member) => member.id), [firstMember.id])
  assert.deepEqual((await loadTree(secondTree.id)).members.map((member) => member.id), [secondMember.id])
  await deleteTree(firstTree.id)
  await deleteTree(secondTree.id)
})

test('stale and simultaneous same-tree writes cannot overwrite a newer revision', async () => {
  const tree = await createTree('Concurrent revision tree')
  const initial = await loadTree(tree.id)
  const first = person('concurrent-first', 'Concurrent First')
  const second = person('concurrent-second', 'Concurrent Second')
  const results = await Promise.allSettled([
    saveTreeChanges(tree.id, initial.members, [first], initial.tree.revision ?? 0),
    saveTreeChanges(tree.id, initial.members, [second], initial.tree.revision ?? 0),
  ])

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.message === 'LOCAL_TREE_CONFLICT').length, 1)
  const latest = await loadTree(tree.id)
  assert.equal(latest.tree.revision, 1)
  assert.equal(latest.members.length, 1)

  const recovered = [...latest.members, person('after-reload', 'After Reload')]
  const nextRevision = await saveTreeChanges(tree.id, latest.members, recovered, latest.tree.revision)
  assert.equal(nextRevision, 2)
  assert.equal((await loadTree(tree.id)).members.length, 2)
  await deleteTree(tree.id)
})

test('legacy tree records without revisions load at revision zero and upgrade on save', async () => {
  const tree = await createTree('Legacy revision tree')
  const database = databases.get('rootly-local-family-trees')
  const stored = database.records.get('trees').get(tree.id)
  const { revision, ...legacyRecord } = stored
  assert.equal(revision, 0)
  database.records.get('trees').set(tree.id, legacyRecord)

  const loaded = await loadTree(tree.id)
  assert.equal(loaded.tree.revision, 0)
  const nextRevision = await saveTreeChanges(tree.id, loaded.members, [person('legacy-person', 'Legacy Person')], loaded.tree.revision)
  assert.equal(nextRevision, 1)
  assert.equal((await loadTree(tree.id)).members[0].name, 'Legacy Person')
  await deleteTree(tree.id)
})

test('failed photo conversion leaves the tree revision and family rows unchanged', async () => {
  const tree = await createTree('Failed revision tree')
  const invalidPhoto = { ...person('failed-photo', 'Failed Photo'), photo: 'blob:missing-photo' }
  await assert.rejects(saveTreeChanges(tree.id, [], [invalidPhoto], tree.revision ?? 0), /LOCAL_PHOTO_UNAVAILABLE/)
  const loaded = await loadTree(tree.id)
  assert.equal(loaded.tree.revision, 0)
  assert.deepEqual(loaded.members, [])
  await deleteTree(tree.id)
})

test('a failed write to a removed tree does not recreate or partially write its data', async () => {
  const tree = await createTree('Removed revision tree')
  const member = person('removed-tree-person', 'Removed Tree Person')
  await deleteTree(tree.id)
  await assert.rejects(saveTreeChanges(tree.id, [], [member], tree.revision ?? 0), /LOCAL_TREE_NOT_FOUND/)
  assert.equal((await loadTree(tree.id)).tree, null)
})

test('profile photos are saved as blobs and restored as local object URLs', async () => {
  const tree = await createTree('Photo tree')
  const member = { ...person('photo-person', 'Photo Person'), photo: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=' }
  await addPerson(tree.id, member)
  const restored = (await loadTree(tree.id)).members[0].photo
  assert.match(restored, /^blob:/)
  await deleteTree(tree.id)
})

test('tree archive round-trip imports people, links, settings and photo blobs into IndexedDB', async () => {
  const source = await createTree('Archive Morgan family')
  const father = { ...person('archive-father', 'James Morgan'), gender: 'male', birthDate: '1960' }
  const child = { ...person('archive-child', 'ليلى Morgan'), gender: 'female', birthDate: '1990', photo: 'data:image/png;base64,iVBORw0KGgoAAAAA' }
  await addPerson(source.id, father)
  await addPerson(source.id, child)
  await addParentLink({ tree_id: source.id, child_id: child.id, parent_id: father.id, kind: 'biological' })
  await saveTreeSettings(source.id, { theme: 'chocolate', nodeMode: 'rectangle' })
  const loaded = await loadTree(source.id)
  const bytes = await createTreeArchive({ tree: loaded.tree, members: loaded.members, settings: loaded.settings, photos: await loadTreePhotos(source.id) })
  const parsed = parseTreeArchive(bytes)
  const imported = await importTreeData(parsed, { kind: 'new' })
  const restored = await loadTree(imported.id)

  assert.equal(restored.tree?.name, 'Archive Morgan family')
  assert.deepEqual(restored.settings, { theme: 'chocolate', nodeMode: 'rectangle' })
  assert.deepEqual(restored.members.find((member) => member.id === child.id)?.parentIds, [father.id])
  assert.equal(restored.members.find((member) => member.id === child.id)?.name, 'ليلى Morgan')
  const restoredPhoto = (await loadTreePhotos(imported.id)).get(child.id)
  assert.equal(restoredPhoto?.type, 'image/png')
  assert.deepEqual(new Uint8Array(await restoredPhoto.arrayBuffer()), new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))
  await deleteTree(source.id)
  await deleteTree(imported.id)
})
