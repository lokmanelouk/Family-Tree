import type { FamilyMember } from '../types/family.ts'

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
