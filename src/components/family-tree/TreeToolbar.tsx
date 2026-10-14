import { useEffect, useRef, useState } from 'react'
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Circle,
  Download,
  HelpCircle,
  LayoutGrid,
  Maximize2,
  Minus,
  Plus,
  Redo2,
  Search,
  Settings2,
  Undo2,
  Upload,
  Workflow,
  X,
} from 'lucide-react'
import type { FamilyMember } from '../../types/family'
import type { TreeNodeMode } from '../../lib/tree-layout'
import { searchFamilyMembers } from '../../lib/family-search'
import { useLanguage } from '../../i18n/useLanguage'
import { RelationshipGuideDialog } from '../dialogs/RelationshipGuideDialog'

type TreeToolbarProps = {
  members: FamilyMember[]
  zoom: number
  mode: TreeNodeMode
  canUndo: boolean
  canRedo: boolean
  selectedId: string | null
  areAllExpanded: boolean
  onAddPerson: () => void
  onSearch: (member: FamilyMember) => void
  onZoom: (amount: number) => void
  onFit: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onUndo: () => void
  onRedo: () => void
  onSetMode: (mode: TreeNodeMode) => void
  onAutoOrganize: () => void
  onExport: (branchOnly: boolean) => void
  onImport: (file: File) => void
}

export function TreeToolbar(props: TreeToolbarProps) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const guideRef = useRef<HTMLDivElement>(null)
  const results = searchFamilyMembers(props.members, query).slice(0, 8)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setQuery('')
        setMenuOpen(false)
        setGuideOpen(false)
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
      if (!guideRef.current?.contains(event.target as Node)) setGuideOpen(false)
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  function choose(member: FamilyMember) {
    props.onSearch(member)
    setQuery('')
  }

  return (
    <div className="tree-toolbar" role="toolbar">
      <div className="toolbar-primary-group">
        <div className="toolbar-search">
          <Search size={19} />
          <input
            ref={searchRef}
            aria-label={t('Search family members')}
            placeholder={t('Find a person (Ctrl+K)')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && results[0]) choose(results[0])
            }}
          />
          {query && (
            <button
              type="button"
              title={t('Clear search')}
              aria-label={t('Clear search')}
              onClick={() => setQuery('')}
            >
              <X size={17} />
            </button>
          )}
          {query && (
            <div className="search-results" role="listbox">
              {results.length ? (
                results.map((person) => (
                  <button key={person.id} role="option" onClick={() => choose(person)}>
                    <span>{person.name}</span>
                    <small>{person.birthDate ? <bdi dir="ltr">{person.birthDate}</bdi> : t('Birth date unknown')} - {t(person.relationship)}</small>
                  </button>
                ))
              ) : (
                <div className="no-results">{t('No family members found')}</div>
              )}
            </div>
          )}
        </div>
        <button className="primary-button toolbar-add-person" onClick={props.onAddPerson}>
          <Plus size={19} /> {t('Add person')}
        </button>
      </div>

      <div className="toolbar-center-group">
        <div className="toolbar-divider" />
        <div className="toolbar-cluster zoom-controls">
          <button title={t('Zoom out')} aria-label={t('Zoom out')} onClick={() => props.onZoom(-.1)}>
            <Minus size={19} />
          </button>
          <span className="zoom-value">{Math.round(props.zoom * 100)}%</span>
          <button title={t('Zoom in')} aria-label={t('Zoom in')} onClick={() => props.onZoom(.1)}>
            <Plus size={19} />
          </button>
          <button title={t('Fit tree to screen')} aria-label={t('Fit tree to screen')} onClick={props.onFit}>
            <Maximize2 size={18} />
          </button>
          <button title={t('Layout')} aria-label={t('Auto-organize and center tree')} onClick={props.onAutoOrganize}>
            <Workflow size={19} />
          </button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-cluster toolbar-layout-group" aria-label={t('Tree layout tools')}>
          <div className="toolbar-cluster mode-actions" aria-label={t('Tree display mode')}>
            <button
              className={props.mode === 'circle' ? 'active-tool' : ''}
              title={t('View mode')}
              aria-label={t(props.mode === 'rectangle' ? 'Switch to circle portraits' : 'Switch to rectangle cards')}
              aria-pressed={props.mode === 'circle'}
              onClick={() => props.onSetMode(props.mode === 'rectangle' ? 'circle' : 'rectangle')}
            >
              {props.mode === 'rectangle' ? <LayoutGrid size={19} /> : <Circle size={19} />}
            </button>
          </div>
          <div className="toolbar-cluster tree-actions">
            <button
              title={t('Expand or collapse branches')}
              aria-label={t(props.areAllExpanded ? 'Collapse all branches' : 'Expand all branches')}
              onClick={props.areAllExpanded ? props.onCollapseAll : props.onExpandAll}
            >
              {props.areAllExpanded ? <ChevronsUpDown size={19} /> : <ChevronsDownUp size={19} />}
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar-system-group">
        <div className="toolbar-divider" />
        <div className="toolbar-cluster history-actions">
          <button title={t('Undo (Ctrl+Z)')} aria-label={t('Undo')} disabled={!props.canUndo} onClick={props.onUndo}>
            <Undo2 size={19} />
          </button>
          <button title={t('Redo (Ctrl+Shift+Z)')} aria-label={t('Redo')} disabled={!props.canRedo} onClick={props.onRedo}>
            <Redo2 size={19} />
          </button>
        </div>
        <div className="toolbar-divider settings-divider" />
        <div className="relationship-guide-popover-wrap" ref={guideRef}>
          <button
            className={`toolbar-guide-button ${guideOpen ? 'active' : ''}`}
            type="button"
            title={t('Relationship guide')}
            aria-label={t('Relationship guide')}
            aria-expanded={guideOpen}
            aria-controls="relationship-guide-panel"
            onClick={() => setGuideOpen((open) => !open)}
          >
            <HelpCircle size={19} />
          </button>
          {guideOpen && <RelationshipGuideDialog onClose={() => setGuideOpen(false)} />}
        </div>
        <div className="toolbar-menu-wrap settings-wrap" ref={menuRef}>
          <button
            className="settings-toggle"
            title={t('Settings')}
            aria-label={t('Settings')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Settings2 size={19} /> <span>{t('Settings')}</span>
          </button>
          {menuOpen && (
            <div className="toolbar-menu settings-menu">
              <button onClick={() => { props.onExport(false); setMenuOpen(false) }}>
                <Download size={14} /> {t('Export full tree')}
              </button>
              <button disabled={!props.selectedId} onClick={() => { props.onExport(true); setMenuOpen(false) }}>
                <Download size={14} /> {t('Export selected branch')}
              </button>
              <label>
                <Upload size={14} /> {t('Restore backup')}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) props.onImport(file)
                    event.currentTarget.value = ''
                    setMenuOpen(false)
                  }}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
