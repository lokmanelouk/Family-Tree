import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { FamilyMember } from '../types/family'
import { isValidTreeSnapshot } from './family-validation.ts'
import { getRootBranchMap } from './tree-layout.ts'
import { parseTreeBackup } from './tree-backup.ts'
import { isAppTheme } from '../types/theme.ts'

export const TREE_ARCHIVE_FORMAT = 'rootly-family-tree'
export const TREE_ARCHIVE_VERSION = 1
export const TREE_ARCHIVE_MAX_BYTES = 200 * 1024 * 1024
export const TREE_ARCHIVE_MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const TREE_ARCHIVE_MAX_PEOPLE = 5000
export const TREE_ARCHIVE_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024
export const TREE_ARCHIVE_MAX_FAMILY_JSON_BYTES = 50 * 1024 * 1024
export const TREE_BACKUP_REMINDER_DAYS = 30

export type TreeArchiveSettings = { theme?: string; nodeMode?: 'circle' | 'rectangle' }
export type TreeArchiveTree = { id: string; name: string; createdAt: number; updatedAt: number; lastBackupAt?: number }
export type TreeArchiveInput = {
  tree: TreeArchiveTree
  members: FamilyMember[]
  settings: TreeArchiveSettings
  photos: Map<string, Blob>
  exportDate?: string
}
export type ParsedTreeArchive = {
  treeName: string
  members: FamilyMember[]
  settings: TreeArchiveSettings
  photos: Map<string, Blob>
  branchColors: Record<string, string | null>
  exportDate: string
}
export type TreeArchiveLimits = {
  maxArchiveBytes: number
  maxImageBytes: number
  maxPeople: number
  maxUncompressedBytes: number
  maxFamilyJsonBytes: number
}

const defaultLimits: TreeArchiveLimits = {
  maxArchiveBytes: TREE_ARCHIVE_MAX_BYTES,
  maxImageBytes: TREE_ARCHIVE_MAX_IMAGE_BYTES,
  maxPeople: TREE_ARCHIVE_MAX_PEOPLE,
  maxUncompressedBytes: TREE_ARCHIVE_MAX_UNCOMPRESSED_BYTES,
  maxFamilyJsonBytes: TREE_ARCHIVE_MAX_FAMILY_JSON_BYTES,
}

class TreeArchiveError extends Error {}

function archiveError(message: string) {
  return new TreeArchiveError(message)
}

function isSafeArchivePath(path: string) {
  if (!path || path.startsWith('/') || path.startsWith('\\') || /^[a-z]:/i.test(path) || path.includes('\\') || path.includes('\0')) return false
  return path.split('/').every((part) => part !== '..' && part !== '.')
}

function imageExtension(blob: Blob) {
  if (blob.type === 'image/png') return 'png'
  if (blob.type === 'image/jpeg') return 'jpg'
  if (blob.type === 'image/webp') return 'webp'
  return null
}

