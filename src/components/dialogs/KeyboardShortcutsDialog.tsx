import { useEffect, useRef } from 'react'
import { Keyboard, Search, Undo2, Redo2, X, MousePointer2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { getLayoutDirection } from '../../config/layout'

type Shortcut = { label: string; keys: string[]; icon: LucideIcon }

export function KeyboardShortcutsDialog({ onClose, canEdit }: { onClose: () => void; canEdit: boolean }) {
  const { t, language } = useLanguage()
  const closeRef = useRef<HTMLButtonElement>(null)
  const shortcuts: Shortcut[] = [
    { label: 'Search family members', keys: ['Ctrl', 'K'], icon: Search },
    { label: 'Undo', keys: ['Ctrl', 'Z'], icon: Undo2 },
    { label: 'Redo', keys: ['Ctrl', 'Shift', 'Z'], icon: Redo2 },
    { label: 'Redo', keys: ['Ctrl', 'Y'], icon: Redo2 },
    { label: 'Close menus and dialogs', keys: ['Esc'], icon: X },
    { label: 'Open person actions menu', keys: ['Shift', 'F10'], icon: MousePointer2 },
    { label: 'Open keyboard shortcuts', keys: ['?'], icon: Keyboard },
  ]

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
        {shortcuts.filter(({ label }) => canEdit || (label !== 'Undo' && label !== 'Redo')).map(({ label, keys, icon: Icon }, index) => <div className="keyboard-shortcut-row" key={`${label}-${keys.join('-')}-${index}`}>
          <span className="keyboard-shortcut-label"><Icon size={17} aria-hidden="true" />{t(label)}</span>
          <bdi className="keyboard-shortcut-keys" dir="ltr">{keys.map((key, keyIndex) => <span className="keyboard-shortcut-key-part" key={`${key}-${keyIndex}`}>{keyIndex > 0 && <span aria-hidden="true">+</span>}<kbd>{key}</kbd></span>)}</bdi>
        </div>)}
      </div>
      <footer className="keyboard-shortcuts-footer"><button type="button" className="primary-button" onClick={onClose}>{t('Done')}</button></footer>
    </section>
  </div>
}
