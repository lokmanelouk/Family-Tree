import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { getBirthDateError } from '../../lib/birth-date'

type DatePickerProps = {
  id: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  showValidationError?: boolean
  onBlur?: () => void
  initialDateHint?: string
  label?: string
}

const FIRST_DAY_OF_WEEK = 0

function parseDate(value: string) {
  const yearOnly = /^(\d{4})$/.exec(value.trim())
  if (yearOnly) {
    const date = new Date(0)
    date.setFullYear(Number(yearOnly[1]), 0, 1)
    date.setHours(12, 0, 0, 0)
    return date
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(0)
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setHours(12, 0, 0, 0)
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatYear(year: number, locale: string) {
  return new Intl.NumberFormat(locale, { useGrouping: false }).format(year)
}

function formatDigits(digits: string) {
  const year = digits.slice(0, 4)
  if (digits.length <= 4) return year
  const month = digits.slice(4, 6)
  return `${year}-${month}${digits.length > 6 ? `-${digits.slice(6, 8)}` : ''}`
}

function caretAfterDigits(formatted: string, digitCount: number) {
  if (digitCount <= 0) return 0
  let seen = 0
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) seen += 1
    if (seen === digitCount) return index + 1
  }
  return formatted.length
}

export function DatePicker({ id, value, onChange, autoFocus = false, showValidationError = true, onBlur, initialDateHint, label }: DatePickerProps) {
  const { language, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => {
    const initial = parseDate(value) ?? new Date()
    return new Date(initial.getFullYear(), initial.getMonth(), 1)
  })
  const [view, setView] = useState<'days' | 'months' | 'years' | 'decades' | 'centuries'>('years')
  const [decadeCentury, setDecadeCentury] = useState(() => Math.floor((parseDate(value) ?? new Date()).getFullYear() / 100) * 100)
  const [yearPageStart, setYearPageStart] = useState(() => {
    const year = (parseDate(value) ?? new Date()).getFullYear()
    return 1000 + Math.floor((year - 1000) / 12) * 12
  })
  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [calendarPosition, setCalendarPosition] = useState({ top: 0, left: 0, ready: false })
  const [calendarTheme, setCalendarTheme] = useState<Record<string, string>>({})
  const [themeName, setThemeName] = useState('')
  const selectedDate = parseDate(value)
  const exactSelectedDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? selectedDate : null
  const hintedDate = parseDate(initialDateHint ?? '')
  const selectedYear = /^\d{4}$/.test(value.trim()) ? Number(value.trim()) : selectedDate?.getFullYear()
  const relatedYear = selectedYear === undefined ? hintedDate?.getFullYear() : undefined
  const locale = language === 'ar' ? 'ar' : 'en'
  const currentYear = new Date().getFullYear()
  const dateError = showValidationError ? getBirthDateError(value) : ''
  const weekDays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2025, 0, 5 + ((FIRST_DAY_OF_WEEK + index) % 7))))
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const leadingDays = (firstDay.getDay() - FIRST_DAY_OF_WEEK + 7) % 7
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - leadingDays + 1, 12))

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !calendarRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
        requestAnimationFrame(() => triggerRef.current?.focus())
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const positionCalendar = () => {
      const anchor = rootRef.current?.getBoundingClientRect()
      const calendar = calendarRef.current?.getBoundingClientRect()
      if (!anchor || !calendar) return
      const app = document.querySelector('.tree-app')
      if (app) {
        const computed = getComputedStyle(app)
        const names = ['--surface', '--surface-raised', '--surface-hover', '--surface-popover', '--line', '--line-soft', '--line-control', '--text', '--muted', '--subtle', '--accent', '--accent-strong', '--accent-soft', '--focus', '--on-accent', '--calendar-selected-text', '--shadow-popover', '--radius-popover', '--icon-history']
        const nextTheme = Object.fromEntries(names.map((name) => [name, computed.getPropertyValue(name).trim()]))
        setCalendarTheme((current) => names.every((name) => current[name] === nextTheme[name]) ? current : nextTheme)
        setThemeName(app.getAttribute('data-theme') ?? '')
      }
      const left = Math.max(12, Math.min(anchor.left, window.innerWidth - calendar.width - 12))
      const availableBelow = window.innerHeight - anchor.bottom - 10
      const top = availableBelow >= calendar.height || availableBelow >= anchor.top ? anchor.bottom + 7 : Math.max(12, anchor.top - calendar.height - 7)
      const inlineStart = document.documentElement.dir === 'rtl' ? window.innerWidth - left - calendar.width : left
      setCalendarPosition((current) => current.top === top && current.left === inlineStart && current.ready ? current : { top, left: inlineStart, ready: true })
    }
    positionCalendar()
    window.addEventListener('resize', positionCalendar)
    window.addEventListener('scroll', positionCalendar, true)
    return () => {
      window.removeEventListener('resize', positionCalendar)
      window.removeEventListener('scroll', positionCalendar, true)
    }
  }, [open, view, month, yearPageStart, decadeCentury])

  function showCalendar() {
    const typedYear = value.match(/\b\d{4}\b/)?.[0]
    const hintedYear = initialDateHint?.match(/\b\d{4}\b/)?.[0]
    const date = selectedDate ?? (typedYear ? new Date(Number(typedYear), 0, 1) : hintedYear ? new Date(Number(hintedYear), 0, 1) : new Date())
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    setYearPageStart(1000 + Math.floor((date.getFullYear() - 1000) / 12) * 12)
    setDecadeCentury(Math.floor(date.getFullYear() / 100) * 100)
    setView('years')
    setOpen((current) => !current)
  }

  function moveMonth(delta: number) {
    setMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + delta, 1)
      const minimum = new Date(1000, 0, 1)
      const maximum = new Date(currentYear, new Date().getMonth(), 1)
      const bounded = next < minimum ? minimum : next > maximum ? maximum : next
      return bounded
    })
  }

  function moveYearPage(delta: number) {
    setYearPageStart((current) => Math.min(1000 + Math.floor((currentYear - 1000) / 12) * 12, Math.max(1000, current + delta * 12)))
  }

  function moveDecade(delta: number) {
    setDecadeCentury((current) => Math.min(Math.floor(currentYear / 100) * 100, Math.max(1000, current + delta * 100)))
  }

  function chooseYear(year: number) {
    setMonth((current) => new Date(year, current.getMonth(), 1))
    setView('months')
  }

  function chooseMonth(monthIndex: number) {
    setMonth((current) => new Date(current.getFullYear(), monthIndex, 1))
    setView('days')
  }

  function commitDigits(digits: string, caretDigits: number) {
    const formatted = formatDigits(digits.slice(0, 8))
    onChange(formatted)
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      const caret = caretAfterDigits(formatted, Math.min(caretDigits, digits.length))
      input.setSelectionRange(caret, caret)
    })
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? start
    if (start !== end) return
    if (event.key === 'Backspace' && start > 0 && value[start - 1] === '-') {
      event.preventDefault()
      const digitsBeforeHyphen = value.slice(0, start - 1).replace(/\D/g, '').length
      const digits = value.replace(/\D/g, '')
      const removeIndex = Math.max(0, digitsBeforeHyphen - 1)
      commitDigits(digits.slice(0, removeIndex) + digits.slice(removeIndex + 1), removeIndex)
    } else if (event.key === 'Delete' && value[start] === '-') {
      event.preventDefault()
      const digitsBeforeHyphen = value.slice(0, start).replace(/\D/g, '').length
      const digits = value.replace(/\D/g, '')
      commitDigits(digits.slice(0, digitsBeforeHyphen) + digits.slice(digitsBeforeHyphen + 1), digitsBeforeHyphen)
    }
  }

  const years = Array.from({ length: 12 }, (_, index) => yearPageStart + index)
  const centuries = Array.from({ length: Math.floor((currentYear - 1000) / 100) + 1 }, (_, index) => 1000 + index * 100)
  const decades = Array.from({ length: 10 }, (_, index) => decadeCentury + index * 10)
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, index, 1)))
  const monthLimit = month.getFullYear() < currentYear ? 11 : new Date().getMonth()
  const yearPageEnd = yearPageStart + 11

  return <div className="custom-date-picker" ref={rootRef}>
    <div className={`custom-date-field${dateError ? ' has-error' : ''}`}>
      <input ref={inputRef} id={id} dir="auto" type="text" inputMode="numeric" autoComplete="off" autoFocus={autoFocus} value={value} placeholder={t('Birth date placeholder')} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? `${pickerId}-error` : undefined} aria-haspopup="dialog" aria-expanded={open} aria-controls={pickerId} onBlur={onBlur} onKeyDown={handleInputKeyDown} onChange={(event) => {
        const raw = event.currentTarget.value
        const caret = event.currentTarget.selectionStart ?? raw.length
        const digitOffset = raw.slice(0, caret).replace(/\D/g, '').length
        commitDigits(raw.replace(/\D/g, ''), digitOffset)
      }} />
      {value && <button className="custom-date-clear" type="button" aria-label={t('Clear date')} title={t('Clear date')} onClick={() => onChange('')}><X size={14} /></button>}
      <button ref={triggerRef} className="custom-date-trigger" type="button" aria-label={open ? t('Close calendar') : t('Open calendar')} aria-haspopup="dialog" aria-expanded={open} aria-controls={pickerId} onClick={showCalendar}><CalendarDays size={17} /></button>
    </div>
    {dateError && <p className="custom-date-error" id={`${pickerId}-error`} role="alert">{t(dateError)}</p>}
    {open && createPortal(<div ref={calendarRef} className="custom-calendar custom-calendar-portal" data-theme={themeName} style={{ ...calendarTheme, insetBlockStart: calendarPosition.top, insetInlineStart: calendarPosition.left, visibility: calendarPosition.ready ? 'visible' : 'hidden' } as CSSProperties} id={pickerId} role="dialog" aria-label={t(label ?? 'Choose date')}>
      <div className="custom-calendar-header">
        <button type="button" aria-label={t('Previous month')} disabled={view === 'years' ? yearPageStart <= 1000 : view === 'decades' ? decadeCentury <= 1000 : view === 'centuries' || (view === 'months' ? month.getFullYear() <= 1000 : month.getFullYear() === 1000 && month.getMonth() === 0)} onClick={() => {
          if (view === 'years') moveYearPage(-1)
          else if (view === 'decades') moveDecade(-1)
          else if (view === 'months') setMonth((current) => new Date(Math.max(1000, current.getFullYear() - 1), current.getMonth(), 1))
          else if (view === 'days') moveMonth(-1)
        }}><ChevronLeft size={16} /></button>
        {view === 'days' ? <div className="custom-calendar-month-year"><button type="button" className="calendar-view-toggle" onClick={() => setView('months')}>{new Intl.DateTimeFormat(locale, { month: 'long' }).format(month)}</button><button type="button" className="calendar-view-toggle calendar-year-toggle" onClick={() => { setYearPageStart(1000 + Math.floor((month.getFullYear() - 1000) / 12) * 12); setView('years') }}><bdi>{formatYear(month.getFullYear(), locale)}</bdi></button></div>
          : view === 'months' ? <div className="custom-calendar-month-year"><button type="button" className="calendar-view-toggle calendar-year-toggle" onClick={() => { setYearPageStart(1000 + Math.floor((month.getFullYear() - 1000) / 12) * 12); setView('years') }}><bdi>{formatYear(month.getFullYear(), locale)}</bdi></button></div>
            : view === 'years' ? <div className="custom-calendar-month-year"><button type="button" className="calendar-view-toggle" onClick={() => setView('centuries')}><bdi>{formatYear(yearPageStart, locale)}-{formatYear(yearPageEnd, locale)}</bdi></button></div>
              : view === 'decades' ? <div className="custom-calendar-month-year"><button type="button" className="calendar-view-toggle" onClick={() => setView('centuries')}><bdi>{t('Decade label', { decade: formatYear(decadeCentury, locale) })}</bdi></button></div>
                : <div className="custom-calendar-month-year"><strong>{t('Centuries')}</strong></div>}
        <button type="button" aria-label={t('Next month')} disabled={view === 'years' ? yearPageStart + 12 > currentYear : view === 'decades' ? decadeCentury + 100 > currentYear : view === 'centuries' || (view === 'months' ? month.getFullYear() >= currentYear : month.getFullYear() === currentYear && month.getMonth() === new Date().getMonth())} onClick={() => {
          if (view === 'years') moveYearPage(1)
          else if (view === 'decades') moveDecade(1)
          else if (view === 'months') setMonth((current) => new Date(Math.min(currentYear, current.getFullYear() + 1), current.getMonth(), 1))
          else if (view === 'days') moveMonth(1)
        }}><ChevronRight size={16} /></button>
      </div>
      {view === 'centuries' ? <div className="custom-calendar-choice-grid year-choice-grid">
        {centuries.map((century) => <button type="button" key={century} className={`custom-calendar-choice${selectedYear !== undefined && Math.floor(selectedYear / 100) * 100 === century ? ' selected' : ''}${relatedYear !== undefined && Math.floor(relatedYear / 100) * 100 === century ? ' related-year' : ''}`} aria-pressed={selectedYear !== undefined && Math.floor(selectedYear / 100) * 100 === century} onClick={() => { setDecadeCentury(century); setView('decades') }}><bdi>{t('Decade label', { decade: formatYear(century, locale) })}</bdi></button>)}
      </div> : view === 'decades' ? <div className="custom-calendar-choice-grid year-choice-grid">
        {decades.map((decade) => <button type="button" key={decade} className={`custom-calendar-choice${selectedYear !== undefined && Math.floor(selectedYear / 10) * 10 === decade ? ' selected' : ''}${relatedYear !== undefined && Math.floor(relatedYear / 10) * 10 === decade ? ' related-year' : ''}`} aria-pressed={selectedYear !== undefined && Math.floor(selectedYear / 10) * 10 === decade} disabled={decade > currentYear} onClick={() => { setYearPageStart(decade); setView('years') }}><bdi>{t('Decade label', { decade: formatYear(decade, locale) })}</bdi></button>)}
      </div> : view === 'years' ? <div className="custom-calendar-choice-grid year-choice-grid">
        {years.map((year) => <button type="button" key={year} className={`custom-calendar-choice${year === selectedYear ? ' selected' : ''}${year === relatedYear ? ' related-year' : ''}`} aria-pressed={year === selectedYear} disabled={year > currentYear} onClick={() => chooseYear(year)}><bdi>{formatYear(year, locale)}</bdi></button>)}
      </div> : view === 'months' ? <div className="custom-calendar-choice-grid month-choice-grid">
        {months.map((name, index) => <button type="button" key={index} className={`custom-calendar-choice${exactSelectedDate?.getFullYear() === month.getFullYear() && index === exactSelectedDate.getMonth() ? ' selected' : ''}`} aria-pressed={exactSelectedDate?.getFullYear() === month.getFullYear() && index === exactSelectedDate.getMonth()} disabled={index > monthLimit} onClick={() => chooseMonth(index)}>{name}</button>)}
      </div> : <div className="custom-calendar-grid">
        {weekDays.map((day, index) => <span className="custom-calendar-weekday" key={`${day}-${index}`} aria-hidden="true">{day}</span>)}
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth()
          const selected = exactSelectedDate?.getTime() === day.getTime()
          const today = formatDate(day) === formatDate(new Date())
          const futureDate = day.getFullYear() < 1000 || formatDate(day) > formatDate(new Date())
          return <button
            className={`custom-calendar-day${inMonth ? '' : ' outside-month'}${selected ? ' selected' : ''}${today ? ' today' : ''}${futureDate ? ' future-date' : ''}`}
            type="button"
            key={formatDate(day)}
            aria-pressed={selected}
            disabled={futureDate}
            aria-label={day.toLocaleDateString(locale, { dateStyle: 'full' })}
            onClick={() => { onChange(formatDate(day)); setOpen(false) }}
          ><bdi>{new Intl.NumberFormat(locale).format(day.getDate())}</bdi></button>
        })}
      </div>}
      <div className="custom-calendar-footer">
        <span className="custom-calendar-footer-slot">{view === 'days' ? <button type="button" onClick={() => { onChange(formatDate(new Date())); setOpen(false) }}>{t('Today')}</button> : <span aria-hidden="true" />}</span>
        <span className="custom-calendar-footer-slot">{value ? <button type="button" onClick={() => { onChange(''); setOpen(false) }}>{t('Clear date')}</button> : <span aria-hidden="true" />}</span>
      </div>
    </div>, document.body)}
  </div>
}
