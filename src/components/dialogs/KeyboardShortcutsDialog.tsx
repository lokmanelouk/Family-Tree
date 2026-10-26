import { useEffect, useRef } from 'react'
import { Keyboard, Search, Undo2, Redo2, X, MousePointer2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { getLayoutDirection } from '../../config/layout'

type Shortcut = { label: string; alternatives: string[][]; icon: LucideIcon; category: 'Navigation' | 'Editing' | 'Menus' }

export function KeyboardShortcutsDialog({ onClose, canEdit }: { onClose: () => void; canEdit: boolean }) {
  const { t, language } = useLanguage()
  const closeRef = useRef<HTMLButtonElement>(null)
  const shortcuts: Shortcut[] = [
    { label: 'Search family members', alternatives: [['Ctrl', 'K']], icon: Search, category: 'Navigation' },
    { label: 'Close menus and dialogs', alternatives: [['Esc']], icon: X, category: 'Navigation' },
    { label: 'Undo', alternatives: [['Ctrl', 'Z']], icon: Undo2, category: 'Editing' },
    { label: 'Redo', alternatives: [['Ctrl', 'Shift', 'Z'], ['Ctrl', 'Y']], icon: Redo2, category: 'Editing' },
    { label: 'Open person actions menu', alternatives: [['Shift', 'F10']], icon: MousePointer2, category: 'Menus' },
    { label: 'Open keyboard shortcuts', alternatives: [['?']], icon: Keyboard, category: 'Menus' },
  ]
  const categories: Shortcut['category'][] = ['Navigation', 'Editing', 'Menus']
  const visibleShortcuts = shortcuts.filter(({ label }) => canEdit || (label !== 'Undo' && label !== 'Redo'))

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  return <div className="modal-shade keyboard-shortcuts-shade" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="keyboard-shortcuts-dialog" role="dialog" aria-modal="true" aria-labelledby="keyboard-shortcuts-title" lang={language} dir={getLayoutDirection(language)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() } }}>
      <header className="keyboard-shortcuts-header">
        <div className="keyboard-shortcuts-heading-icon"><Keyboard size={20} /></div>
        <div><span>{t('Keyboard shortcuts')}</span><h2 id="keyboard-shortcuts-title">{t('Shortcuts for exploring your tree')}</h2></div>
        <button ref={closeRef} type="button" className="icon-button" aria-label={t('Close')} onClick={onClose}><X size={19} /></button>
      </header>
      <div className="keyboard-shortcuts-list">
        {categories.map((category) => {
          const categoryShortcuts = visibleShortcuts.filter((shortcut) => shortcut.category === category)
          if (!categoryShortcuts.length) return null
          return <section className="keyboard-shortcut-group" key={category} aria-labelledby={`keyboard-shortcut-group-${category.toLowerCase()}`}>
            <h3 id={`keyboard-shortcut-group-${category.toLowerCase()}`}>{t(category)}</h3>
            {categoryShortcuts.map(({ label, alternatives, icon: Icon }) => <div className="keyboard-shortcut-row" key={label}>
              <span className="keyboard-shortcut-label"><Icon size={17} aria-hidden="true" />{t(label)}</span>
              <span className="keyboard-shortcut-keys">{alternatives.map((keys, optionIndex) => <span className="keyboard-shortcut-option" key={`${label}-${optionIndex}`}>
                {optionIndex > 0 && <span className="keyboard-shortcut-or">{t('or')}</span>}
                <bdi dir="ltr">{keys.map((key, keyIndex) => <span className="keyboard-shortcut-key-part" key={`${key}-${keyIndex}`}>{keyIndex > 0 && <span aria-hidden="true">+</span>}<kbd>{key}</kbd></span>)}</bdi>
              </span>)}</span>
            </div>)}
          </section>
        })}
      </div>
      <footer className="keyboard-shortcuts-footer"><button type="button" className="primary-button" onClick={onClose}>{t('Done')}</button></footer>
    </section>
  </div>
}
