import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, GitBranch, HelpCircle, Languages, Palette, Users } from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import { getGenerationMap } from '../../lib/tree-logic'
import { getRootBranches } from '../../lib/tree-layout'
import { useLanguage } from '../../i18n/useLanguage'
import { AccountMenu } from './AccountMenu'

const themes = [
  { value: 'charcoal', label: 'Charcoal' },
  { value: 'slate', label: 'Blue slate' },
  { value: 'light', label: 'Soft light' },
] as const
const arabicLanguageLabel = String.fromCodePoint(0x627, 0x644, 0x639, 0x631, 0x628, 0x64a, 0x629)

type TreeSidebarProps = {
  members: FamilyMember[]
  theme: 'charcoal' | 'slate' | 'light'
  onSetTheme: (theme: 'charcoal' | 'slate' | 'light') => void
  onOpenPeople: () => void
  onSelectMember: (member: FamilyMember) => void
}

export function TreeSidebar({ members, theme, onSetTheme, onOpenPeople, onSelectMember }: TreeSidebarProps) {
  const { t, language, setLanguage } = useLanguage()
  const [collapsed, setCollapsed] = useState(false)
  const generations = useMemo(() => new Set(getGenerationMap(members).values()).size, [members])
  const branches = useMemo(() => getRootBranches(members), [members])
  const themeLabel = t(themes.find((option) => option.value === theme)?.label ?? 'Charcoal')
  const languageLabel = language === 'ar' ? arabicLanguageLabel : 'English'

  return <aside className={`tree-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <a className="sidebar-brand" href="#tree" title="Kinfolk"><span className="brand-icon">k</span>{!collapsed && <span>Kinfolk</span>}</a>
    <div className="sidebar-content">
      <nav className="sidebar-group" aria-label={t('Family navigation')}>
        <button className="side-link selected" title={t('Family tree')} aria-current="page"><GitBranch size={18} />{!collapsed && <span>{t('Family tree')}</span>}</button>
        <button className="side-link" onClick={onOpenPeople} title={t('Family members')}><Users size={18} />{!collapsed && <><span>{t('Family members')}</span><small>{members.length}</small></>}</button>
      </nav>
      {!collapsed && <>
        <section className="sidebar-section" aria-labelledby="quick-stats-title">
          <h2 className="sidebar-section-title" id="quick-stats-title">{t('Quick stats')}</h2>
          <div className="sidebar-stats">
            <div className="sidebar-stat stat-members"><strong>{members.length}</strong><span>{t('Members')}</span></div>
            <div className="sidebar-stat stat-generations"><strong>{generations}</strong><span>{t('Generations')}</span></div>
            <div className="sidebar-stat stat-branches"><strong>{branches.length}</strong><span>{t('Branches')}</span></div>
          </div>
        </section>
        <section className="sidebar-section root-branches-section" aria-labelledby="root-branches-title">
          <h2 className="sidebar-section-title" id="root-branches-title">{t('Root family branches')}</h2>
          {branches.length ? <div className="root-branch-list">{branches.map((branch) => {
            const label = branch.partner ? `${branch.member.name} & ${branch.partner.name}` : branch.member.name
            return <button className="root-branch-link" key={branch.id} onClick={() => onSelectMember(branch.member)} title={t('Go to {name}', { name: label })}>
              <span className="root-branch-dot" style={branch.color ? { background: branch.color } : undefined} aria-hidden="true" />
              <span className="root-branch-name">{label}</span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          })}</div> : <p className="sidebar-empty-note">{t('Add a family member to see branches here.')}</p>}
        </section>
      </>}
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
          <Palette size={17} aria-hidden="true" />
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
    <AccountMenu collapsed={collapsed} memberCount={members.length} />
    <footer className="sidebar-bottom">
      {!collapsed && <div className="sidebar-info"><span className="sidebar-info-icon"><HelpCircle size={15} /></span><span><strong>Kinfolk</strong><small>{t('Family tree preview')}</small></span></div>}
      <button className="collapse-sidebar" onClick={() => setCollapsed(!collapsed)} title={collapsed ? t('Expand sidebar') : t('Collapse sidebar')} aria-label={collapsed ? t('Expand sidebar') : t('Collapse sidebar')}>{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
    </footer>
  </aside>
}
