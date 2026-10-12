import { useContext } from 'react'
import { LanguageContext } from './LanguageContext'

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('useLanguage must be used within LanguageProvider')
  return value
}