function validImageBytes(bytes: Uint8Array, extension: string) {
  if (extension === 'png') return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  if (extension === 'jpg' || extension === 'jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (extension === 'webp') return bytes.length >= 12 && strFromU8(bytes.subarray(0, 4)) === 'RIFF' && strFromU8(bytes.subarray(8, 12)) === 'WEBP'
  return false
}

function relationshipRows(members: FamilyMember[]) {
  const parentLinks: { childId: string; parentId: string; kind: 'biological' | 'adoptive' }[] = []
  const partnerLinks: { personA: string; personB: string; status: 'married' | 'former' }[] = []
  const siblingLinks: { personA: string; personB: string }[] = []
  const seenPartners = new Set<string>()
  const seenSiblings = new Set<string>()
  for (const member of members) {
    for (const parentId of member.parentIds) parentLinks.push({ childId: member.id, parentId, kind: member.adoptedParentIds?.includes(parentId) ? 'adoptive' : 'biological' })
    for (const [partnerIds, status] of [[member.spouseIds, 'married'], [member.formerSpouseIds ?? [], 'former']] as const) {
      for (const partnerId of partnerIds) {
        const pair = [member.id, partnerId].sort()
        const key = pair.join('|')
        if (seenPartners.has(key)) continue
        seenPartners.add(key)
        partnerLinks.push({ personA: pair[0], personB: pair[1], status })
      }
    }
    for (const siblingId of member.siblingIds) {
      const pair = [member.id, siblingId].sort()
      const key = pair.join('|')
      if (seenSiblings.has(key)) continue
      seenSiblings.add(key)
      siblingLinks.push({ personA: pair[0], personB: pair[1] })
    }
  }
  return { parentLinks, partnerLinks, siblingLinks }
}

export async function createTreeArchive(input: TreeArchiveInput) {
  if (input.members.length > TREE_ARCHIVE_MAX_PEOPLE) throw archiveError('The backup contains too many people or invalid people data.')
  if (!input.tree.name.trim() || input.tree.name.length > 120) throw archiveError('The archive is not a valid Rootly tree backup.')
  const exportDate = input.exportDate ?? new Date().toISOString()
  const { parentLinks, partnerLinks, siblingLinks } = relationshipRows(input.members)
  const people = input.members.map(({ photo, parentIds, spouseIds, formerSpouseIds, adoptedParentIds, siblingIds, ...person }) => {
    void photo
    void parentIds
    void spouseIds
    void formerSpouseIds
    void adoptedParentIds
    void siblingIds
    return person
  })
  const branchColors = Object.fromEntries(getRootBranchMap(input.members))
  const family = {
    format: TREE_ARCHIVE_FORMAT,
    version: TREE_ARCHIVE_VERSION,
    exportDate,
    tree: { name: input.tree.name },
    settings: input.settings,
    people,
    relationships: { parentLinks, partnerLinks, siblingLinks },
    branchColors,
  }
  const familyBytes = strToU8(JSON.stringify(family, null, 2))
  if (familyBytes.byteLength > TREE_ARCHIVE_MAX_FAMILY_JSON_BYTES) throw archiveError('The ZIP file is too large.')
  const files: Record<string, Uint8Array> = { 'family.json': familyBytes }
  let totalBytes = familyBytes.byteLength
  for (const [personId, blob] of input.photos) {
    if (!input.members.some((member) => member.id === personId)) continue
    if (blob.size > TREE_ARCHIVE_MAX_IMAGE_BYTES) throw archiveError('An image is invalid or too large.')
    const extension = imageExtension(blob)
    if (!extension) throw archiveError('A photo uses an unsupported format.')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    if (!validImageBytes(bytes, extension)) throw archiveError('An image is invalid or too large.')
    totalBytes += bytes.byteLength
    if (totalBytes > TREE_ARCHIVE_MAX_UNCOMPRESSED_BYTES) throw archiveError('The ZIP file is too large.')
    files[`images/${personId}.${extension}`] = bytes
  }
  const archive = zipSync(files, { level: 6 })
  assertTreeArchiveSize(archive.byteLength)
  return archive
}

export function assertTreeArchiveSize(byteLength: number, maxArchiveBytes = TREE_ARCHIVE_MAX_BYTES) {
  if (byteLength > maxArchiveBytes) throw archiveError('The ZIP file is too large.')
}

export function parseTreeArchive(bytes: Uint8Array, limits: TreeArchiveLimits = defaultLimits): ParsedTreeArchive {
  assertTreeArchiveSize(bytes.byteLength, limits.maxArchiveBytes)
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw archiveError('This ZIP file is broken or incomplete.')
  let totalUncompressedBytes = 0
  let familyJsonCount = 0
  const imagePaths = new Set<string>()
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        if (!isSafeArchivePath(file.name)) throw archiveError('The archive contains an unsafe path.')
        if (!Number.isFinite(file.originalSize) || file.originalSize < 0 || !Number.isFinite(file.size) || file.size < 0) throw archiveError('This ZIP file is broken or incomplete.')
        totalUncompressedBytes += file.originalSize
        if (totalUncompressedBytes > limits.maxUncompressedBytes) throw archiveError('The ZIP file is too large.')
        if (file.name === 'family.json') {
          familyJsonCount += 1
          if (familyJsonCount > 1) throw archiveError('The archive contains more than one family.json file.')
          if (file.originalSize > limits.maxFamilyJsonBytes) throw archiveError('The ZIP file is too large.')
          return true
        }
        if (file.name === 'images/') return false
        const imageMatch = file.name.match(/^images\/([^/]+)\.(png|jpe?g|webp)$/i)
        if (!imageMatch) return false
        if (file.originalSize > limits.maxImageBytes) throw archiveError('An image is invalid or too large.')
        if (imagePaths.has(file.name)) throw archiveError('The archive contains a duplicate image path.')
        imagePaths.add(file.name)
        return true
      },
    })
  } catch (error) {
    if (error instanceof TreeArchiveError) throw error
    throw archiveError('This ZIP file is broken or incomplete.')
  }
  if (!familyJsonCount || !files['family.json']) throw archiveError('The archive does not contain family.json.')
  let data: unknown
  try {
    data = JSON.parse(strFromU8(files['family.json']))
  } catch {
    throw archiveError('The archive contains an invalid family.json file.')
  }
  if (!data || typeof data !== 'object') throw archiveError('The archive is not a valid Rootly tree backup.')
  const archive = data as Record<string, unknown>
  if (archive.format !== TREE_ARCHIVE_FORMAT) throw archiveError('The archive is not a valid Rootly tree backup.')
  if (archive.version !== TREE_ARCHIVE_VERSION) throw archiveError('This backup version is not supported.')
  const tree = archive.tree as { name?: unknown } | null
  if (!tree || typeof tree.name !== 'string' || !tree.name.trim() || tree.name.length > 120) throw archiveError('The archive is not a valid Rootly tree backup.')
  if (typeof archive.exportDate !== 'string' || !Number.isFinite(Date.parse(archive.exportDate))) throw archiveError('The archive is not a valid Rootly tree backup.')
  const settingsValue = archive.settings
  if (!settingsValue || typeof settingsValue !== 'object' || Array.isArray(settingsValue)) throw archiveError('The archive contains invalid tree settings.')
  const settingsRecord = settingsValue as Record<string, unknown>
  if ((settingsRecord.theme !== undefined && (typeof settingsRecord.theme !== 'string' || !isAppTheme(settingsRecord.theme))) || (settingsRecord.nodeMode !== undefined && settingsRecord.nodeMode !== 'circle' && settingsRecord.nodeMode !== 'rectangle')) throw archiveError('The archive contains invalid tree settings.')
  const settings: TreeArchiveSettings = {
    ...(typeof settingsRecord.theme === 'string' ? { theme: settingsRecord.theme } : {}),
    ...(settingsRecord.nodeMode === 'circle' || settingsRecord.nodeMode === 'rectangle' ? { nodeMode: settingsRecord.nodeMode } : {}),
  }
  if (!Array.isArray(archive.people) || archive.people.length > limits.maxPeople) throw archiveError('The backup contains too many people or invalid people data.')
  const people: FamilyMember[] = []
  const ids = new Set<string>()
  for (const value of archive.people) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw archiveError('The archive contains invalid people data.')
    const person = value as Record<string, unknown>
    if (typeof person.id !== 'string' || !person.id.trim() || person.id.length > 256 || person.id.includes('/') || person.id.includes('\\') || person.id.includes('\0') || ids.has(person.id)) throw archiveError('The backup contains duplicate or invalid person IDs.')
    if (Object.hasOwn(person, 'photo')) throw archiveError('The archive is not a valid Rootly tree backup.')
    ids.add(person.id)
    people.push({ ...person, parentIds: [], spouseIds: [], formerSpouseIds: [], adoptedParentIds: [], siblingIds: [] } as unknown as FamilyMember)
  }
  const relationships = archive.relationships as Record<string, unknown> | null
  if (!relationships || typeof relationships !== 'object') throw archiveError('The archive contains invalid relationships.')
  const parentLinks = relationships.parentLinks
  const partnerLinks = relationships.partnerLinks
  const siblingLinks = relationships.siblingLinks
  if (!Array.isArray(parentLinks) || !Array.isArray(partnerLinks) || !Array.isArray(siblingLinks)) throw archiveError('The archive contains invalid relationships.')
  const byId = new Map(people.map((person) => [person.id, person]))
  const parentLinkKeys = new Set<string>()
  const partnerLinkKeys = new Set<string>()
  const siblingLinkKeys = new Set<string>()
  for (const value of parentLinks) {
    if (!value || typeof value !== 'object') throw archiveError('The archive contains invalid relationships.')
    const link = value as Record<string, unknown>
    if (typeof link.childId !== 'string' || typeof link.parentId !== 'string' || (link.kind !== 'biological' && link.kind !== 'adoptive')) throw archiveError('The archive contains invalid relationships.')
    const child = byId.get(link.childId)
    const parent = byId.get(link.parentId)
    if (!child || !parent) throw archiveError('A relationship points to a person that does not exist.')
    if (child.id === parent.id) throw archiveError('This backup contains invalid or circular relationships.')
    const key = `${child.id}|${parent.id}`
    if (parentLinkKeys.has(key)) throw archiveError('The archive contains duplicate relationships.')
    parentLinkKeys.add(key)
    child.parentIds.push(parent.id)
    if (link.kind === 'adoptive') child.adoptedParentIds?.push(parent.id)
    if (child.parentIds.length > 2) throw archiveError('A person cannot have more than two parents.')
  }
  for (const value of partnerLinks) {
    if (!value || typeof value !== 'object') throw archiveError('The archive contains invalid relationships.')
    const link = value as Record<string, unknown>
    if (typeof link.personA !== 'string' || typeof link.personB !== 'string' || (link.status !== 'married' && link.status !== 'former')) throw archiveError('The archive contains invalid relationships.')
    const first = byId.get(link.personA)
    const second = byId.get(link.personB)
    if (!first || !second) throw archiveError('A relationship points to a person that does not exist.')
    if (first.id === second.id) throw archiveError('This backup contains invalid or circular relationships.')
    const key = [first.id, second.id].sort().join('|')
    if (partnerLinkKeys.has(key)) throw archiveError('The archive contains duplicate relationships.')
    partnerLinkKeys.add(key)
    if (link.status === 'former') {
      first.formerSpouseIds?.push(second.id)
      second.formerSpouseIds?.push(first.id)
    } else {
      first.spouseIds.push(second.id)
      second.spouseIds.push(first.id)
    }
  }
  for (const value of siblingLinks) {
    if (!value || typeof value !== 'object') throw archiveError('The archive contains invalid relationships.')
    const link = value as Record<string, unknown>
    if (typeof link.personA !== 'string' || typeof link.personB !== 'string') throw archiveError('The archive contains invalid relationships.')
    const first = byId.get(link.personA)
    const second = byId.get(link.personB)
    if (!first || !second) throw archiveError('A relationship points to a person that does not exist.')
    if (first.id === second.id) throw archiveError('This backup contains invalid or circular relationships.')
    const key = [first.id, second.id].sort().join('|')
    if (siblingLinkKeys.has(key)) throw archiveError('The archive contains duplicate relationships.')
    siblingLinkKeys.add(key)
    first.siblingIds.push(second.id)
    second.siblingIds.push(first.id)
  }
  const validatedMembers = parseTreeBackup({ format: 'family-tree-backup', version: 1, people })
  if (!validatedMembers || !isValidTreeSnapshot(validatedMembers, new Date().toISOString().slice(0, 10))) throw archiveError('This backup contains invalid or circular relationships.')
  const branchColorsValue = archive.branchColors
  if (!branchColorsValue || typeof branchColorsValue !== 'object' || Array.isArray(branchColorsValue)) throw archiveError('The archive contains invalid branch colors.')
  const branchColors = branchColorsValue as Record<string, unknown>
  if (Object.keys(branchColors).length !== ids.size || Object.entries(branchColors).some(([id, color]) => !ids.has(id) || (color !== null && typeof color !== 'string'))) throw archiveError('The archive contains invalid branch colors.')
  const photos = new Map<string, Blob>()
  for (const [path, imageBytes] of Object.entries(files)) {
    const match = path.match(/^images\/([^/]+)\.(png|jpe?g|webp)$/i)
    if (!match) continue
    const personId = match[1]
    const extension = match[2].toLowerCase()
    if (!ids.has(personId) || photos.has(personId) || !validImageBytes(imageBytes, extension)) throw archiveError('An image is invalid or too large.')
    const mimeType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg'
    photos.set(personId, new Blob([imageBytes.slice().buffer as ArrayBuffer], { type: mimeType }))
  }
  return { treeName: tree.name, members: validatedMembers, settings, photos, branchColors: branchColors as Record<string, string | null>, exportDate: archive.exportDate }
}

export function getTreeArchiveFilename(treeName: string, date = new Date()) {
  const safeName = [...treeName.trim()].map((character) => {
    const code = character.charCodeAt(0)
    return /[\\/:*?"<>|]/.test(character) || code < 32 || code === 127 ? '-' : character
  }).join('').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 100) || 'family-tree'
  return `${safeName}-${date.toISOString().slice(0, 10)}.zip`
}

export function shouldShowBackupReminder(tree: Pick<TreeArchiveTree, 'createdAt' | 'updatedAt' | 'lastBackupAt'>, now = Date.now()) {
  const baseline = tree.lastBackupAt ?? tree.createdAt
  return tree.updatedAt > baseline && now - baseline >= TREE_BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000
}
