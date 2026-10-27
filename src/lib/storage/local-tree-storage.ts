import type { FamilyMember } from '../../types/family.ts'
import type { TreeNodeMode } from '../tree-layout.ts'

export type TreeSettings = {
  theme?: string
  nodeMode?: TreeNodeMode
}

export type TreeRecord = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  lastBackupAt?: number
}

export type ParentLinkInput = { tree_id: string; child_id: string; parent_id: string; kind?: 'biological' | 'adoptive' }
export type PartnerLinkInput = { tree_id: string; person_a: string; person_b: string; status: 'married' | 'former' }

type StoreName = 'trees' | 'people' | 'parentLinks' | 'partnerLinks' | 'siblingLinks' | 'photos' | 'settings'
type StoredMember = Omit<FamilyMember, 'photo' | 'parentIds' | 'spouseIds' | 'formerSpouseIds' | 'adoptedParentIds' | 'siblingIds'>
type StoredPerson = { key: string; treeId: string; id: string; person: StoredMember }
type StoredParentLink = { key: string; treeId: string; childId: string; parentId: string; kind: 'biological' | 'adoptive' }
type StoredPartnerLink = { key: string; treeId: string; personA: string; personB: string; status: 'married' | 'former' }
type StoredSiblingLink = { key: string; treeId: string; personA: string; personB: string }
type StoredPhoto = { key: string; treeId: string; personId: string; blob: Blob }
type StoredSettings = { key: string; values: TreeSettings & { language?: string } }
type TreeRows = {
  people: StoredPerson[]
  parentLinks: StoredParentLink[]
  partnerLinks: StoredPartnerLink[]
  siblingLinks: StoredSiblingLink[]
  photos: StoredPhoto[]
}

const DATABASE_NAME = 'rootly-local-family-trees'
const DATABASE_VERSION = 1
const STORE_NAMES: StoreName[] = ['trees', 'people', 'parentLinks', 'partnerLinks', 'siblingLinks', 'photos', 'settings']
const GLOBAL_SETTINGS_KEY = '__rootly_global_settings__'
let databasePromise: Promise<IDBDatabase> | undefined
const photoObjectUrls = new Map<string, { blob: Blob; url: string }>()

function storageError(key: string) {
  const error = new Error(key)
  error.name = key
  return error
}

function normalizeStorageError(error: unknown) {
  if (error instanceof Error && (error.message === 'LOCAL_STORAGE_UNAVAILABLE' || error.message === 'LOCAL_STORAGE_FULL' || error.message === 'LOCAL_TREE_NOT_FOUND')) return error
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  if (name === 'QuotaExceededError') return storageError('LOCAL_STORAGE_FULL')
  if (name === 'SecurityError' || name === 'InvalidStateError' || name === 'NotAllowedError') return storageError('LOCAL_STORAGE_UNAVAILABLE')
  return error instanceof Error ? error : new Error('Could not save, try again')
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(normalizeStorageError(request.error))
  })
}

function transactionResult<T>(transaction: IDBTransaction) {
  return new Promise<T>((resolve, reject) => {
    transaction.oncomplete = () => resolve(undefined as T)
    transaction.onabort = () => reject(normalizeStorageError(transaction.error))
    transaction.onerror = () => reject(normalizeStorageError(transaction.error))
  })
}

function openDatabase() {
  if (databasePromise) return databasePromise
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      databasePromise = undefined
      reject(storageError('LOCAL_STORAGE_UNAVAILABLE'))
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    } catch (error) {
      reject(normalizeStorageError(error))
      return
    }
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('trees')) database.createObjectStore('trees', { keyPath: 'id' })
      for (const name of ['people', 'parentLinks', 'partnerLinks', 'siblingLinks', 'photos'] as const) {
        if (database.objectStoreNames.contains(name)) continue
        const store = database.createObjectStore(name, { keyPath: 'key' })
        store.createIndex('treeId', 'treeId', { unique: false })
      }
      if (!database.objectStoreNames.contains('settings')) database.createObjectStore('settings', { keyPath: 'key' })
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = undefined
      }
      resolve(database)
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) void navigator.storage.persist().catch(() => undefined)
    }
    request.onerror = () => {
      databasePromise = undefined
      reject(normalizeStorageError(request.error))
    }
    request.onblocked = () => {
      databasePromise = undefined
      reject(storageError('LOCAL_STORAGE_UNAVAILABLE'))
    }
  })
  return databasePromise
}

