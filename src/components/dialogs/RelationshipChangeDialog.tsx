import { useState } from 'react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import { validateRelationship } from '../../lib/tree-logic'
import { useLanguage } from '../../i18n/useLanguage'

type RelationshipChangeDialogProps = {
  source: FamilyMember
  target: FamilyMember
  members: FamilyMember[]
  onCancel: () => void
  onConfirm: (kind: RelationshipKind) => void
}

export function RelationshipChangeDialog({ source, target, members, onCancel, onConfirm }: RelationshipChangeDialogProps) {
  const { t } = useLanguage()
  const [kind, setKind] = useState<RelationshipKind>('child')
  const error = validateRelationship(members, source.id, target.id, kind)
  const descriptions: Record<RelationshipKind, string> = {
    child: '{source} will become a parent of {target}.',
    parent: '{source} will become a child of {target}.',
    partner: '{source} and {target} will be linked as partners.',
    sibling: '{source} will be linked as a sibling of {target}.',
    divorced: '{source} and {target} will be marked as divorced.',
    adopted: '{source} will be recorded as an adoptive parent of {target}.',
  }
  const description = t(descriptions[kind], { source: source.name, target: target.name })

  return (
    <div className="modal-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section className="confirm-dialog relationship-dialog" role="dialog" aria-modal="true" aria-labelledby="relationship-title">
        <span className="confirm-mark"><span className="relationship-arrows">↔</span></span>
        <h2 id="relationship-title">{t('Propose a relationship change')}</h2>
        <p>{t('Dragging only proposes a change. Review it below and confirm before family connections update.')}</p>
        <label htmlFor="relationship-kind">{t('Relationship')}</label>
        <select id="relationship-kind" value={kind} onChange={(event) => setKind(event.target.value as RelationshipKind)}>
          <option value="child">{t('Make {source} a parent of {target}.', { source: source.name, target: target.name })}</option>
          <option value="parent">{t('Make {source} a child of {target}.', { source: source.name, target: target.name })}</option>
          <option value="partner">{t('Link them as partners')}</option>
          <option value="divorced">{t('Mark partners as divorced')}</option>
          <option value="adopted">{t('Make {source} adoptive parent of {target}.', { source: source.name, target: target.name })}</option>
          <option value="sibling">{t('Link them as siblings')}</option>
        </select>
        <div className={`relationship-summary ${error ? 'has-error' : ''}`}>{error ? t(error) : description}</div>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onCancel}>{t('Cancel')}</button>
          <button className="primary-button" disabled={Boolean(error)} onClick={() => onConfirm(kind)}>{t('Confirm change')}</button>
        </div>
      </section>
    </div>
  )
}
