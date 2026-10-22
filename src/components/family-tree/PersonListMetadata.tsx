import type { FamilyMember } from '../../types/family'
import { useLanguage } from '../../i18n/useLanguage'
import { formatFamilyDate } from '../../lib/display-date'

export function PersonListMetadata({ member }: { member: FamilyMember }) {
  const { t, language } = useLanguage()
  const birthDate = formatFamilyDate(member.birthDate, language)
  const deathDate = formatFamilyDate(member.deathDate, language)
  const date = deathDate
    ? `${birthDate ?? '\u2014'} \u2013 ${deathDate}`
    : birthDate ?? t('Birth date unknown')
  const gender = member.gender ? t(member.gender === 'male' ? 'Male' : 'Female') : t('Gender unknown')

  return <span className="person-list-metadata"><bdi dir="auto">{date}</bdi><span aria-hidden="true">{'\u2022'}</span><span>{gender}</span></span>
}
