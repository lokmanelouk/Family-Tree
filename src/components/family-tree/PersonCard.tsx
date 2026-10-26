import { useRef, type DragEvent, type PointerEvent } from 'react'
import type { FamilyMember } from '../../types/family'
import type { CSSProperties } from 'react'
import type { TreeNodeMode } from '../../lib/tree-layout'
import { FamilyAvatar } from './FamilyAvatar'
import { useLanguage } from '../../i18n/useLanguage'
import { getMemberAge } from '../../lib/member-age'
import { isMemberDeceased } from '../../lib/member-status'

type PersonCardProps = {
  member: FamilyMember
  mode: TreeNodeMode
  nodeWidth: number
  nodeHeight: number
  branchColor: string | null
  isSelected: boolean
  isFocused: boolean
  isBranchFocusDimmed: boolean
  isSpotlighted: boolean
  isPulsing: boolean
  isDropTarget: boolean
  onHoverChange: (id: string | null) => void
  onSelect: (member: FamilyMember) => void
  onOpenContextMenu: (member: FamilyMember, x: number, y: number) => void
  onDragStart: (event: DragEvent<HTMLButtonElement>, member: FamilyMember) => void
  onDragEnd: () => void
  onDrop: (event: DragEvent<HTMLElement>, target: FamilyMember) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
}

export function PersonCard({ member, mode, nodeWidth, nodeHeight, branchColor, isSelected, isFocused, isBranchFocusDimmed, isSpotlighted, isPulsing, isDropTarget, onHoverChange, onSelect, onOpenContextMenu, onDragStart, onDragEnd, onDrop, onDragOver }: PersonCardProps) {
  const { t, language } = useLanguage()
  const longPressTimer = useRef<number | null>(null)
  const deceased = isMemberDeceased(member)
  const age = deceased ? null : getMemberAge(member.birthDate)
  const ageCategory = age ? new Intl.PluralRules(language).select(age.count) : null
  const ageMessage = age && ageCategory ? t(`Age ${age.unit} ${ageCategory}`, { count: '__AGE_COUNT__' }) : ''
  const [ageBefore = '', ageAfter = ''] = ageMessage.split('__AGE_COUNT__')
  const ageValue = age ? `${ageBefore}${age.count}${ageAfter}` : ''
  const birthYear = member.birthDate?.match(/^(\d{4})/)?.[1]
  const deathYear = member.deathDate?.match(/^(\d{4})/)?.[1]
  const lifeSpan = deceased && member.deathDate ? [birthYear, deathYear].filter(Boolean).join(' – ') : ''
  const deceasedTooltip = deathYear ? t('Died {year}', { year: deathYear }) : ''
  const bornLabel = birthYear ? t('Born {year}', { year: birthYear }) : ''
  const cardSubtitle = deceased ? lifeSpan || bornLabel || t('Deceased') : ageValue
  const cardStyle = {
    '--layout-node-width': `${nodeWidth}px`,
    '--layout-node-height': `${nodeHeight}px`,
    ...(branchColor !== null ? { '--branch-color': branchColor } : {}),
  } as CSSProperties
  return (
    <article className={`person-node ${deceased ? 'is-deceased' : ''} ${mode === 'circle' ? 'circle-node' : ''} ${member.spouseIds.length || member.formerSpouseIds?.length ? 'has-spouse' : ''} ${branchColor !== null ? 'branch-colored' : ''} ${isSelected ? 'is-selected' : ''} ${isFocused ? '' : 'is-dimmed'} ${isBranchFocusDimmed ? 'is-branch-focus-dimmed' : ''} ${isSpotlighted ? 'is-spotlighted' : ''} ${isPulsing ? 'is-search-pulse' : ''} ${isDropTarget ? 'drop-target' : ''}`} style={cardStyle} data-member-id={member.id} onPointerEnter={() => onHoverChange(member.id)} onPointerLeave={() => { onHoverChange(null); if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current) }} onPointerDown={(event: PointerEvent<HTMLElement>) => { if (event.pointerType !== 'touch') return; longPressTimer.current = window.setTimeout(() => onOpenContextMenu(member, event.clientX, event.clientY), 550) }} onPointerUp={() => { if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current) }} onContextMenu={(event) => { event.preventDefault(); onOpenContextMenu(member, event.clientX, event.clientY) }} onKeyDown={(event) => { if (event.shiftKey && event.key === 'F10') { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); onOpenContextMenu(member, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2) } }} onDragOver={onDragOver} onDrop={(event) => onDrop(event, member)}>
      <button className="member-main" dir="ltr" draggable onDragStart={(event) => onDragStart(event, member)} onDragEnd={onDragEnd} onClick={() => onSelect(member)} onPointerEnter={() => onHoverChange(member.id)} aria-pressed={isSelected} aria-label={`${member.name}${cardSubtitle ? `, ${cardSubtitle}` : ''}${deceasedTooltip ? `, ${deceasedTooltip}` : deceased ? `, ${t('Deceased')}` : ''}`} title={deceasedTooltip || (deceased ? t('Deceased') : undefined)}>
        <span className="node-avatar"><FamilyAvatar member={member} compact /></span>
        <span className="node-copy"><strong><bdi dir="auto">{member.name}</bdi></strong>{deceased && member.deathDate && lifeSpan && <small className="node-age node-lifespan"><bdi dir="ltr">{lifeSpan}</bdi></small>}{deceased && !member.deathDate && <small className="node-age node-deceased-label">{bornLabel && <><bdi dir="auto">{t('Born')}</bdi> <bdi dir="ltr">{birthYear}</bdi></>}<span>{t('Deceased')}</span></small>}{age && <small className="node-age" dir="auto"><bdi>{age.count}</bdi>{ageAfter}</small>}{member.gender && <small className={`node-gender ${member.gender}`}>{t(member.gender === 'male' ? 'Male' : 'Female')}</small>}</span>
      </button>
    </article>
  )
}
