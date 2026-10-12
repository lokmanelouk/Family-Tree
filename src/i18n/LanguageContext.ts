import { createContext } from 'react'

export type Language = 'en' | 'ar'
export type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: (message: string, values?: Record<string, string | number>) => string }
export const LanguageContext = createContext<LanguageContextValue | null>(null)