function treeKey(treeId: string, id: string) {
  return `${treeId}/${id}`
}

function parentLinkKey(treeId: string, childId: string, parentId: string) {
  return treeKey(treeId, `parent/${childId}/${parentId}`)
}

function partnerLinkKey(treeId: string, personA: string, personB: string) {
  const [first, second] = [personA, personB].sort()
  return treeKey(treeId, `partner/${first}/${second}`)
}

function siblingLinkKey(treeId: string, personA: string, personB: string) {
  const [first, second] = [personA, personB].sort()
  return treeKey(treeId, `sibling/${first}/${second}`)
}

function photoKey(treeId: string, personId: string) {
  return treeKey(treeId, `photo/${personId}`)
}

function objectUrlKey(treeId: string, personId: string) {
  return treeKey(treeId, personId)
}

function toStoredRows(treeId: string, members: FamilyMember[]): TreeRows {
  const people: StoredPerson[] = []
  const parentLinks: StoredParentLink[] = []
  const partnerLinks: StoredPartnerLink[] = []
  const siblingLinks: StoredSiblingLink[] = []
  const seenPartners = new Set<string>()
  const seenSiblings = new Set<string>()
  for (const member of members) {
    const { photo, parentIds, spouseIds, formerSpouseIds, adoptedParentIds, siblingIds, ...person } = member
    void photo
    people.push({ key: treeKey(treeId, member.id), treeId, id: member.id, person })
    for (const parentId of new Set(parentIds)) {
      parentLinks.push({
        key: parentLinkKey(treeId, member.id, parentId),
        treeId,
        childId: member.id,
        parentId,
        kind: adoptedParentIds?.includes(parentId) ? 'adoptive' : 'biological',
      })
    }
    for (const [ids, status] of [[spouseIds, 'married'], [formerSpouseIds ?? [], 'former']] as const) {
      for (const partnerId of ids) {
        if (partnerId === member.id) continue
        const key = partnerLinkKey(treeId, member.id, partnerId)
        if (seenPartners.has(key)) continue
        seenPartners.add(key)
        const [personA, personB] = [member.id, partnerId].sort()
        partnerLinks.push({ key, treeId, personA, personB, status })
      }
    }
    for (const siblingId of siblingIds) {
      if (siblingId === member.id) continue
      const key = siblingLinkKey(treeId, member.id, siblingId)
      if (seenSiblings.has(key)) continue
      seenSiblings.add(key)
      const [personA, personB] = [member.id, siblingId].sort()
      siblingLinks.push({ key, treeId, personA, personB })
    }
  }
  return { people, parentLinks, partnerLinks, siblingLinks, photos: [] }
}

function byKey<T extends { key: string }>(rows: T[]) {
  return new Map(rows.map((row) => [row.key, row]))
}

