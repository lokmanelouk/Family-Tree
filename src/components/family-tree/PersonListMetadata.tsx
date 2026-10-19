import type { FamilyMember } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'

export function PersonListMetadata({ member }: { member: FamilyMember }) {
  const { t } = useLanguage()
  const birthYear = member.birthDate?.match(/^(\d{4})/)?.[1]
  const deathYear = member.deathDate?.match(/^(\d{4})/)?.[1]
  const date = deathYear
    ? `${birthYear ?? '\u2014'} \u2013 ${deathYear}`
    : member.birthDate ?? t('Birth date unknown')
  const gender = member.gender ? t(member.gender === 'male' ? 'Male' : 'Female') : t('Gender unknown')

  return <span className="person-list-metadata"><bdi dir="auto">{date}</bdi><span aria-hidden="true">{'\u2022'}</span><span>{gender}</span></span>
}
