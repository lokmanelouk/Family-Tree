import assert from 'node:assert/strict'
import test from 'node:test'
import { familyMembers } from '../../data/family.ts'
import { addParentLink, addPartnerLink, addPerson, createTree, deletePerson, deleteTree, editPerson, listTrees, loadTree, removeParentLink, renameTree, saveTreeSettings } from './local-tree-storage.ts'

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
    queueMicrotask(() => {
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
  constructor(database, names) { this.database = database; this.names = new Set(Array.isArray(names) ? names : [names]) }
  objectStore(name) {
    if (!this.names.has(name)) throw new Error('NotFoundError')
    return new FakeStore(this, name, this.database.definitions.get(name), this.database.records.get(name))
  }
  abort(error) {
    if (this.aborted) return
    this.aborted = true
    this.error = error ?? new Error('AbortError')
    clearTimeout(this.completionTimer)
    queueMicrotask(() => { this.onerror?.({ target: this }); this.onabort?.({ target: this }) })
  }
  scheduleComplete() {
    if (this.aborted || this.pending || this.completionTimer) return
    this.completionTimer = setTimeout(() => {
      this.completionTimer = null
      if (!this.aborted && !this.pending) this.oncomplete?.({ target: this })
    }, 0)
  }
}

class FakeDatabase {
  objectStoreNames = { contains: (name) => this.definitions.has(name) }
  definitions = new Map()
  records = new Map()
  createObjectStore(name, options) {
    this.definitions.set(name, { keyPath: options.keyPath, indexes: new Map() })
    this.records.set(name, new Map())
    return new FakeStore(new FakeTransaction(this, [name]), name, this.definitions.get(name), this.records.get(name))
  }
  transaction(names) { return new FakeTransaction(this, names) }
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

test('profile photos are saved as blobs and restored as local object URLs', async () => {
  const tree = await createTree('Photo tree')
  const member = { ...person('photo-person', 'Photo Person'), photo: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=' }
  await addPerson(tree.id, member)
  const restored = (await loadTree(tree.id)).members[0].photo
  assert.match(restored, /^blob:/)
  await deleteTree(tree.id)
})
