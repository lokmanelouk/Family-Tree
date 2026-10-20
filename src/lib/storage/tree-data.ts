import { defaultAvatar } from '../../data/avatar-presets.ts'
import type { FamilyMember } from '../../types/family.ts'
import { getFullName, getNameParts } from '../member-name.ts'

export type PersonRow = {
  id: string
  tree_id: string
  first_name: string
  last_name: string | null
  gender: 'male' | 'female'
  birth_date: string | null
  death_date: string | null
  deceased: boolean
  photo_path: string | null
}

export type ParentLinkRow = { tree_id: string; child_id: string; parent_id: string; kind: 'biological' | 'adoptive' }
export type PartnerLinkRow = { tree_id: string; person_a: string; person_b: string; status: 'married' | 'former' }

export function rowsToFamilyMembers(people: PersonRow[], parentLinks: ParentLinkRow[], partnerLinks: PartnerLinkRow[]): FamilyMember[] {
  const members: FamilyMember[] = people.map((person) => {
    const name = [person.first_name, person.last_name].filter(Boolean).join(' ')
    const names = name.trim().split(/\s+/)
    return {
      id: person.id,
      firstName: person.first_name,
      lastName: person.last_name ?? '',
      name,
      initials: names.slice(0, 2).map((part) => part[0] ?? '').join('').toLocaleUpperCase(),
      relationship: 'Family member',
      gender: person.gender,
      ...(person.birth_date ? { birthDate: person.birth_date } : {}),
      ...(person.death_date ? { deathDate: person.death_date } : {}),
      lifeStatus: person.deceased || person.death_date ? 'deceased' : 'living',
      ...(person.photo_path ? { photo: person.photo_path } : {}),
      parentIds: [],
      spouseIds: [],
      formerSpouseIds: [],
      adoptedParentIds: [],
      siblingIds: [],
      avatar: { ...defaultAvatar },
    }
  })
  const byId = new Map(members.map((member) => [member.id, member]))
  for (const link of parentLinks) {
    const child = byId.get(link.child_id)
    if (!child || !byId.has(link.parent_id)) continue
    child.parentIds.push(link.parent_id)
    if (link.kind === 'adoptive') child.adoptedParentIds?.push(link.parent_id)
  }
  for (const link of partnerLinks) {
    const first = byId.get(link.person_a)
    const second = byId.get(link.person_b)
    if (!first || !second) continue
    if (link.status === 'former') {
      first.formerSpouseIds?.push(second.id)
      second.formerSpouseIds?.push(first.id)
    } else {
      first.spouseIds.push(second.id)
      second.spouseIds.push(first.id)
    }
  }
  const parentsByChild = new Map(members.map((member) => [member.id, new Set(member.parentIds)]))
  for (let left = 0; left < members.length; left += 1) {
    for (let right = left + 1; right < members.length; right += 1) {
      const first = members[left]
      const second = members[right]
      const firstParents = parentsByChild.get(first.id)!
      if (firstParents.size && second.parentIds.some((id) => firstParents.has(id))) {
        first.siblingIds.push(second.id)
        second.siblingIds.push(first.id)
      }
    }
  }
  return members
}

export function familyMembersToRows(treeId: string, members: FamilyMember[]) {
  const people: Omit<PersonRow, 'tree_id'>[] = members.map((member) => {
    const fullName = getFullName(member)
    const { firstName, lastName } = getNameParts(member)
    return {
      id: member.id,
      first_name: firstName || fullName,
      last_name: lastName || null,
      gender: member.gender ?? 'male',
      birth_date: member.birthDate ?? null,
      death_date: member.deathDate ?? null,
      deceased: member.lifeStatus === 'deceased' || Boolean(member.deathDate),
      photo_path: member.photo ?? null,
    }
  })
  const parentLinks: ParentLinkRow[] = []
  const partnerLinks: PartnerLinkRow[] = []
  const byId = new Map(members.map((member) => [member.id, member]))
  for (const child of members) {
    for (const parentId of new Set(child.parentIds)) {
      if (!byId.has(parentId)) continue
      parentLinks.push({ tree_id: treeId, child_id: child.id, parent_id: parentId, kind: child.adoptedParentIds?.includes(parentId) ? 'adoptive' : 'biological' })
    }
    const partners = [
      ...child.spouseIds.map((id) => ({ id, status: 'married' as const })),
      ...(child.formerSpouseIds ?? []).map((id) => ({ id, status: 'former' as const })),
    ]
    for (const partner of partners) {
      if (!byId.has(partner.id) || child.id.localeCompare(partner.id) >= 0) continue
      partnerLinks.push({ tree_id: treeId, person_a: child.id, person_b: partner.id, status: partner.status })
    }
  }
  return {
    people: people.map((person) => ({ ...person, tree_id: treeId })),
    parentLinks,
    partnerLinks,
  }
}

export function cloneMembersWithNewIds(members: FamilyMember[]) {
  const ids = new Map<string, string>(members.map((member) => [member.id, crypto.randomUUID()]))
  return members.map((member) => ({
    ...member,
    id: ids.get(member.id)!,
    parentIds: member.parentIds.map((id) => ids.get(id)).filter((id): id is string => Boolean(id)),
    spouseIds: member.spouseIds.map((id) => ids.get(id)).filter((id): id is string => Boolean(id)),
    formerSpouseIds: member.formerSpouseIds?.map((id) => ids.get(id)).filter((id): id is string => Boolean(id)),
    adoptedParentIds: member.adoptedParentIds?.map((id) => ids.get(id)).filter((id): id is string => Boolean(id)),
    siblingIds: member.siblingIds.map((id) => ids.get(id)).filter((id): id is string => Boolean(id)),
  }))
}
