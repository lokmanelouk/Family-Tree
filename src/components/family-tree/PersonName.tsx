import type { ReactNode } from 'react'
import { useLanguage } from '../../i18n/useLanguage'
import { getPersonNameDirection } from '../../lib/person-name'

export function PersonName({ name, children }: { name?: string; children?: ReactNode }) {
  const { language } = useLanguage()
  const value = name ?? String(children ?? '')
  return <bdi dir={getPersonNameDirection(value, language)}>{children ?? name}</bdi>
}
