import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import type { DragEvent } from 'react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import type { CSSProperties } from 'react'
import type { TreeNodeMode } from '../../lib/tree-layout'
import { FamilyAvatar } from './FamilyAvatar'
import { FamilyMemberSpeedDial } from './FamilyMemberSpeedDial'
import { useLanguage } from '../../i18n/useLanguage'

type PersonCardProps = {
  member: FamilyMember
  mode: TreeNodeMode
  branchColor: string | null
  isSelected: boolean
  isFocused: boolean
  childCount: number
  isCollapsed: boolean
  isDropTarget: boolean
  onSelect: (member: FamilyMember) => void
  onToggleBranch: (id: string) => void
  onAddRelative: (member: FamilyMember, kind: RelationshipKind) => void
  onDragStart: (event: DragEvent<HTMLButtonElement>, member: FamilyMember) => void
  onDragEnd: () => void
  onDrop: (event: DragEvent<HTMLElement>, target: FamilyMember) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  readOnly?: boolean
}

export function PersonCard({ member, mode, branchColor, isSelected, isFocused, childCount, isCollapsed, isDropTarget, readOnly = false, onSelect, onToggleBranch, onAddRelative, onDragStart, onDragEnd, onDrop, onDragOver }: PersonCardProps) {
  const { t } = useLanguage()
  const dates = member.deathDate ? `${member.birthDate ?? '—'} – ${member.deathDate}` : member.birthDate ? `b. ${member.birthDate}` : null
  return (
    <article className={`person-node ${mode === 'circle' ? 'circle-node' : ''} ${branchColor !== null ? 'branch-colored' : ''} ${isSelected ? 'is-selected' : ''} ${isFocused ? '' : 'is-dimmed'} ${isDropTarget ? 'drop-target' : ''}`} style={branchColor !== null ? { '--branch-color': branchColor } as CSSProperties : undefined} data-member-id={member.id} onDragOver={readOnly ? undefined : onDragOver} onDrop={readOnly ? undefined : (event) => onDrop(event, member)}>
      <button className="member-main" dir="auto" onClick={() => onSelect(member)} aria-pressed={isSelected} aria-label={`${member.name}${dates ? `, ${dates}` : ''}`}>
        <span className="node-avatar"><FamilyAvatar member={member} compact /></span>
        <span className="node-copy"><strong>{member.name}</strong>{dates && <small>{dates}</small>}<small className="node-relation">{t(member.relationship)}</small></span>
      </button>
      {!readOnly && <div className="node-actions">
        <button className="node-action drag-handle" draggable onDragStart={(event) => onDragStart(event, member)} onDragEnd={onDragEnd} aria-label={t('Drag {name} to propose a relationship change', { name: member.name })} title={t('Drag to propose a relationship change')}><GripVertical size={15} /></button>
        <FamilyMemberSpeedDial member={member} onAddRelative={onAddRelative} />
        {childCount > 0 && <button className="node-action branch-toggle" onClick={() => onToggleBranch(member.id)} aria-label={t(`${isCollapsed ? 'Expand' : 'Collapse'} branch for {name}`, { name: member.name })} title={t(`${isCollapsed ? 'Expand' : 'Collapse'} branch`)}><span>{childCount}</span>{isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>}
      </div>}
    </article>
  )
}
