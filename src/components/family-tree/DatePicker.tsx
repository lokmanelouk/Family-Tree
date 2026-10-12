import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'

type DatePickerProps = {
  id: string
  value: string
  onChange: (value: string) => void
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function DatePicker({ id, value, onChange }: DatePickerProps) {
  const { language, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => {
    const initial = parseDate(value) ?? new Date()
    return new Date(initial.getFullYear(), initial.getMonth(), 1)
  })
  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selectedDate = parseDate(value)
  const locale = language === 'ar' ? 'ar' : 'en'
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)
  const weekDays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2025, 0, 5 + index)))
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const leadingDays = firstDay.getDay()
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - leadingDays + 1, 12))

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        requestAnimationFrame(() => triggerRef.current?.focus())
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function showCalendar() {
    const date = selectedDate ?? new Date()
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setOpen((current) => !current)
  }

  function moveMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  return <div className="custom-date-picker" ref={rootRef}>
    <div className="custom-date-field">
      <input id={id} type="text" value={value} placeholder="YYYY-MM-DD" readOnly aria-haspopup="dialog" aria-expanded={open} aria-controls={pickerId} onClick={showCalendar} />
      {value && <button className="custom-date-clear" type="button" aria-label={t('Clear date')} title={t('Clear date')} onClick={() => onChange('')}><X size={14} /></button>}
      <button ref={triggerRef} className="custom-date-trigger" type="button" aria-label={open ? t('Close calendar') : t('Open calendar')} aria-haspopup="dialog" aria-expanded={open} aria-controls={pickerId} onClick={showCalendar}><CalendarDays size={17} /></button>
    </div>
    {open && <div className="custom-calendar" id={pickerId} role="dialog" aria-label={t('Choose birth date')}>
      <div className="custom-calendar-header">
        <button type="button" aria-label={t('Previous month')} onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></button>
        <strong>{monthLabel}</strong>
        <button type="button" aria-label={t('Next month')} onClick={() => moveMonth(1)}><ChevronRight size={16} /></button>
      </div>
      <div className="custom-calendar-grid">
        {weekDays.map((day, index) => <span className="custom-calendar-weekday" key={`${day}-${index}`} aria-hidden="true">{day}</span>)}
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth()
          const selected = selectedDate?.getTime() === day.getTime()
          const today = formatDate(day) === formatDate(new Date())
          return <button
            className={`custom-calendar-day${inMonth ? '' : ' outside-month'}${selected ? ' selected' : ''}${today ? ' today' : ''}`}
            type="button"
            key={formatDate(day)}
            aria-pressed={selected}
            aria-label={day.toLocaleDateString(locale, { dateStyle: 'full' })}
            onClick={() => { onChange(formatDate(day)); setOpen(false) }}
          >{day.getDate()}</button>
        })}
      </div>
      <div className="custom-calendar-footer">
        <button type="button" onClick={() => { onChange(formatDate(new Date())); setOpen(false) }}>{t('Today')}</button>
        {value && <button type="button" onClick={() => onChange('')}>{t('Clear date')}</button>}
      </div>
    </div>}
  </div>
}
