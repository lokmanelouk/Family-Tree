import type { FamilyMember } from '../../types/family'

export function AvatarIllustration({ avatar, name, compact = false }: { avatar: FamilyMember['avatar']; name: string; compact?: boolean }) {
  const { skin, hair, shirt, hairstyle, accessory } = avatar
  return <svg className={`family-avatar-art ${compact ? 'compact' : ''}`} viewBox="0 0 88 88" role="img" aria-label={`Illustration of ${name}`}>
    <ellipse cx="44" cy="85" rx="31" ry="20" fill={shirt} />
    <path d="M32 64h24v16H32z" fill={skin} />
    <ellipse cx="44" cy="42" rx="25" ry="29" fill={hair} />
    <ellipse cx="44" cy="44" rx="19" ry="23" fill={skin} />
    {hairstyle === 'curls' && <g fill={hair}><circle cx="27" cy="26" r="9"/><circle cx="37" cy="19" r="9"/><circle cx="49" cy="18" r="9"/><circle cx="59" cy="26" r="9"/><circle cx="24" cy="39" r="7"/><circle cx="64" cy="40" r="7"/></g>}
    {hairstyle === 'waves' && <path d="M23 41c-5-22 10-34 23-32 17 1 24 13 19 31l-8-8-4-10c-7 6-17 8-27 6z" fill={hair} />}
    {hairstyle === 'bob' && <path d="M22 46c-5-17 1-34 17-37 18-3 30 10 26 37l-8 10-1-23c-7 6-18 8-28 7l-1 16z" fill={hair} />}
    {hairstyle === 'side' && <path d="M25 35c-3-15 6-27 20-27 15 0 22 10 19 25-6-8-15-12-27-11-4 5-7 9-12 13z" fill={hair} />}
    {hairstyle === 'crop' && <path d="M26 33c-2-13 4-24 18-25 13-1 20 8 19 21-8-7-21-9-37 4z" fill={hair} />}
    {hairstyle === 'bun' && <><circle cx="58" cy="17" r="9" fill={hair}/><path d="M24 38c-3-17 5-29 20-29 14 0 23 10 20 26-8-7-19-10-29-6z" fill={hair}/></>}
    <path d="M34 44q3-3 6 0M49 44q3-3 6 0" fill="none" stroke="#59483d" strokeWidth="2" strokeLinecap="round" />
    <path d="M40 55q4 4 8 0" fill="none" stroke="#a85f58" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="25" cy="48" r="3" fill={skin}/><circle cx="63" cy="48" r="3" fill={skin}/>
    {accessory === 'glasses' && <g fill="none" stroke="#6d685c" strokeWidth="1.7"><circle cx="37" cy="46" r="6"/><circle cx="51" cy="46" r="6"/><path d="M43 46h2"/></g>}
    {accessory === 'bow' && <g fill="#d98d93"><path d="M59 18q-10-9-10 0t10 0m0 0q10-9 10 0t-10 0"/><circle cx="59" cy="18" r="2.5" fill="#f2c7a6"/></g>}
    <path d="M35 68l9 8 9-8" fill="none" stroke="#fff9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
