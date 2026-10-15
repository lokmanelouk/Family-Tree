import type { ReactNode } from 'react'
import type { ValidationIssue } from '../../lib/family-validation'
import { useLanguage } from '../../i18n/useLanguage'

export function ValidationMessage({ issue }: { issue: ValidationIssue }) {
  const { t } = useLanguage()
  const displayValues = Object.fromEntries(Object.entries(issue.values).map(([key, value]) => [key, key === 'gender' || key === 'relation' ? t(String(value).replace(/^./, (letter) => letter.toUpperCase())) : value]))
  const values = Object.fromEntries(Object.keys(displayValues).map((key) => [key, `__VALUE_${key}__`]))
  const message = t(issue.messageKey, values)
  const parts: ReactNode[] = [message]
  for (const [key, value] of Object.entries(displayValues)) {
    const marker = `__VALUE_${key}__`
    const next: ReactNode[] = []
    parts.forEach((part) => {
      if (typeof part !== 'string' || !part.includes(marker)) next.push(part)
      else {
        const chunks = part.split(marker)
        chunks.forEach((chunk, index) => {
          if (chunk) next.push(chunk)
          if (index < chunks.length - 1) next.push(<bdi dir="auto" key={`${key}-${index}`}>{value}</bdi>)
        })
      }
    })
    parts.splice(0, parts.length, ...next)
  }
  return <>{parts}</>
}

export function ValidationIssues({ issues, onContinue, onBack }: { issues: ValidationIssue[]; onContinue: () => void; onBack: () => void }) {
  const { t } = useLanguage()
  if (!issues.length) return null
  return <div className="validation-warning-box" role="alert">
    <ul>{issues.map((issue, index) => <li key={`${issue.messageKey}-${index}`}><ValidationMessage issue={issue} /></li>)}</ul>
    <div className="validation-warning-actions"><button type="button" onClick={onBack}>{t('Go back')}</button><button type="button" onClick={onContinue}>{t('Continue anyway')}</button></div>
  </div>
}
