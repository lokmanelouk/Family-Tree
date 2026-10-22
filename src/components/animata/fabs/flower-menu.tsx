import { useCallback, useEffect, useId, useRef, useState, type ComponentType, type CSSProperties, type SVGProps } from 'react'
import { Share2 } from 'lucide-react'
import './flower-menu.css'

export type FlowerMenuItem = {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  href: string
  label: string
  disabled?: boolean
}

type FlowerMenuProps = {
  items: FlowerMenuItem[]
  label?: string
}

const orbitRadius = 88

export function FlowerMenu({ items, label = 'Open quick links' }: FlowerMenuProps) {
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
        return
      }
      const current = itemRefs.current.findIndex((item) => item === document.activeElement)
      const enabledIndexes = items.flatMap((item, index) => (item.disabled ?? item.href === '#') ? [] : [index])
      const currentEnabledIndex = enabledIndexes.indexOf(current)
      if (currentEnabledIndex < 0 || enabledIndexes.length === 0 || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabledIndexes.length - 1 : (currentEnabledIndex + (event.key === 'ArrowDown' ? 1 : -1) + enabledIndexes.length) % enabledIndexes.length
      itemRefs.current[enabledIndexes[next]]?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [close, items, open])

  return <div className="flower-menu-root" ref={rootRef} data-open={open}>
    <ul className="flower-menu-items" id={menuId} aria-label="Quick links" aria-hidden={!open}>
      {items.map((item, index) => {
        const Icon = item.icon
        const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2
        const position = { x: Math.cos(angle) * orbitRadius, y: Math.sin(angle) * orbitRadius }
        const disabled = item.disabled ?? item.href === '#'
        return <li key={item.label} style={{ '--petal-index': index, '--petal-x': `${position.x.toFixed(2)}px`, '--petal-y': `${position.y.toFixed(2)}px` } as CSSProperties}>
          <a
            ref={(element) => { itemRefs.current[index] = element }}
            className="flower-petal flower-menu-item"
            href={item.href}
            target={disabled ? undefined : '_blank'}
            rel={disabled ? undefined : 'noreferrer noopener'}
            aria-disabled={disabled || undefined}
            aria-label={item.label}
            title={item.label}
            tabIndex={open && !disabled ? 0 : -1}
            onClick={disabled ? (event) => event.preventDefault() : undefined}
          ><Icon width={17} height={17} aria-hidden="true" /></a>
        </li>
      })}
    </ul>
    <button
      ref={triggerRef}
      className="flower-menu-trigger"
      type="button"
      aria-label={open ? 'Close quick links' : label}
      aria-expanded={open}
      aria-controls={menuId}
      onClick={() => setOpen((value) => !value)}
    ><Share2 width={21} height={21} aria-hidden="true" /></button>
  </div>
}
