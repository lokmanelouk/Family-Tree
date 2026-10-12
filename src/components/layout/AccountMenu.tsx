import { useEffect, useRef, useState } from 'react'
import { ChevronDown, CircleUserRound, Settings, Trees, X } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'

type AccountMenuProps = { collapsed: boolean; memberCount: number }
type AccountView = 'settings' | 'trees' | null

export function AccountMenu({ collapsed, memberCount }: AccountMenuProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<AccountView>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) { setOpen(false); setView(null) } }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setView(null) } }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('keydown', onKeyDown) }
  }, [])

  return <div className="account-menu" ref={rootRef}>
    <button type="button" className="account-trigger" onClick={() => { setOpen((value) => !value); setView(null) }} aria-expanded={open} aria-label={t('Local profile menu')} title={t('Local profile')}>
      <span className="account-avatar">K</span>{!collapsed && <><span className="account-trigger-copy"><strong>{t('Local profile')}</strong><small>{t('Not signed in')}</small></span><ChevronDown size={15} /></>}
    </button>
    {open && <div className="account-popover">
      {!view ? <>
        <div className="account-popover-heading"><span className="account-avatar">K</span><span><strong>{t('Local profile')}</strong><small>{t('This browser session')}</small></span></div>
        <button type="button" onClick={() => setView('settings')}><Settings size={15} />{t('Account settings')}</button>
        <button type="button" onClick={() => setView('trees')}><Trees size={15} />{t('My family trees')}</button>
        <button type="button" className="account-disabled" disabled title={t('Sign out is available after authentication is connected')}><CircleUserRound size={15} />{t('Sign out')}<small>{t('Unavailable')}</small></button>
      </> : <div className="account-info-view"><button className="account-info-close" type="button" onClick={() => setView(null)} aria-label={t('Back to account menu')}><X size={14} /></button>
        <strong>{view === 'settings' ? t('Account settings') : t('My family trees')}</strong>
        <p>{view === 'settings' ? t('Authentication is not connected. Your family data exists only in this open browser session; export a backup to keep a copy.') : t('This app currently has one open family tree with {count} people. Multiple cloud trees are not available yet.', { count: memberCount })}</p>
      </div>}
    </div>}
  </div>
}