function equalRecord(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function photoToBlob(photo: string) {
  const comma = photo.indexOf(',')
  if (photo.startsWith('data:') && comma >= 0) {
    const header = photo.slice(0, comma)
    const body = photo.slice(comma + 1)
    const mimeType = header.slice(5).split(';')[0] || 'application/octet-stream'
    if (header.includes(';base64')) {
      const decoded = atob(body)
      const bytes = new Uint8Array(decoded.length)
      for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
      return new Blob([bytes], { type: mimeType })
    }
    return new Blob([decodeURIComponent(body)], { type: mimeType })
  }
  if (photo.startsWith('blob:')) {
    for (const cached of photoObjectUrls.values()) if (cached.url === photo) return cached.blob
  }
  throw new Error('LOCAL_PHOTO_UNAVAILABLE')
}

function rowsFromMembers(treeId: string, members: FamilyMember[]) {
  const rows = toStoredRows(treeId, members)
  const photos = new Map(members.filter((member) => member.photo).map((member) => [member.id, member.photo!]))
  return { rows, photos }
}

function syncStoreImmediately<T extends { key: string }>(store: IDBObjectStore, before: T[], after: T[]) {
  const oldRows = byKey(before)
  const newRows = byKey(after)
  for (const [key] of oldRows) if (!newRows.has(key)) store.delete(key)
  for (const [key, row] of newRows) {
    const previous = oldRows.get(key)
    if (!previous || !equalRecord(previous, row)) store.put(row)
  }
}

async function loadRows(transaction: IDBTransaction, storeName: Exclude<StoreName, 'trees' | 'settings'>, treeId: string) {
  return requestValue(transaction.objectStore(storeName).index('treeId').getAll(treeId)) as Promise<Array<StoredPerson | StoredParentLink | StoredPartnerLink | StoredSiblingLink | StoredPhoto>>
}

export async function listTrees(): Promise<TreeRecord[]> {
  const database = await openDatabase()
  const transaction = database.transaction('trees', 'readonly')
  const done = transactionResult<void>(transaction)
  const trees = await requestValue(transaction.objectStore('trees').getAll()) as TreeRecord[]
  await done
  return trees.sort((left, right) => left.createdAt - right.createdAt)
}

export async function loadTree(treeId?: string): Promise<{ tree: TreeRecord | null; members: FamilyMember[]; settings: TreeSettings }> {
  const database = await openDatabase()
  const trees = await listTrees()
  const tree = (treeId ? trees.find((item) => item.id === treeId) : trees[0]) ?? null
  if (!tree) return { tree: null, members: [], settings: {} }
  const transaction = database.transaction(['people', 'parentLinks', 'partnerLinks', 'siblingLinks', 'photos', 'settings'], 'readonly')
  const done = transactionResult<void>(transaction)
  const [people, parentLinks, partnerLinks, siblingLinks, photos, setting] = await Promise.all([
    loadRows(transaction, 'people', tree.id),
    loadRows(transaction, 'parentLinks', tree.id),
    loadRows(transaction, 'partnerLinks', tree.id),
    loadRows(transaction, 'siblingLinks', tree.id),
    loadRows(transaction, 'photos', tree.id),
    requestValue(transaction.objectStore('settings').get(tree.id)) as Promise<StoredSettings | undefined>,
  ])
  await done
  const members = new Map((people as StoredPerson[]).map(({ id, person }) => [id, {
    ...person,
    parentIds: [],
    spouseIds: [],
    formerSpouseIds: [],
    adoptedParentIds: [],
    siblingIds: [],
  } as FamilyMember]))
  for (const link of parentLinks as StoredParentLink[]) {
    const child = members.get(link.childId)
    if (!child || !members.has(link.parentId)) continue
    child.parentIds.push(link.parentId)
    if (link.kind === 'adoptive') child.adoptedParentIds?.push(link.parentId)
  }
  for (const link of partnerLinks as StoredPartnerLink[]) {
    const first = members.get(link.personA)
    const second = members.get(link.personB)
    if (!first || !second) continue
    if (link.status === 'former') {
      first.formerSpouseIds?.push(second.id)
      second.formerSpouseIds?.push(first.id)
    } else {
      first.spouseIds.push(second.id)
      second.spouseIds.push(first.id)
    }
  }
  for (const link of siblingLinks as StoredSiblingLink[]) {
    const first = members.get(link.personA)
    const second = members.get(link.personB)
    if (!first || !second) continue
    first.siblingIds.push(second.id)
    second.siblingIds.push(first.id)
  }
  for (const photo of photos as StoredPhoto[]) {
    const member = members.get(photo.personId)
    if (!member) continue
    const key = objectUrlKey(tree.id, member.id)
    const cached = photoObjectUrls.get(key)
    if (cached?.blob !== photo.blob) {
      if (cached) URL.revokeObjectURL(cached.url)
      const url = URL.createObjectURL(photo.blob)
      photoObjectUrls.set(key, { blob: photo.blob, url })
    }
    member.photo = photoObjectUrls.get(key)?.url
  }
  return { tree, members: [...members.values()], settings: setting?.values ?? {} }
}

export async function createTree(name: string): Promise<TreeRecord> {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Tree name is required.')
  const database = await openDatabase()
  const transaction = database.transaction('trees', 'readwrite')
  const done = transactionResult<void>(transaction)
  const now = Date.now()
  const tree = { id: crypto.randomUUID(), name: cleanName, createdAt: now, updatedAt: now }
  await requestValue(transaction.objectStore('trees').add(tree))
  await done
  return tree
}

export async function renameTree(treeId: string, name: string) {
  const cleanName = name.trim()
  if (!cleanName) throw new Error('Tree name is required.')
  const database = await openDatabase()
  const transaction = database.transaction('trees', 'readwrite')
  const done = transactionResult<void>(transaction)
  const store = transaction.objectStore('trees')
  let renamed: TreeRecord | undefined
  const request = store.get(treeId)
  request.onsuccess = () => {
    const tree = request.result as TreeRecord | undefined
    if (!tree) {
      transaction.abort()
      return
    }
    renamed = { ...tree, name: cleanName, updatedAt: Date.now() }
    store.put(renamed)
  }
  await done
  if (!renamed) throw storageError('LOCAL_TREE_NOT_FOUND')
  return renamed
}

export async function deleteTree(treeId: string) {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAMES, 'readwrite')
  const done = transactionResult<void>(transaction)
  let missingTree = false
  const treeRequest = transaction.objectStore('trees').get(treeId)
  treeRequest.onsuccess = () => {
    if (!treeRequest.result) {
      missingTree = true
      transaction.abort()
      return
    }
    transaction.objectStore('trees').delete(treeId)
    transaction.objectStore('settings').delete(treeId)
    for (const name of ['people', 'parentLinks', 'partnerLinks', 'siblingLinks', 'photos'] as const) {
      const store = transaction.objectStore(name)
      const keysRequest = store.index('treeId').getAllKeys(treeId)
      keysRequest.onsuccess = () => {
        for (const key of keysRequest.result) store.delete(key)
      }
    }
  }
  try {
    await done
  } catch (error) {
    if (missingTree) throw storageError('LOCAL_TREE_NOT_FOUND')
    throw error
  }
  for (const [key, photo] of photoObjectUrls) {
    if (key.startsWith(`${treeId}/`)) {
      URL.revokeObjectURL(photo.url)
      photoObjectUrls.delete(key)
    }
  }
}

