export type MemberAge = { count: number; unit: 'years' | 'months' | 'days' }

export function getMemberAge(birthDate?: string, deathDate?: string, now = new Date()): MemberAge | null {
  if (!birthDate) return null
  const yearMatch = /^(\d{4})$/.exec(birthDate.trim())
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim())
  if (!yearMatch && !isoMatch) return null
  const year = Number((yearMatch ?? isoMatch)![1])
  const end = deathDate ? parseExactDate(deathDate) ?? new Date(Number(deathDate), 11, 31, 12) : now
  if (!Number.isFinite(end.getTime()) || year > end.getFullYear()) return null

  if (yearMatch) return { count: Math.max(0, end.getFullYear() - year), unit: 'years' }
  const birth = parseExactDate(birthDate)
  if (!birth || birth > end) return null

  let years = end.getFullYear() - birth.getFullYear()
  let months = end.getMonth() - birth.getMonth()
  const days = end.getDate() - birth.getDate()
  if (days < 0) months -= 1
  if (months < 0) { years -= 1; months += 12 }
  if (years > 1) return { count: years, unit: 'years' }
  const totalMonths = years * 12 + months
  if (totalMonths >= 1) return { count: totalMonths, unit: 'months' }
  const elapsed = Math.max(0, Math.floor((end.getTime() - birth.getTime()) / 86_400_000))
  return { count: elapsed, unit: 'days' }
}

function parseExactDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(0)
  date.setFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setHours(12, 0, 0, 0)
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]) ? date : null
}
