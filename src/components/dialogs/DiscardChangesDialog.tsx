import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'

type DiscardChangesDialogProps = { onKeepEditing: () => void; onDiscard: () => void }

export function DiscardChangesDialog({ onKeepEditing, onDiscard }: DiscardChangesDialogProps) {
  const { t } = useLanguage()
  const keepRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    keepRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onKeepEditing()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeepEditing])
  return <div className="modal-shade discard-changes-shade"><section className="confirm-dialog discard-changes-dialog" role="alertdialog" aria-modal="true" aria-labelledby="discard-changes-title"><span className="confirm-mark"><AlertTriangle size={19} /></span><h2 id="discard-changes-title">{t('Discard changes?')}</h2><div className="dialog-actions"><button ref={keepRef} type="button" className="primary-button" onClick={onKeepEditing}>{t('Keep editing')}</button><button type="button" className="secondary-button" onClick={onDiscard}>{t('Discard')}</button></div></section></div>
}