export async function saveTreeSettings(treeId: string, values: Partial<TreeSettings>) {
  const database = await openDatabase()
  const transaction = database.transaction(['settings', 'trees'], 'readwrite')
  const done = transactionResult<void>(transaction)
  const settingsStore = transaction.objectStore('settings')
  const treeStore = transaction.objectStore('trees')
  let previousSettings: StoredSettings | undefined
  let tree: TreeRecord | undefined
  let completedReads = 0
  const applySettings = () => {
    completedReads += 1
    if (completedReads !== 2) return
    const nextValues = { ...previousSettings?.values, ...values }
    if (equalRecord(previousSettings?.values ?? {}, nextValues)) return
    settingsStore.put({ key: treeId, values: nextValues })
    if (tree) treeStore.put({ ...tree, updatedAt: Date.now() })
  }
  const settingsRequest = settingsStore.get(treeId)
  settingsRequest.onsuccess = () => { previousSettings = settingsRequest.result as StoredSettings | undefined; applySettings() }
  const treeRequest = treeStore.get(treeId)
  treeRequest.onsuccess = () => { tree = treeRequest.result as TreeRecord | undefined; applySettings() }
  await done
}

export async function loadTreePhotos(treeId: string) {
  const database = await openDatabase()
  const transaction = database.transaction('photos', 'readonly')
  const done = transactionResult<void>(transaction)
  const photos = await requestValue(transaction.objectStore('photos').index('treeId').getAll(treeId)) as StoredPhoto[]
  await done
  return new Map(photos.map((photo) => [photo.personId, photo.blob]))
}

