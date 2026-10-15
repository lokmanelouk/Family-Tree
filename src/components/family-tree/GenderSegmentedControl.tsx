import { useRef } from 'react'
import { Mars, Venus } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'

type Gender = 'male' | 'female'

type GenderSegmentedControlProps = {
  value: Gender | null
  label: string
  onChange: (value: Gender) => void
}

export function GenderSegmentedControl({ value, label, onChange }: GenderSegmentedControlProps) {
  const { t } = useLanguage()
  const maleRef = useRef<HTMLButtonElement>(null)
  const femaleRef = useRef<HTMLButtonElement>(null)

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const rtl = document.documentElement.dir === 'rtl'
    const next = event.key === 'ArrowRight' ? (rtl ? 'male' : 'female') : event.key === 'ArrowLeft' ? (rtl ? 'female' : 'male') : null
    if (!next) return
    event.preventDefault()
    onChange(next)
    ;(next === 'male' ? maleRef : femaleRef).current?.focus()
  }

  return <div className="gender-field">
    <span>{label}</span>
    <div className="gender-segmented-control" role="radiogroup" aria-label={label}>
      {value && <span className={`gender-segment-indicator is-${value}`} aria-hidden="true" />}
      <button ref={maleRef} type="button" role="radio" aria-checked={value === 'male'} tabIndex={value === 'male' || value === null ? 0 : -1} className={`gender-segment-option male${value === 'male' ? ' is-selected' : ''}`} onClick={() => onChange('male')} onKeyDown={handleKeyDown}><Mars size={15} strokeWidth={1.7} /><span>{t('Male')}</span></button>
      <button ref={femaleRef} type="button" role="radio" aria-checked={value === 'female'} tabIndex={value === 'female' ? 0 : -1} className={`gender-segment-option female${value === 'female' ? ' is-selected' : ''}`} onClick={() => onChange('female')} onKeyDown={handleKeyDown}><Venus size={15} strokeWidth={1.7} /><span>{t('Female')}</span></button>
    </div>
  </div>
}
