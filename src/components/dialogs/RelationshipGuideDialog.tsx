import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, RefObject } from 'react'
import { GitBranch, HeartHandshake, ShieldCheck, X } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { getAnchoredPopoverArrowSide, getAnchoredPopoverPosition } from '../../lib/anchored-popover-position'

type RelationshipGuideDialogProps = { anchorRef: RefObject<HTMLButtonElement | null>; popoverRef: RefObject<HTMLElement | null>; onClose: () => void }

export function RelationshipGuideDialog({ anchorRef, popoverRef, onClose }: RelationshipGuideDialogProps) {
  const { t, language } = useLanguage()
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 320, arrowOffset: 160, placement: 'bottom' as 'top' | 'bottom', ready: false })
  const [themeStyle, setThemeStyle] = useState<Record<string, string>>({})
  const [themeName, setThemeName] = useState('')
  const [pageDirection, setPageDirection] = useState<'ltr' | 'rtl'>('ltr')
  const [layoutMode, setLayoutMode] = useState('keep')

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useLayoutEffect(() => {
    const popover = popoverRef.current
    const anchor = anchorRef.current
    if (!popover || !anchor) return
    let frame = 0
    const updatePosition = () => {
      const popoverWidth = popover.offsetWidth
      const popoverHeight = popover.offsetHeight
      const anchorRect = anchor.getBoundingClientRect()
      const next = getAnchoredPopoverPosition(anchorRect, popoverWidth, popoverHeight, window.innerWidth, window.innerHeight)
      cancelAnimationFrame(frame)
      const app = document.querySelector('.tree-app')
      if (app) {
        const computed = getComputedStyle(app)
        const names = ['--surface', '--surface-raised', '--surface-hover', '--surface-popover', '--line', '--line-soft', '--line-control', '--text', '--muted', '--subtle', '--accent', '--focus', '--rel-parent', '--rel-partner', '--rel-adoption', '--rel-former', '--shadow-popover', '--radius-popover']
        const nextTheme = Object.fromEntries(names.map((name) => [name, computed.getPropertyValue(name).trim()]))
        setThemeStyle((current) => names.every((name) => current[name] === nextTheme[name]) ? current : nextTheme)
        setThemeName(app.getAttribute('data-theme') ?? '')
      }
      setPageDirection(document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr')
      setLayoutMode(document.documentElement.dataset.layoutDirection ?? 'keep')
      frame = requestAnimationFrame(() => setPosition({ left: next.left, top: next.top, width: next.width, arrowOffset: next.arrowOffset, placement: next.side, ready: true }))
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    const observer = new ResizeObserver(updatePosition)
    observer.observe(popover)
    observer.observe(anchor)
    const app = document.querySelector('.tree-app')
    const themeObserver = new MutationObserver(updatePosition)
    if (app) themeObserver.observe(app, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, language, popoverRef])

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const popoverStyle = { ...themeStyle, position: 'fixed', left: `${position.left}px`, top: `${position.top}px`, width: `${position.width}px`, visibility: position.ready ? 'visible' : 'hidden', '--guide-arrow-offset': `${position.arrowOffset}px` } as CSSProperties
  const arrowSide = getAnchoredPopoverArrowSide(position.placement)

  return createPortal(<section ref={popoverRef} id="relationship-guide-panel" className="relationship-guide-popover" data-theme={themeName} data-layout-direction={layoutMode} dir={pageDirection} data-arrow-side={arrowSide} style={popoverStyle} role="dialog" aria-modal="false" aria-labelledby={titleId}>
    <div className="relationship-guide-content">
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
    </div>
  </section>, document.body)
}