export async function recordTreeBackup(treeId: string, backedUpAt = Date.now()) {
  const database = await openDatabase()
  const transaction = database.transaction('trees', 'readwrite')
  const done = transactionResult<void>(transaction)
  const store = transaction.objectStore('trees')
  let updated: TreeRecord | undefined
  let missingTree = false
  const request = store.get(treeId)
  request.onsuccess = () => {
    const tree = request.result as TreeRecord | undefined
    if (!tree) {
      missingTree = true
      transaction.abort()
      return
    }
    updated = { ...tree, lastBackupAt: backedUpAt }
    store.put(updated)
  }
  try {
    await done
  } catch (error) {
    if (missingTree) throw storageError('LOCAL_TREE_NOT_FOUND')
    throw error
  }
  return updated!
}

export type ImportedTreeData = {
  treeName: string
  members: FamilyMember[]
  settings: TreeSettings
  photos: ReadonlyMap<string, Blob>
  exportDate: string
}

export type TreeImportDestination = { kind: 'new' } | { kind: 'replace'; treeId: string }

function queueImportedTreeRows(transaction: IDBTransaction, treeId: string, imported: ImportedTreeData) {
  const rows = toStoredRows(treeId, imported.members)
  for (const row of rows.people) transaction.objectStore('people').put(row)
  for (const row of rows.parentLinks) transaction.objectStore('parentLinks').put(row)
  for (const row of rows.partnerLinks) transaction.objectStore('partnerLinks').put(row)
  for (const row of rows.siblingLinks) transaction.objectStore('siblingLinks').put(row)
  for (const [personId, blob] of imported.photos) {
    if (!imported.members.some((member) => member.id === personId)) continue
    transaction.objectStore('photos').put({ key: photoKey(treeId, personId), treeId, personId, blob } satisfies StoredPhoto)
  }
  transaction.objectStore('settings').put({ key: treeId, values: imported.settings })
}

export async function importTreeData(imported: ImportedTreeData, destination: TreeImportDestination): Promise<TreeRecord> {
  const database = await openDatabase()
  const treeId = destination.kind === 'new' ? crypto.randomUUID() : destination.treeId
  const transaction = database.transaction(STORE_NAMES, 'readwrite')
  const done = transactionResult<void>(transaction)
  const treeStore = transaction.objectStore('trees')
  const now = Date.now()
  let result: TreeRecord | undefined
  let missingTree = false
  const writeRows = (tree: TreeRecord, replace = false) => {
    result = tree
    if (!replace) {
      treeStore.add(tree)
      queueImportedTreeRows(transaction, tree.id, imported)
      return
    }
    const stores = ['people', 'parentLinks', 'partnerLinks', 'siblingLinks', 'photos'] as const
    let pendingStores = stores.length
    for (const storeName of stores) {
      const store = transaction.objectStore(storeName)
      const keys = store.index('treeId').getAllKeys(tree.id)
      keys.onsuccess = () => {
        for (const key of keys.result) store.delete(key)
        pendingStores -= 1
        if (pendingStores === 0) {
          transaction.objectStore('settings').delete(tree.id)
          treeStore.put(tree)
          queueImportedTreeRows(transaction, tree.id, imported)
        }
      }
    }
  }
  if (destination.kind === 'new') {
    const exportedAt = Date.parse(imported.exportDate)
    writeRows({ id: treeId, name: imported.treeName, createdAt: now, updatedAt: now, ...(Number.isFinite(exportedAt) ? { lastBackupAt: exportedAt } : {}) })
  } else {
    const request = treeStore.get(treeId)
    request.onsuccess = () => {
      const current = request.result as TreeRecord | undefined
      if (!current) {
        missingTree = true
        transaction.abort()
        return
      }
      const exportedAt = Date.parse(imported.exportDate)
      writeRows({ ...current, updatedAt: now, lastBackupAt: Number.isFinite(exportedAt) ? exportedAt : now }, true)
    }
  }
  try {
    await done
  } catch (error) {
    if (missingTree) throw storageError('LOCAL_TREE_NOT_FOUND')
    throw normalizeStorageError(error)
  }
  for (const [key, cached] of photoObjectUrls) {
    if (key.startsWith(`${treeId}/`)) {
      URL.revokeObjectURL(cached.url)
      photoObjectUrls.delete(key)
    }
  }
  return result!
}

