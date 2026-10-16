import { CircleStop, TriangleAlert } from 'lucide-react'
import type { ValidationIssue } from '../../lib/family-validation'
import { useLanguage } from '../../i18n/useLanguage'
import { PersonName } from './PersonName'
import type { FamilyMember } from '../../types/family'
import { getDisambiguatedFullName, getFullName } from '../../lib/member-name'
import { interpolateMessageParts } from '../../lib/message-format'

export function ValidationMessage({ issue, members = [] }: { issue: ValidationIssue; members?: FamilyMember[] }) {
  const { t, language } = useLanguage()
  const displayValues = Object.fromEntries(Object.entries(issue.values).map(([key, value]) => {
    if (key === 'gender' || key === 'relation') return [key, t(String(value).replace(/^./, (letter) => letter.toUpperCase()))]
    if (isNameValue(key)) {
      const matchingMember = members.find((member) => getFullName(member) === String(value))
      return [key, matchingMember ? getDisambiguatedFullName(matchingMember, members) : value]
    }
    return [key, value]
  }))
  const parts = interpolateMessageParts(t(issue.messageKey), displayValues)
  return <>{parts.map((part, index) => part.type === 'text'
    ? <bdi dir={language === 'ar' ? 'rtl' : 'ltr'} key={`text-${index}`}>{part.value}</bdi>
    : isNameValue(part.key)
      ? <PersonName key={`value-${part.key}-${index}`} name={String(part.value)} />
      : <bdi dir="ltr" key={`value-${part.key}-${index}`}>{part.value}</bdi>)}</>
}

export function ValidationNotice({ issue, members }: { issue: ValidationIssue; members?: FamilyMember[] }) {
  const Icon = issue.type === 'error' ? CircleStop : TriangleAlert
  return <p className={`validation-notice validation-notice-${issue.type}`} role="alert"><Icon size={18} aria-hidden="true" /><span><ValidationMessage issue={issue} members={members} /></span></p>
}

function isNameValue(key: string) {
  return ['name', 'parent', 'child', 'person', 'a', 'b', 'source', 'target'].includes(key)
}
