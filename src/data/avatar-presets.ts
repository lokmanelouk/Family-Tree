import type { FamilyMember } from '../types/family'

export type AvatarPreset = {
  id: string
  label: string
  group: 'male' | 'female'
  avatar: FamilyMember['avatar']
}

export const defaultAvatar: FamilyMember['avatar'] = { skin: '#d8b294', hair: '#77766e', shirt: '#aebbb3', hairstyle: 'side' }

export const avatarPresets: AvatarPreset[] = [
  { id: 'man-side-part', label: 'Side-part avatar', group: 'male', avatar: { skin: '#bd8062', hair: '#3f3935', shirt: '#c4b5dc', hairstyle: 'side' } },
  { id: 'man-short-hair', label: 'Short-hair avatar', group: 'male', avatar: { skin: '#e6ac8f', hair: '#5a3e35', shirt: '#b9acd4', hairstyle: 'crop' } },
  { id: 'man-curly-hair', label: 'Curly-hair avatar', group: 'male', avatar: { skin: '#d99c79', hair: '#53433b', shirt: '#f2bf7f', hairstyle: 'curls' } },
  { id: 'man-wavy-hair', label: 'Wavy-hair avatar', group: 'male', avatar: { skin: '#c98766', hair: '#4c443c', shirt: '#9bb8d0', hairstyle: 'waves', accessory: 'glasses' } },
  { id: 'woman-bob', label: 'Bob-hair avatar', group: 'female', avatar: { skin: '#f0c49f', hair: '#59473c', shirt: '#edbd7b', hairstyle: 'bob', accessory: 'glasses' } },
  { id: 'woman-long-waves', label: 'Long-wave avatar', group: 'female', avatar: { skin: '#ecc09d', hair: '#6c4d3b', shirt: '#a9c8db', hairstyle: 'waves' } },
  { id: 'woman-bun', label: 'Hair-bun avatar', group: 'female', avatar: { skin: '#edbd9b', hair: '#a06d50', shirt: '#e6a8a3', hairstyle: 'bun', accessory: 'bow' } },
  { id: 'woman-curly-hair', label: 'Curly-hair avatar', group: 'female', avatar: { skin: '#d89672', hair: '#74715d', shirt: '#9eb9a5', hairstyle: 'curls', accessory: 'bow' } },
]
