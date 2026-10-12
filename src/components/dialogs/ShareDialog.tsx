import { useState } from 'react'
import { Check, Copy, Link2, Mail, X } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { exportTree } from '../../lib/tree-backup'
import type { FamilyMember } from '../../types/family'

type ShareDialogProps = { members: FamilyMember[]; onClose: () => void }
type ShareTab = 'link' | 'invite'

function encodeShare(members: FamilyMember[]) {
  const bytes = new TextEncoder().encode(exportTree(members))
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export function ShareDialog({ members, onClose }: ShareDialogProps) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<ShareTab>('link')
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [error, setError] = useState('')

  function generateLink() {
    try {
      const url = new URL(window.location.href)
      url.hash = `shared=${encodeShare(members)}`
      if (url.href.length > 1_500_000) throw new Error(t('This tree is too large to share as a link. Export a backup instead.'))
      setShareUrl(url.href)
      setError('')
      setCopied(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Could not generate a share link.'))
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
    } catch {
      setError(t('Clipboard access failed. Select and copy the link manually.'))
    }
  }

  return <div className="modal-shade share-modal-shade" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <header className="share-dialog-header"><span className="share-dialog-icon"><Link2 size={20} /></span><div><h2 id="share-title">{t('Share your family tree')}</h2><p>{t('Choose how you want relatives to access this tree.')}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label={t('Close dialog')}><X size={18} /></button></header>
      <div className="share-tabs" role="tablist" aria-label={t('Sharing options')}>
        <button type="button" role="tab" aria-selected={tab === 'link'} className={tab === 'link' ? 'active' : ''} onClick={() => setTab('link')}><Link2 size={15} />{t('Link sharing')}</button>
        <button type="button" role="tab" aria-selected={tab === 'invite'} className={tab === 'invite' ? 'active' : ''} onClick={() => setTab('invite')}><Mail size={15} />{t('Invite family')}</button>
      </div>

      {tab === 'link' ? <div className="share-tab-content" role="tabpanel">
        <div className="share-notice"><strong>{t('Anyone with the link can view this tree.')}</strong><span>{t('The link contains a read-only snapshot of family details. Only create and share it with people you trust.')}</span></div>
        {!shareUrl ? <button className="primary-button share-generate" type="button" onClick={generateLink}><Link2 size={16} />{t('Generate read-only link')}</button> : <div className="share-link-row"><input aria-label={t('Read-only share link')} readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} /><button className="primary-button" type="button" onClick={() => void copyLink()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? t('Copied') : t('Copy link')}</button></div>}
        {shareUrl && <p className="share-link-hint">{t('This link contains the current tree snapshot. Changes made later will not appear in it.')}</p>}
        {error && <p className="share-error" role="alert">{error}</p>}
      </div> : <form className="share-tab-content invite-form" onSubmit={(event) => event.preventDefault()} role="tabpanel">
        <label>{t('Email address')}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="relative@example.com" autoComplete="email" /></label>
        <label>{t('Permission')}<select value={permission} onChange={(event) => setPermission(event.target.value as 'view' | 'edit')}><option value="view">{t('Can view')}</option><option value="edit">{t('Can edit')}</option></select></label>
        <div className="share-notice invite-unavailable"><strong>{t('Invitations need a connected account')}</strong><span>{t('Email invitations and view/edit permissions require authenticated cloud storage. No invite will be sent from this local-only app.')}</span></div>
        <button className="primary-button share-generate" type="button" disabled title={t('Cloud sharing is not configured')}><Mail size={16} />{t('Send invitation')}</button>
        <span className="visually-hidden">{permission === 'view' ? t('Can view') : t('Can edit')}{email ? `: ${email}` : ''}</span>
      </form>}
      <footer className="share-dialog-footer"><span>{members.length} {t('people')}</span><button className="secondary-button" type="button" onClick={onClose}>{t('Done')}</button></footer>
    </section>
  </div>
}
