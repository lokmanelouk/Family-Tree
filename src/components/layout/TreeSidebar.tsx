import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Coffee, GitBranch, HelpCircle, Languages, LogOut, Moon, Sun } from 'lucide-react'
import type { AppTheme } from '../../types/theme'
import { useLanguage } from '../../i18n/useLanguage'

const themes = [
  { value: 'midnight', label: 'Midnight' },
  { value: 'warm-light', label: 'Warm light' },
  { value: 'chocolate', label: 'Chocolate' },
] as const
const arabicLanguageLabel = String.fromCodePoint(0x627, 0x644, 0x639, 0x631, 0x628, 0x64a, 0x629)

type TreeSidebarProps = {
  theme: AppTheme
  onSetTheme: (theme: AppTheme) => void
  userEmail: string
  onSignOut: () => void
  treeName: string
  treeId: string
  trees: { id: string; name: string }[]
  onSwitchTree: (treeId: string) => void
}

export function TreeSidebar({ theme, onSetTheme, userEmail, onSignOut, treeName, treeId, trees, onSwitchTree }: TreeSidebarProps) {
  const { t, language, setLanguage } = useLanguage()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('family-tree-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('family-tree-sidebar-collapsed', String(collapsed))
    } catch {
      return
    }
  }, [collapsed])
  const themeLabel = t(themes.find((option) => option.value === theme)?.label ?? 'Midnight')
  const languageLabel = language === 'ar' ? arabicLanguageLabel : 'English'

  return <aside className={`tree-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <a className="sidebar-brand" href="#tree" title={`Kinfolk · ${treeName}`}><span className="brand-icon">k</span>{!collapsed && <span>Kinfolk</span>}</a>
    {!collapsed && trees.length > 1 && <label className="sidebar-tree-switcher"><span>{t('Current family tree')}</span><select value={treeId} onChange={(event) => onSwitchTree(event.target.value)} aria-label={t('Switch family tree')}>{trees.map((tree) => <option key={tree.id} value={tree.id}>{tree.name}</option>)}</select></label>}
    <div className="sidebar-content">
      <nav className="sidebar-group" aria-label={t('Family navigation')}>
        <button className="side-link selected" title={t('Family tree')} aria-current="page"><GitBranch size={18} />{!collapsed && <span>{t('Family tree')}</span>}</button>
      </nav>
    </div>
    <section className="sidebar-preferences" aria-label={t('Appearance and language')}>
      <button
        className="sidebar-preference-button theme-preference-button"
        type="button"
        title={`${t('Theme')}: ${themeLabel}`}
        aria-label={`${t('Theme')}: ${themeLabel}`}
        onClick={() => {
          const currentIndex = themes.findIndex((option) => option.value === theme)
          onSetTheme(themes[(currentIndex + 1) % themes.length].value)
        }}
      >
        <span className="sidebar-preference-content" key={theme}>
          {theme === 'midnight'
            ? <Moon className="theme-icon theme-icon-midnight" size={18} aria-hidden="true" />
            : theme === 'warm-light'
              ? <Sun className="theme-icon theme-icon-warm-light" size={18} aria-hidden="true" />
              : <Coffee className="theme-icon theme-icon-chocolate" size={18} aria-hidden="true" />}
          <span className="sidebar-preference-value">{themeLabel}</span>
        </span>
      </button>
      <button
        className="sidebar-preference-button language-preference-button"
        type="button"
        title={`${t('Language')}: ${languageLabel}`}
        aria-label={`${t('Language')}: ${languageLabel}`}
        onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
      >
        <span className="sidebar-preference-content" key={language}>
          <Languages size={17} aria-hidden="true" />
          <span className="sidebar-preference-value">{languageLabel}</span>
        </span>
      </button>
    </section>
    <div className="sidebar-account" title={userEmail}>
      <span className="sidebar-account-avatar">{userEmail.slice(0, 1).toLocaleUpperCase()}</span>
      {!collapsed && <span className="sidebar-account-email" dir="auto">{userEmail}</span>}
      <button type="button" className="sidebar-signout" onClick={onSignOut} title={t('Sign out')} aria-label={t('Sign out')}><LogOut size={17} /></button>
    </div>
    <footer className="sidebar-bottom">
      {!collapsed && <div className="sidebar-info"><span className="sidebar-info-icon"><HelpCircle size={15} /></span><span className="sidebar-info-copy"><strong>Kinfolk</strong><small>{t('Family tree preview')}</small></span></div>}
      <button className="collapse-sidebar" onClick={() => setCollapsed(!collapsed)} title={collapsed ? t('Expand sidebar') : t('Collapse sidebar')} aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}><span className="sidebar-collapse-icon">{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</span></button>
    </footer>
  </aside>
}
