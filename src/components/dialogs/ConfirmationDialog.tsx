import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLanguage } from '../../i18n/useLanguage'

type ConfirmationDialogProps = { title: ReactNode; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; danger?: boolean }

export function ConfirmationDialog({ title, message, confirmLabel, onCancel, onConfirm, danger = false }: ConfirmationDialogProps) {
  const { t } = useLanguage()
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])
  return <div className="modal-shade"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><span className={`confirm-mark ${danger ? 'danger' : ''}`}><AlertTriangle size={19} /></span><h2 id="confirm-title">{title}</h2><p>{t(message)}</p><div className="dialog-actions"><button ref={cancelRef} type="button" className="secondary-button" onClick={onCancel}>{t('Cancel')}</button><button type="button" className={`primary-button ${danger ? 'danger-button' : ''}`} onClick={onConfirm}>{t(confirmLabel)}</button></div></section></div>
}
