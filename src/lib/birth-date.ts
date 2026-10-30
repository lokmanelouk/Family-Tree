function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDateParts(value: string) {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = match[2] === undefined ? undefined : Number(match[2])
  const day = match[3] === undefined ? undefined : Number(match[3])
  if (year < 1000 || (month !== undefined && (month < 1 || month > 12))) return null
  if (day !== undefined) {
    const lastDay = new Date(year, month!, 0).getDate()
    if (day < 1 || day > lastDay) return null
  }
  return { year, month, day }
}

/** Return a validation message for the birth-date field, or an empty string when valid. */
export function getBirthDateError(value: string, now = new Date()) {
  if (!value.trim()) return ''
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value.trim())
  if (!match) return 'Enter a four-digit year, year and month, or complete date.'
  const parts = { year: Number(match[1]), month: match[2] === undefined ? undefined : Number(match[2]), day: match[3] === undefined ? undefined : Number(match[3]) }
  if (parts.year < 1000) return 'Enter a year from 1000 onward.'
  if (parts.month !== undefined && (parts.month < 1 || parts.month > 12)) return 'Enter a month from 01 to 12.'
  if (parts.day !== undefined && (parts.day < 1 || parts.day > new Date(parts.year, parts.month!, 0).getDate())) return 'Enter a valid day for this month.'
  const currentYear = now.getFullYear()
  if (parts.year > currentYear) return 'Birth dates cannot be in the future.'
  if (parts.year === currentYear && parts.month !== undefined && parts.month > now.getMonth() + 1) return 'Birth dates cannot be in the future.'
  if (parts.year === currentYear && parts.month === now.getMonth() + 1 && parts.day !== undefined && formatDate(new Date(parts.year, parts.month - 1, parts.day)) > formatDate(now)) return 'Birth dates cannot be in the future.'
  return ''
}

export function getDeathDateError(value: string, birthDate?: string, now = new Date()) {
  if (!value.trim()) return ''
  const error = getBirthDateError(value, now)
  if (error) return error === 'Birth dates cannot be in the future.' ? 'Death dates cannot be in the future.' : error
  if (!birthDate?.trim()) return ''
  const birthError = getBirthDateError(birthDate, now)
  if (birthError) return ''
  const birth = parseDateParts(birthDate)
  const death = parseDateParts(value)
  if (!birth || !death) return ''
  if (death.year < birth.year) return 'Death date must be after birth date.'
  if (death.year > birth.year) return ''
  if (birth.month === undefined || death.month === undefined) return 'Death date must be after birth date.'
  if (death.month < birth.month) return 'Death date must be after birth date.'
  if (death.month > birth.month) return ''
  if (birth.day === undefined || death.day === undefined || death.day <= birth.day) return 'Death date must be after birth date.'
  return ''
}
