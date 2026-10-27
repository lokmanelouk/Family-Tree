import { useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Archive, FileUp, X } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { getLayoutDirection } from '../../config/layout'
import { parseTreeArchive, TREE_ARCHIVE_MAX_BYTES, type ParsedTreeArchive } from '../../lib/tree-archive'
import type { TreeRecord } from '../../lib/storage/local-tree-storage'

type ImportMode = 'new' | 'replace'

type TreeArchiveImportDialogProps = {
  currentTree: TreeRecord | null
  onClose: () => void
  onImport: (archive: ParsedTreeArchive, mode: ImportMode) => Promise<void>
}

function formatDate(value: string, language: string) {
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(new Date(value))
}

export function TreeArchiveImportDialog({ currentTree, onClose, onImport }: TreeArchiveImportDialogProps) {
  const { t, language } = useLanguage()
  const [archive, setArchive] = useState<ParsedTreeArchive | null>(null)
  const [mode, setMode] = useState<ImportMode>('new')
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    setError('')
    setArchive(null)
    if (!file) return
    setBusy(true)
    try {
      if (file.size > TREE_ARCHIVE_MAX_BYTES) throw new Error('The ZIP file is too large.')
      const bytes = new Uint8Array(await file.arrayBuffer())
      setArchive(parseTreeArchive(bytes))
      setMode('new')
      setConfirmName('')
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'This ZIP file is broken or incomplete.'))
    } finally {
      setBusy(false)
    }
  }

  async function importSelected() {
    if (!archive || busy || (mode === 'replace' && (!currentTree || confirmName !== currentTree.name))) return
    setBusy(true)
    setError('')
    try {
      await onImport(archive, mode)
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : 'Could not import this tree.'))
      setBusy(false)
    }
  }

  const activeTheme = typeof document === 'undefined' ? 'midnight' : document.querySelector<HTMLElement>('.tree-app')?.dataset.theme ?? 'midnight'
  const dialog = <div className="tree-app tree-archive-import-theme-root" data-theme={activeTheme}><div className="modal-shade tree-archive-import-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) event.preventDefault() }}>
    <section className="confirm-dialog tree-archive-import-dialog" role="dialog" aria-modal="true" aria-labelledby="tree-archive-import-title" lang={language} dir={getLayoutDirection(language)}>
      <button type="button" className="dialog-close" aria-label={t('Close')} onClick={onClose}><X size={17} /></button>
      <span className="confirm-mark"><Archive size={19} /></span>
      <h2 id="tree-archive-import-title">{t('Import tree')}</h2>
      <label className="tree-archive-file-button"><FileUp size={16} />{t(archive ? 'Choose a different ZIP' : 'Choose a ZIP file')}<input type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(event) => void readFile(event)} disabled={busy} /></label>
      {busy && <p className="tree-archive-progress" role="status">{t('Validating archive…')}</p>}
      {archive && <>
        <div className="tree-archive-preview">
          <strong dir="auto">{archive.treeName}</strong>
          <span>{t('People')}: <bdi>{archive.members.length}</bdi></span>
          <span>{t('Photos')}: <bdi>{archive.photos.size}</bdi></span>
          <span>{t('Export date')}: <bdi>{formatDate(archive.exportDate, language)}</bdi></span>
        </div>
        <div className="tree-archive-import-options">
          <button type="button" className={mode === 'new' ? 'is-selected' : ''} aria-pressed={mode === 'new'} onClick={() => { setMode('new'); setConfirmName('') }}>
            <strong>{t('Import as a new tree')}</strong>
            <small>{t('The current tree stays unchanged.')}</small>
          </button>
          <button type="button" className={mode === 'replace' ? 'is-selected' : ''} aria-pressed={mode === 'replace'} disabled={!currentTree} onClick={() => setMode('replace')}>
            <strong>{t('Replace the current tree')}</strong>
            <small>{currentTree ? <>{t('Replace')}: <bdi>{currentTree.name}</bdi></> : t('No current tree to replace.')}</small>
          </button>
        </div>
        {mode === 'replace' && currentTree && <label className="tree-archive-confirm-name">{t('Type the tree name to confirm')}<input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} dir="auto" autoComplete="off" /></label>}
      </>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>{t('Cancel')}</button>
        <button type="button" className="primary-button" onClick={() => void importSelected()} disabled={!archive || busy || (mode === 'replace' && (!currentTree || confirmName !== currentTree.name))}>
          {t(busy ? 'Please wait…' : mode === 'new' ? 'Import as a new tree' : 'Replace the current tree')}
        </button>
      </div>
    </section>
  </div></div>
  return createPortal(dialog, document.body)
}
