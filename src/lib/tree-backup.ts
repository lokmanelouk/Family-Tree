import type { FamilyMember } from '../types/family'

export function exportTree(members: FamilyMember[], selectedId?: string | null) {
  const included = new Set<string>()
  if (selectedId) {
    const byId = new Map(members.map((member) => [member.id, member]))
    const pending = [selectedId]
    while (pending.length) {
      const id = pending.pop()!
      if (included.has(id) || !byId.has(id)) continue
      included.add(id)
      const person = byId.get(id)!
      pending.push(...person.spouseIds, ...(person.formerSpouseIds ?? []), ...members.filter((member) => member.parentIds.includes(id)).map((member) => member.id))
    }
  } else members.forEach((member) => included.add(member.id))
  const people = members.filter((member) => included.has(member.id)).map((member) => ({
    ...member,
    parentIds: member.parentIds.filter((id) => included.has(id)),
    spouseIds: member.spouseIds.filter((id) => included.has(id)),
    ...(member.formerSpouseIds ? { formerSpouseIds: member.formerSpouseIds.filter((id) => included.has(id)) } : {}),
    ...(member.adoptedParentIds ? { adoptedParentIds: member.adoptedParentIds.filter((id) => included.has(id)) } : {}),
    siblingIds: member.siblingIds.filter((id) => included.has(id)),
  }))
  return JSON.stringify({ format: 'family-tree-backup', version: 1, people }, null, 2)
}

export function parseTreeBackup(value: unknown): FamilyMember[] | null {
  if (!value || typeof value !== 'object') return null
  const backup = value as { format?: unknown; version?: unknown; people?: unknown }
  if (backup.format !== 'family-tree-backup' || backup.version !== 1) return null
  const people = backup.people
  if (!Array.isArray(people)) return null
  const ids = new Set<string>()
  for (const person of people) {
    if (!person || typeof person !== 'object') return null
    const p = person as Partial<FamilyMember>
    if (typeof p.id !== 'string' || !p.id || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim()
      || typeof p.initials !== 'string' || typeof p.relationship !== 'string'
      || (p.gender !== undefined && p.gender !== 'male' && p.gender !== 'female')
      || (p.birthDate !== undefined && typeof p.birthDate !== 'string') || (p.deathDate !== undefined && typeof p.deathDate !== 'string')
      || (p.photo !== undefined && (typeof p.photo !== 'string' || p.photo.length > 3_000_000 || !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(p.photo)))
      || !Array.isArray(p.parentIds) || !Array.isArray(p.spouseIds) || !Array.isArray(p.siblingIds)
      || (p.formerSpouseIds !== undefined && !Array.isArray(p.formerSpouseIds)) || (p.adoptedParentIds !== undefined && !Array.isArray(p.adoptedParentIds))
      || !p.parentIds.every((id) => typeof id === 'string') || !p.spouseIds.every((id) => typeof id === 'string') || !p.siblingIds.every((id) => typeof id === 'string')
      || (p.formerSpouseIds && !p.formerSpouseIds.every((id) => typeof id === 'string')) || (p.adoptedParentIds && !p.adoptedParentIds.every((id) => typeof id === 'string'))
      || new Set(p.parentIds).size !== p.parentIds.length || new Set(p.spouseIds).size !== p.spouseIds.length || new Set(p.siblingIds).size !== p.siblingIds.length
      || (p.formerSpouseIds && new Set(p.formerSpouseIds).size !== p.formerSpouseIds.length) || (p.adoptedParentIds && new Set(p.adoptedParentIds).size !== p.adoptedParentIds.length)
      || typeof p.avatar !== 'object' || !p.avatar || typeof p.avatar.skin !== 'string' || typeof p.avatar.hair !== 'string' || typeof p.avatar.shirt !== 'string'
      || !['curls', 'bob', 'side', 'waves', 'crop', 'bun'].includes(p.avatar.hairstyle)
      || (p.avatar.accessory !== undefined && !['glasses', 'bow'].includes(p.avatar.accessory))) return null
    ids.add(p.id)
  }
  for (const item of people as FamilyMember[]) {
    if ([...item.parentIds, ...item.spouseIds, ...(item.formerSpouseIds ?? []), ...(item.adoptedParentIds ?? []), ...item.siblingIds].some((id) => !ids.has(id))
      || item.parentIds.includes(item.id) || item.spouseIds.includes(item.id) || item.formerSpouseIds?.includes(item.id) || item.siblingIds.includes(item.id)
      || item.spouseIds.some((id) => item.formerSpouseIds?.includes(id))
      || (item.adoptedParentIds ?? []).some((id) => !item.parentIds.includes(id))) return null
  }
  const byId = new Map((people as FamilyMember[]).map((person) => [person.id, person]))
  for (const person of people as FamilyMember[]) {
    if (person.spouseIds.some((id) => !byId.get(id)?.spouseIds.includes(person.id))
      || person.formerSpouseIds?.some((id) => !byId.get(id)?.formerSpouseIds?.includes(person.id) || byId.get(id)?.spouseIds.includes(person.id))
      || person.siblingIds.some((id) => !byId.get(id)?.siblingIds.includes(person.id))) return null
  }
  const complete = new Set<string>()
  const visit = (id: string, active = new Set<string>()): boolean => {
    if (complete.has(id)) return true
    if (active.has(id)) return false
    active.add(id)
    const person = byId.get(id)
    const valid = Boolean(person && person.parentIds.every((parentId) => visit(parentId, active)))
    active.delete(id)
    if (valid) complete.add(id)
    return valid
  }
  if (![...ids].every((id) => visit(id))) return null
  return people as FamilyMember[]
}
