export type FamilyMember = {
  id: string
  initials: string
  name: string
  relationship: string
  gender?: 'male' | 'female'
  birthDate?: string
  deathDate?: string
  lifeStatus?: 'living' | 'deceased'
  bio?: string
  photo?: string
  parentIds: string[]
  spouseIds: string[]
  /** Former partners retained for family history and tree display. */
  formerSpouseIds?: string[]
  /** Parents whose parent-child relationship with this person is adoptive. */
  adoptedParentIds?: string[]
  siblingIds: string[]
  avatar: {
    skin: string
    hair: string
    shirt: string
    hairstyle: 'curls' | 'bob' | 'side' | 'waves' | 'crop' | 'bun'
    accessory?: 'glasses' | 'bow'
  }
}

export type RelationshipKind = 'parent' | 'child' | 'partner' | 'sibling' | 'divorced' | 'adopted'
