import { ChevronDown, ChevronRight, GripVertical, Minus, Plus } from 'lucide-react'
import type { DragEvent } from 'react'
import type { FamilyMember, RelationshipKind } from '../../types/family'
import type { CSSProperties } from 'react'
import type { TreeNodeMode } from '../../lib/tree-layout'
import { FamilyAvatar } from './FamilyAvatar'
import { FamilyMemberSpeedDial } from './FamilyMemberSpeedDial'
import { useLanguage } from '../../i18n/useLanguage'
import { getMemberAge } from '../../lib/member-age'

type PersonCardProps = {
  member: FamilyMember
  mode: TreeNodeMode
  branchColor: string | null
  isSelected: boolean
  isFocused: boolean
  childCount: number
  isCollapsed: boolean
  hasParents: boolean
  areAncestorsCollapsed: boolean
  isDropTarget: boolean
  onHoverChange: (id: string | null) => void
  onSelect: (member: FamilyMember) => void
  onToggleBranch: (id: string) => void
  onToggleAncestors: (id: string) => void
  onAddRelative: (member: FamilyMember, kind: RelationshipKind) => void
  onDragStart: (event: DragEvent<HTMLButtonElement>, member: FamilyMember) => void
  onDragEnd: () => void
  onDrop: (event: DragEvent<HTMLElement>, target: FamilyMember) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
}

export function PersonCard({ member, mode, branchColor, isSelected, isFocused, childCount, isCollapsed, hasParents, areAncestorsCollapsed, isDropTarget, onHoverChange, onSelect, onToggleBranch, onToggleAncestors, onAddRelative, onDragStart, onDragEnd, onDrop, onDragOver }: PersonCardProps) {
  const { t, language } = useLanguage()
  const age = member.deathDate ? null : getMemberAge(member.birthDate)
  const ageCategory = age ? new Intl.PluralRules(language).select(age.count) : null
  const ageMessage = age && ageCategory ? t(`Age ${age.unit} ${ageCategory}`, { count: '__AGE_COUNT__' }) : ''
  const [ageBefore = '', ageAfter = ''] = ageMessage.split('__AGE_COUNT__')
  const ageValue = age ? `${ageBefore}${age.count}${ageAfter}` : ''
  const birthYear = member.birthDate?.match(/^(\d{4})/)?.[1]
  const deathYear = member.deathDate?.match(/^(\d{4})/)?.[1]
  const lifeSpan = member.deathDate ? [birthYear, deathYear].filter(Boolean).join(' – ') : ''
  const deceasedTooltip = deathYear ? t('Died {year}', { year: deathYear }) : ''
  const cardSubtitle = member.deathDate ? lifeSpan : ageValue
  const branchAction = t(isCollapsed ? 'Expand' : 'Collapse')
  const childLabel = childCount === 1 ? t('1 child') : t('{count} children', { count: childCount })
  const branchTooltip = t('{action} branch with {count} children', { action: branchAction, count: childCount })
  return (
    <article className={`person-node ${member.deathDate ? 'is-deceased' : ''} ${mode === 'circle' ? 'circle-node' : ''} ${member.spouseIds.length || member.formerSpouseIds?.length ? 'has-spouse' : ''} ${branchColor !== null ? 'branch-colored' : ''} ${isSelected ? 'is-selected' : ''} ${isFocused ? '' : 'is-dimmed'} ${isDropTarget ? 'drop-target' : ''}`} style={branchColor !== null ? { '--branch-color': branchColor } as CSSProperties : undefined} data-member-id={member.id} onPointerEnter={() => onHoverChange(member.id)} onPointerLeave={() => onHoverChange(null)} onDragOver={onDragOver} onDrop={(event) => onDrop(event, member)}>
      <button className="member-main" dir="auto" onClick={() => onSelect(member)} onPointerEnter={() => onHoverChange(member.id)} aria-pressed={isSelected} aria-label={`${member.name}${cardSubtitle ? `, ${cardSubtitle}` : ''}${deceasedTooltip ? `, ${deceasedTooltip}` : ''}`} title={deceasedTooltip || undefined}>
        <span className="node-avatar"><FamilyAvatar member={member} compact /></span>
        <span className="node-copy"><strong>{member.name}</strong>{member.deathDate && lifeSpan && <small className="node-age node-lifespan"><bdi dir="ltr">{lifeSpan}</bdi></small>}{age && <small className="node-age" dir="auto"><bdi>{age.count}</bdi>{ageAfter}</small>}{member.gender && <small className={`node-gender ${member.gender}`}>{t(member.gender === 'male' ? 'Male' : 'Female')}</small>}</span>
      </button>
      <div className="node-actions">
        <button className="node-action drag-handle" draggable onDragStart={(event) => onDragStart(event, member)} onDragEnd={onDragEnd} aria-label={t('Drag {name} to propose a relationship change', { name: member.name })} title={t('Drag to propose a relationship change')}><GripVertical size={15} /></button>
        <FamilyMemberSpeedDial member={member} onAddRelative={onAddRelative} />
        {childCount > 0 && <button className="node-action branch-toggle" onClick={() => onToggleBranch(member.id)} aria-label={t('{action} {name} branch, {count} children', { action: branchAction, name: member.name, count: childCount })} title={branchTooltip}><span dir="auto">{childLabel}</span>{isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}</button>}
        {hasParents && <button className="node-action ancestor-branch-toggle" onClick={() => onToggleAncestors(member.id)} aria-label={t(`${areAncestorsCollapsed ? 'Expand' : 'Collapse'} ancestors for {name}`, { name: member.name })} title={t(`${areAncestorsCollapsed ? 'Expand' : 'Collapse'} ancestors`)}>{areAncestorsCollapsed ? <Plus size={13} /> : <Minus size={13} />}</button>}
      </div>
    </article>
  )
}
