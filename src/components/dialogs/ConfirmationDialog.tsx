import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'

type ConfirmationDialogProps = { title: string; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; danger?: boolean }

export function ConfirmationDialog({ title, message, confirmLabel, onCancel, onConfirm, danger = false }: ConfirmationDialogProps) {
  const { t } = useLanguage()
  return <div className="modal-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><span className={`confirm-mark ${danger ? 'danger' : ''}`}><AlertTriangle size={19} /></span><h2 id="confirm-title">{t(title)}</h2><p>{t(message)}</p><div className="dialog-actions"><button className="secondary-button" onClick={onCancel}>{t('Cancel')}</button><button className={`primary-button ${danger ? 'danger-button' : ''}`} onClick={onConfirm}>{t(confirmLabel)}</button></div></section></div>
}
