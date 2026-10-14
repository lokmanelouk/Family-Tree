import { useEffect, useId, useRef } from 'react'
import { GitBranch, HeartHandshake, ShieldCheck, X } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'

type RelationshipGuideDialogProps = { onClose: () => void }

export function RelationshipGuideDialog({ onClose }: RelationshipGuideDialogProps) {
  const { t } = useLanguage()
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return <section id="relationship-guide-panel" className="relationship-guide-popover" role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="dialog-header">
        <div><span>{t('CANVAS GUIDE')}</span><h2 id={titleId}>{t('Relationship guide')}</h2></div>
        <button ref={closeButtonRef} type="button" className="relationship-guide-close" title={t('Close relationship guide')} aria-label={t('Close relationship guide')} onClick={onClose}><X size={17} /></button>
      </header>
      <p className="relationship-guide-intro" dir="auto">{t('A quick guide to the symbols and lines in your family tree.')}</p>
      <div className="relationship-guide-list">
        <div className="relationship-guide-item">
          <span className="guide-symbol marriage-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="13" r="5.2" /><circle cx="15" cy="13" r="5.2" /></svg></span>
          <span><strong>{t('Interlocked rings')}</strong><small>{t('Marriage between partners')}</small></span>
        </div>
        <div className="relationship-guide-item">
          <span className="guide-symbol divorce-symbol" aria-hidden="true"><HeartHandshake size={20} /></span>
          <span><strong>{t('Broken badge')}</strong><small>{t('Divorce or separation between former partners')}</small></span>
        </div>
        <div className="relationship-guide-item">
          <span className="guide-symbol adoption-symbol" aria-hidden="true"><ShieldCheck size={20} /></span>
          <span><strong>{t('Shield badge')}</strong><small>{t('Adoption; the dotted line marks an adoptive relationship')}</small></span>
        </div>
        <div className="relationship-guide-item">
          <span className="guide-symbol lineage-symbol" aria-hidden="true"><GitBranch size={20} /></span>
          <span><strong>{t('Relationship lines')}</strong><small>{t('Solid lines show biological lineage; dashed lines show partner relationships')}</small></span>
        </div>
      </div>
      <div className="relationship-guide-line-examples" aria-label={t('Line styles')}>
        <span><i className="guide-line solid" />{t('Biological')}</span>
        <span><i className="guide-line dashed" />{t('Partners')}</span>
        <span><i className="guide-line dotted" />{t('Adoption')}</span>
      </div>
  </section>
}
