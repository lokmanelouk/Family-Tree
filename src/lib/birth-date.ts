function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Return a validation message for the birth-date field, or an empty string when valid. */
export function getBirthDateError(value: string, now = new Date()) {
  if (!value.trim()) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.length < 4) return 'Enter a four-digit year or complete date.'
  const year = Number(digits.slice(0, 4))
  const currentYear = now.getFullYear()
  if (year < 1000) return 'Enter a year from 1000 onward.'
  if (year > currentYear) return 'Birth dates cannot be in the future.'
  if (digits.length === 5 && Number(digits[4]) > 1) return 'Enter a month from 01 to 12.'
  if (digits.length >= 6) {
    const month = Number(digits.slice(4, 6))
    if (month < 1 || month > 12) return 'Enter a month from 01 to 12.'
    if (year === currentYear && month > now.getMonth() + 1) return 'Birth dates cannot be in the future.'
  }
  if (digits.length !== 4 && digits.length !== 8) return 'Enter a four-digit year or complete date.'
  if (digits.length === 8) {
    const month = Number(digits.slice(4, 6))
    const day = Number(digits.slice(6, 8))
    const date = new Date(0)
    date.setFullYear(year, month - 1, day)
    date.setHours(12, 0, 0, 0)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return 'Enter a valid day for this month.'
    if (formatDate(date) > formatDate(now)) return 'Birth dates cannot be in the future.'
  }
  return ''
}

export function getDeathDateError(value: string, birthDate?: string, now = new Date()) {
  if (!value.trim()) return ''
  const error = getBirthDateError(value, now)
  if (error) return error === 'Birth dates cannot be in the future.' ? 'Death dates cannot be in the future.' : error
  if (!birthDate?.trim()) return ''
  const birthError = getBirthDateError(birthDate, now)
  if (birthError) return ''
  const birthYear = Number(birthDate.slice(0, 4))
  const deathYear = Number(value.slice(0, 4))
  if (deathYear < birthYear) return 'Death date must be after birth date.'
  if (deathYear > birthYear) return ''
  if (birthDate.length !== 10 || value.length !== 10 || value <= birthDate) return 'Death date must be after birth date.'
  return ''
}
