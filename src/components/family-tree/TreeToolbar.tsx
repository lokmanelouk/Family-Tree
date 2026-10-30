import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Circle,
  Download,
  HelpCircle,
  Keyboard,
  LayoutGrid,
  Maximize2,
  Minus,
  Network,
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
import { getFullName } from '../../lib/member-name'
import { PersonName } from './PersonName'
import { PersonListMetadata } from './PersonListMetadata'
import { FamilyAvatar } from './FamilyAvatar'
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
  onExportTreeArchive: () => void
  onBackUpNow: () => void
  onOpenTreeImport: () => void
  lastBackupLabel: string
  showBackupReminder: boolean
  onOpenRelationshipCalculator: () => void
  onOpenShortcuts: () => void
}

export function TreeToolbar(props: TreeToolbarProps) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [activeResultIndex, setActiveResultIndex] = useState(0)
  const [resultPlacement, setResultPlacement] = useState<{ side: 'above' | 'below'; maxHeight: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const searchResultsRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const guideRef = useRef<HTMLDivElement>(null)
  const guideButtonRef = useRef<HTMLButtonElement>(null)
  const guidePopoverRef = useRef<HTMLElement>(null)
  const results = searchFamilyMembers(props.members, query).slice(0, 8)
  const activeResult = results.length ? Math.min(activeResultIndex, results.length - 1) : -1

  useLayoutEffect(() => {
    if (!query) return
    const container = searchContainerRef.current
    const list = searchResultsRef.current
    if (!container || !list) return

    const updatePosition = () => {
      const bounds = container.getBoundingClientRect()
      const desiredHeight = Math.min(list.scrollHeight, 360)
      const spaceBelow = Math.max(0, window.innerHeight - bounds.bottom - 10)
      const spaceAbove = Math.max(0, bounds.top - 10)
      const side = desiredHeight > spaceBelow && spaceAbove > spaceBelow ? 'above' : 'below'
      const availableHeight = side === 'above' ? spaceAbove : spaceBelow
      const maxHeight = Math.min(360, availableHeight)
      setResultPlacement((current) => current?.side === side && current.maxHeight === maxHeight
        ? current
        : { side, maxHeight })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [query, results.length])

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
      if (!guideRef.current?.contains(event.target as Node) && !guidePopoverRef.current?.contains(event.target as Node)) setGuideOpen(false)
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
    setActiveResultIndex(0)
  }

  return (
    <div className="tree-toolbar" role="toolbar">
      <div className="toolbar-primary-group">
        <div className="toolbar-search" ref={searchContainerRef}>
          <Search size={19} />
          <input
            ref={searchRef}
            dir="auto"
            role="combobox"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={Boolean(query)}
            aria-controls="family-member-search-results"
            aria-activedescendant={activeResult >= 0 ? `family-member-search-result-${activeResult}` : undefined}
            aria-label={t('Search family members')}
            placeholder={t('Find a person (Ctrl+K)')}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveResultIndex(0) }}
            onKeyDown={(event) => {
              if (!results.length) return
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveResultIndex((index) => (index + 1) % results.length)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveResultIndex((index) => (index - 1 + results.length) % results.length)
              } else if (event.key === 'Enter') {
                event.preventDefault()
                choose(results[activeResult] ?? results[0])
              }
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
            <div
              ref={searchResultsRef}
              id="family-member-search-results"
              className={`search-results${resultPlacement?.side === 'above' ? ' is-above' : ''}`}
              role="listbox"
              aria-label={t('Search family members')}
              style={resultPlacement ? { maxHeight: `${resultPlacement.maxHeight}px` } : undefined}
            >
              {results.length ? (
                results.map((person, index) => (
                  <button
                    key={person.id}
                    id={`family-member-search-result-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeResult}
                    onFocus={() => setActiveResultIndex(index)}
                    onMouseMove={() => setActiveResultIndex(index)}
                    onClick={() => choose(person)}
                  >
                    <span className="search-result-avatar"><FamilyAvatar member={person} compact decorative /></span>
                    <span className="search-result-copy">
                      <span className="search-result-name"><PersonName name={getFullName(person)} /></span>
                      <PersonListMetadata member={person} />
                    </span>
                  </button>
                ))
              ) : (
                <div className="no-results search-no-results" role="status" aria-live="polite">
                  <Search size={16} aria-hidden="true" />
                  <span>{t('No family members found')}</span>
                </div>
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
        <button type="button" className="toolbar-shortcuts-button" title={t('Keyboard shortcuts')} aria-label={t('Keyboard shortcuts')} onClick={props.onOpenShortcuts}><Keyboard size={19} /></button>
        <button type="button" className="toolbar-relationship-calculator" title={t('How are we related?')} aria-label={t('How are we related?')} onClick={props.onOpenRelationshipCalculator}><Network size={19} /></button>
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
            ref={guideButtonRef}
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
          {guideOpen && <RelationshipGuideDialog anchorRef={guideButtonRef} popoverRef={guidePopoverRef} onClose={() => setGuideOpen(false)} />}
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
              <button onClick={() => { props.onExportTreeArchive(); setMenuOpen(false) }}>
                <Download size={14} /> {t('Export tree')}
              </button>
              <div className="toolbar-menu-backup-info">
                <span>{t('Last backup')}: <bdi>{props.lastBackupLabel}</bdi></span>
                {props.showBackupReminder && <small>{t('This tree has changed and needs a backup.')}</small>}
              </div>
              <button onClick={() => { props.onBackUpNow(); setMenuOpen(false) }}>
                <Download size={14} /> {t('Back up now')}
              </button>
              <button onClick={() => { props.onOpenTreeImport(); setMenuOpen(false) }}>
                <Upload size={14} /> {t('Import tree')}
              </button>
              <div className="toolbar-menu-separator" />
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