export async function saveGlobalSettings(values: { language?: string; theme?: string }) {
  const database = await openDatabase()
  const transaction = database.transaction('settings', 'readwrite')
  const done = transactionResult<void>(transaction)
  const store = transaction.objectStore('settings')
  const request = store.get(GLOBAL_SETTINGS_KEY)
  request.onsuccess = () => {
    const previous = request.result as StoredSettings | undefined
    store.put({ key: GLOBAL_SETTINGS_KEY, values: { ...previous?.values, ...values } })
  }
  await done
}

export async function addPerson(treeId: string, member: FamilyMember) {
  const current = await loadTree(treeId)
  if (!current.tree) throw storageError('LOCAL_TREE_NOT_FOUND')
  await saveTreeChanges(treeId, current.members, [...current.members.filter((item) => item.id !== member.id), member])
}

export async function editPerson(treeId: string, member: FamilyMember) {
  const current = await loadTree(treeId)
  if (!current.tree) throw storageError('LOCAL_TREE_NOT_FOUND')
  await saveTreeChanges(treeId, current.members, current.members.map((item) => item.id === member.id ? member : item))
}

export async function deletePerson(treeId: string, personId: string) {
  const current = await loadTree(treeId)
  if (!current.tree) throw storageError('LOCAL_TREE_NOT_FOUND')
  const members = current.members.filter((member) => member.id !== personId).map((member) => ({
    ...member,
    parentIds: member.parentIds.filter((id) => id !== personId),
    spouseIds: member.spouseIds.filter((id) => id !== personId),
    formerSpouseIds: member.formerSpouseIds?.filter((id) => id !== personId),
    adoptedParentIds: member.adoptedParentIds?.filter((id) => id !== personId),
    siblingIds: member.siblingIds.filter((id) => id !== personId),
  }))
  await saveTreeChanges(treeId, current.members, members)
}

export async function addParentLink(link: ParentLinkInput) {
  const { tree_id: treeId, child_id: childId, parent_id: parentId, kind = 'biological' } = link
  const current = await loadTree(treeId)
  if (!current.tree) throw storageError('LOCAL_TREE_NOT_FOUND')
  const members = current.members.map((member) => member.id === childId ? {
    ...member,
    parentIds: [...new Set([...member.parentIds, parentId])],
    adoptedParentIds: kind === 'adoptive' ? [...new Set([...(member.adoptedParentIds ?? []), parentId])] : member.adoptedParentIds,
  } : member)
  await saveTreeChanges(treeId, current.members, members)
}

export async function removeParentLink(treeId: string, childId: string, parentId: string) {
  const current = await loadTree(treeId)
  if (!current.tree) throw storageError('LOCAL_TREE_NOT_FOUND')
  const members = current.members.map((member) => member.id === childId ? {
    ...member,
    parentIds: member.parentIds.filter((id) => id !== parentId),
    adoptedParentIds: member.adoptedParentIds?.filter((id) => id !== parentId),
  } : member)
  await saveTreeChanges(treeId, current.members, members)
}

export async function addPartnerLink(link: PartnerLinkInput) {
  const { tree_id: treeId, person_a: personA, person_b: personB, status } = link
  const current = await loadTree(treeId)
  if (!current.tree) throw storageError('LOCAL_TREE_NOT_FOUND')
  const members = current.members.map((member) => {
    if (member.id === personA) return status === 'former' ? { ...member, spouseIds: member.spouseIds.filter((id) => id !== personB), formerSpouseIds: [...new Set([...(member.formerSpouseIds ?? []), personB])] } : { ...member, spouseIds: [...new Set([...member.spouseIds, personB])], formerSpouseIds: member.formerSpouseIds?.filter((id) => id !== personB) }
    if (member.id === personB) return status === 'former' ? { ...member, spouseIds: member.spouseIds.filter((id) => id !== personA), formerSpouseIds: [...new Set([...(member.formerSpouseIds ?? []), personA])] } : { ...member, spouseIds: [...new Set([...member.spouseIds, personA])], formerSpouseIds: member.formerSpouseIds?.filter((id) => id !== personA) }
    return member
  })
  await saveTreeChanges(treeId, current.members, members)
}

