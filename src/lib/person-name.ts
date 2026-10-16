export type TextDirection = 'ltr' | 'rtl' | 'auto'

export function getPersonNameDirection(name: string, language: 'en' | 'ar'): TextDirection {
  const mixedScript = /\p{Script=Arabic}/u.test(name) && /\p{Script=Latin}/u.test(name)
  return mixedScript ? language === 'ar' ? 'rtl' : 'ltr' : 'auto'
}
