import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'

type DiscardChangesDialogProps = { onKeepEditing: () => void; onDiscard: () => void }

export function DiscardChangesDialog({ onKeepEditing, onDiscard }: DiscardChangesDialogProps) {
  const { t } = useLanguage()
  const keepRef = useRef<HTMLButtonElement>(null)
  const discardRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    keepRef.current?.focus()
  }, [])
  return <div className="modal-shade discard-changes-shade"><section className="confirm-dialog discard-changes-dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-changes-title" aria-describedby="discard-changes-description" onKeyDown={(event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onKeepEditing()
    }
    if (event.key === 'Tab' && event.shiftKey && document.activeElement === keepRef.current) {
      event.preventDefault()
      discardRef.current?.focus()
    } else if (event.key === 'Tab' && !event.shiftKey && document.activeElement === discardRef.current) {
      event.preventDefault()
      keepRef.current?.focus()
    }
  }}><span className="confirm-mark"><AlertTriangle size={19} /></span><h2 id="discard-changes-title">{t('Discard changes?')}</h2><p id="discard-changes-description" className="discard-changes-description">{t('Your unsaved changes will be lost.')}</p><div className="dialog-actions"><button ref={keepRef} type="button" className="primary-button" onClick={onKeepEditing}>{t('Keep editing')}</button><button ref={discardRef} type="button" className="secondary-button discard-danger-button" onClick={onDiscard}>{t('Discard')}</button></div></section></div>
}