export async function removePartnerLink(treeId: string, personA: string, personB: string) {
  const current = await loadTree(treeId)
  if (!current.tree) throw storageError('LOCAL_TREE_NOT_FOUND')
  const members = current.members.map((member) => ({
    ...member,
    spouseIds: member.id === personA ? member.spouseIds.filter((id) => id !== personB) : member.id === personB ? member.spouseIds.filter((id) => id !== personA) : member.spouseIds,
    formerSpouseIds: member.id === personA ? member.formerSpouseIds?.filter((id) => id !== personB) : member.id === personB ? member.formerSpouseIds?.filter((id) => id !== personA) : member.formerSpouseIds,
  }))
  await saveTreeChanges(treeId, current.members, members)
}

export async function changePartnerLink(treeId: string, personA: string, personB: string, status: 'married' | 'former') {
  await addPartnerLink({ tree_id: treeId, person_a: personA, person_b: personB, status })
}

export async function saveTreeChanges(treeId: string, before: FamilyMember[], after: FamilyMember[]) {
  const old = rowsFromMembers(treeId, before)
  const next = rowsFromMembers(treeId, after)
  const oldPhotos = new Map(old.photos)
  const nextPhotos = new Map(next.photos)
  const photoChanges = new Map<string, Blob | null>()
  for (const memberId of new Set([...oldPhotos.keys(), ...nextPhotos.keys()])) {
    const oldPhoto = oldPhotos.get(memberId)
    const nextPhoto = nextPhotos.get(memberId)
    if (oldPhoto === nextPhoto) continue
    photoChanges.set(memberId, nextPhoto ? await photoToBlob(nextPhoto) : null)
  }
  const database = await openDatabase()
  const transaction = database.transaction(['trees', 'people', 'parentLinks', 'partnerLinks', 'siblingLinks', 'photos'], 'readwrite')
  const done = transactionResult<void>(transaction)
  const treeStore = transaction.objectStore('trees')
  let missingTree = false
  const treeRequest = treeStore.get(treeId)
  treeRequest.onsuccess = () => {
    const tree = treeRequest.result as TreeRecord | undefined
    if (!tree) {
      missingTree = true
      transaction.abort()
      return
    }
    treeStore.put({ ...tree, updatedAt: Date.now() })
    syncStoreImmediately(transaction.objectStore('people'), old.rows.people, next.rows.people)
    syncStoreImmediately(transaction.objectStore('parentLinks'), old.rows.parentLinks, next.rows.parentLinks)
    syncStoreImmediately(transaction.objectStore('partnerLinks'), old.rows.partnerLinks, next.rows.partnerLinks)
    syncStoreImmediately(transaction.objectStore('siblingLinks'), old.rows.siblingLinks, next.rows.siblingLinks)
    const photoStore = transaction.objectStore('photos')
    for (const [personId, blob] of photoChanges) {
      const key = photoKey(treeId, personId)
      if (blob) photoStore.put({ key, treeId, personId, blob } satisfies StoredPhoto)
      else photoStore.delete(key)
    }
  }
  try {
    await done
  } catch (error) {
    if (missingTree) throw storageError('LOCAL_TREE_NOT_FOUND')
    throw error
  }
  for (const [personId] of photoChanges) {
    const key = objectUrlKey(treeId, personId)
    const cached = photoObjectUrls.get(key)
    if (cached) {
      URL.revokeObjectURL(cached.url)
      photoObjectUrls.delete(key)
    }
  }
}

export function getLocalStorageErrorKey(error: unknown) {
  if (error instanceof Error && error.message === 'LOCAL_STORAGE_FULL') return 'Browser storage is full. Free some space and try again.'
  if (error instanceof Error && (error.message === 'LOCAL_STORAGE_UNAVAILABLE' || error.message === 'LOCAL_PHOTO_UNAVAILABLE')) return 'Local storage is unavailable or blocked. Check your browser settings and try again.'
  return 'Could not save, try again'
}
