import type { Language } from '../i18n/LanguageContext'

export const layoutDirection = 'keep' as const

export type LayoutDirection = typeof layoutDirection | 'mirror'

export function getLayoutDirection(language: Language, mode: LayoutDirection = layoutDirection): 'ltr' | 'rtl' {
  return language === 'ar' && mode === 'mirror' ? 'rtl' : 'ltr'
}
