export type FamilyMember = {
  id: string
  initials: string
  name: string
  relationship: string
  birthDate?: string
  deathDate?: string
  photo?: string
  parentIds: string[]
  spouseIds: string[]
  siblingIds: string[]
  avatar: {
    skin: string
    hair: string
    shirt: string
    hairstyle: 'curls' | 'bob' | 'side' | 'waves' | 'crop' | 'bun'
    accessory?: 'glasses' | 'bow'
  }
}

export type RelationshipKind = 'parent' | 'child' | 'partner' | 'sibling'
