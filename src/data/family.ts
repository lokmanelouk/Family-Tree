import type { FamilyMember } from '../types/family'

export const familyMembers: FamilyMember[] = [
  { id: 'james', initials: 'JM', name: 'James Morgan', relationship: 'Grandfather', gender: 'male', birthDate: '1938', deathDate: '2012', parentIds: [], spouseIds: ['eleanor'], siblingIds: [], avatar: { skin: '#d89672', hair: '#74715d', shirt: '#9eb9a5', hairstyle: 'side' } },
  { id: 'eleanor', initials: 'EM', name: 'Eleanor Morgan', relationship: 'Grandmother', gender: 'female', birthDate: '1941', parentIds: [], spouseIds: ['james'], siblingIds: [], avatar: { skin: '#edbd9b', hair: '#a06d50', shirt: '#e6a8a3', hairstyle: 'waves', accessory: 'glasses' } },
  { id: 'david', initials: 'DM', name: 'David Morgan', relationship: 'Son', gender: 'male', birthDate: '1967', parentIds: ['james', 'eleanor'], spouseIds: ['linda'], siblingIds: [], avatar: { skin: '#c98766', hair: '#4c443c', shirt: '#9bb8d0', hairstyle: 'crop' } },
  { id: 'linda', initials: 'LM', name: 'Linda Morgan', relationship: 'Daughter-in-law', gender: 'female', birthDate: '1969', parentIds: [], spouseIds: ['david'], siblingIds: [], avatar: { skin: '#f0c49f', hair: '#59473c', shirt: '#edbd7b', hairstyle: 'bob', accessory: 'bow' } },
  { id: 'sarah', initials: 'SM', name: 'Sarah Morgan', relationship: 'Daughter', gender: 'female', birthDate: '1992', parentIds: ['david', 'linda'], spouseIds: [], siblingIds: ['jack'], avatar: { skin: '#e6ac8f', hair: '#5a3e35', shirt: '#b9acd4', hairstyle: 'curls' } },
  { id: 'jack', initials: 'JM', name: 'Jack Morgan', relationship: 'Son', gender: 'male', birthDate: '1995', parentIds: ['david', 'linda'], spouseIds: [], siblingIds: ['sarah'], avatar: { skin: '#d99c79', hair: '#493c34', shirt: '#84b7ae', hairstyle: 'side' } },
]
