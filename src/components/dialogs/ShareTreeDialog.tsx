import { useEffect, useState } from 'react'
import { Check, Copy, Link2, MessageCircle, Shield, Trash2, UserRound } from 'lucide-react'
import { useLanguage } from '../../i18n/useLanguage'
import { getLayoutDirection } from '../../config/layout'
import { listTreeInvites, listTreeMembers, removeTreeMember, revokeTreeInvite, updateTreeMemberRole, createTreeInvite, type ShareRole, type TreeInvite, type TreeMemberAccess } from '../../lib/storage/sharing-storage'

type ShareTreeDialogProps = { treeId: string; currentUserId: string; onClose: () => void }

export function ShareTreeDialog({ treeId, currentUserId, onClose }: ShareTreeDialogProps) {
  const { t, language } = useLanguage()
  const [role, setRole] = useState<ShareRole>('viewer')
  const [activeTab, setActiveTab] = useState<'invite' | 'members'>('invite')
  const [expiry, setExpiry] = useState(7)
  const [showExpiryOptions, setShowExpiryOptions] = useState(false)
  const [invites, setInvites] = useState<TreeInvite[]>([])
  const [members, setMembers] = useState<TreeMemberAccess[]>([])
  const [copiedKey, setCopiedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [today, setToday] = useState('')

  async function refresh() {
    const [nextInvites, nextMembers] = await Promise.all([listTreeInvites(treeId), listTreeMembers(treeId)])
    setToday(new Date().toISOString())
    setInvites(nextInvites)
    setMembers(nextMembers)
    return nextInvites
  }

  useEffect(() => {
    let active = true
    Promise.all([listTreeInvites(treeId), listTreeMembers(treeId)]).then(([nextInvites, nextMembers]) => {
      if (active) {
        setToday(new Date().toISOString())
        setInvites(nextInvites)
        setMembers(nextMembers)
      }
    }).catch(() => { if (active) setError(t('Could not load sharing settings.')) })
    return () => { active = false }
  }, [treeId, t])

  async function copyLink(link: string, key: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((current) => current === key ? '' : current), 1800)
    } catch {
      setError(t('Could not copy the link. Select and copy it instead.'))
    }
  }

  async function createLink(targetRole: ShareRole, reset = false) {
    setBusy(true)
    setError('')
    try {
      const roleInvites = invites.filter((invite) => invite.role === targetRole && !invite.revoked)
      const existing = roleInvites.find(isUsableInvite)
      if (existing && !reset) {
        await copyLink(inviteLink(existing), existing.id)
        return
      }
      for (const invite of roleInvites) await revokeTreeInvite(invite.id)
      const invite = await createTreeInvite(treeId, targetRole, expiry)
      await refresh()
      await copyLink(inviteLink(invite), invite.id)
    } catch {
      try {
        const latestInvites = await refresh()
        const existing = latestInvites.find((invite) => invite.role === targetRole && isUsableInvite(invite))
        if (existing) await copyLink(inviteLink(existing), existing.id)
        else setError(t('Could not create the invite link. Please try again.'))
      } catch {
        setError(t('Could not create the invite link. Please try again.'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function revoke(invite: TreeInvite) {
    setBusy(true)
    setError('')
    try {
      await revokeTreeInvite(invite.id)
      await refresh()
    } catch {
      setError(t('Could not revoke the invite link. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function changeMember(userId: string, nextRole: ShareRole | 'remove') {
    setBusy(true)
    setError('')
    try {
      if (nextRole === 'remove') await removeTreeMember(treeId, userId)
      else await updateTreeMemberRole(treeId, userId, nextRole)
      await refresh()
    } catch {
      setError(t('Could not update this family member. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  function inviteLink(invite: TreeInvite) {
    return `${window.location.origin}/?invite=${encodeURIComponent(invite.token)}`
  }

  function remainingDays(invite: TreeInvite) {
    const reference = today || invite.created_at
    return Math.max(1, Math.ceil((new Date(invite.expires_at).getTime() - new Date(reference).getTime()) / 86_400_000))
  }

  function expiryLabel(days: number) {
    return t(days === 1 ? 'Link expires in 1 day' : 'Link expires in {count} days', { count: days })
  }

  function isUsableInvite(invite: TreeInvite) {
    return !invite.revoked && invite.uses < invite.max_uses && new Date(invite.expires_at).getTime() > new Date(today || invite.created_at).getTime()
  }

  const activeInvites = invites.filter(isUsableInvite)
  const selectedInvite = activeInvites.find((invite) => invite.role === role)
  const roleInvites: ShareRole[] = ['viewer', 'editor']

  return <div className="modal-shade share-tree-shade" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="confirm-dialog share-tree-dialog" role="dialog" aria-modal="true" aria-labelledby="share-tree-title" lang={language} dir={getLayoutDirection(language)}>
    <header className="share-tree-header"><div><h2 id="share-tree-title">{t('Invite family')}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={t('Close details')}>×</button></header>
    <nav className="share-tree-tabs" role="tablist" aria-label={t('Share tabs')}>
      <button type="button" role="tab" id="share-tab-invite" aria-selected={activeTab === 'invite'} aria-controls="share-panel-invite" className={activeTab === 'invite' ? 'is-active' : ''} onClick={() => setActiveTab('invite')}>{t('Invite')}</button>
      <button type="button" role="tab" id="share-tab-members" aria-selected={activeTab === 'members'} aria-controls="share-panel-members" className={activeTab === 'members' ? 'is-active' : ''} onClick={() => setActiveTab('members')}>{t('Members')}</button>
    </nav>
    <div className="share-tree-content">
      {activeTab === 'invite' && <div id="share-panel-invite" role="tabpanel" aria-labelledby="share-tab-invite">
      <section className="share-tree-section share-create-section">
        <div className="share-role-options" role="group" aria-label={t('Choose permission')}>
          <button type="button" className={`share-role-card${role === 'viewer' ? ' is-selected' : ''}`} aria-pressed={role === 'viewer'} onClick={() => setRole('viewer')}><span className="share-role-icon"><UserRound size={19} /></span><span><strong>{t('Viewer')}</strong><small>{t('Viewer: can only look')}</small>{activeInvites.some((invite) => invite.role === 'viewer') && <em>{t('Link ready')}</em>}</span>{role === 'viewer' && <Check className="share-role-check" size={17} />}</button>
          <button type="button" className={`share-role-card${role === 'editor' ? ' is-selected' : ''}`} aria-pressed={role === 'editor'} onClick={() => setRole('editor')}><span className="share-role-icon"><Shield size={19} /></span><span><strong>{t('Editor')}</strong><small>{t('Editor: can add and edit')}</small>{activeInvites.some((invite) => invite.role === 'editor') && <em>{t('Link ready')}</em>}</span>{role === 'editor' && <Check className="share-role-check" size={17} />}</button>
        </div>
        <div className="share-expiry-control"><span>{expiryLabel(expiry)}</span><button type="button" className="share-more-options" aria-expanded={showExpiryOptions} onClick={() => setShowExpiryOptions((visible) => !visible)}>{t(showExpiryOptions ? 'Fewer options' : 'More options')}</button></div>
        {showExpiryOptions && <div className="share-expiry-options" role="group" aria-label={t('Link expires')}>
          {[1, 7, 30].map((days) => <button key={days} type="button" aria-pressed={expiry === days} className={expiry === days ? 'is-selected' : ''} onClick={() => setExpiry(days)}>{days === 1 ? t('1 day') : `${days} ${t('days')}`}</button>)}
        </div>}
        <button className="primary-button share-create-button" type="button" onClick={() => void createLink(role)} disabled={busy}><Link2 size={18} />{t(busy ? 'Creating link' : selectedInvite ? 'Copy link' : 'Create and copy link')}</button>
        {copiedKey && <p className="share-link-copied" role="status"><Check size={16} />{t('Link copied')}</p>}
      </section>
      <section className="share-tree-section">
        <h3>{t('Active invite links')}</h3>
        {activeInvites.length ? <div className="share-invite-list">{roleInvites.map((inviteRole) => {
          const invite = activeInvites.find((item) => item.role === inviteRole)
          if (!invite) return null
          return <div className="share-invite-row" key={invite.id}>
          <span className={`share-role-badge share-role-badge-${invite.role}`}>{t(invite.role === 'viewer' ? 'Viewer' : 'Editor')}</span>
          <span className="share-invite-expiry">{expiryLabel(remainingDays(invite))}{invite.uses > 0 && <small>{t('Used {count} times', { count: invite.uses })}</small>}</span>
          <button type="button" className="share-invite-action" disabled={busy} onClick={() => void copyLink(inviteLink(invite), invite.id)} aria-label={t('Copy link')} title={t('Copy link')}>{copiedKey === invite.id ? <Check size={17} /> : <Copy size={17} />}<span>{t(copiedKey === invite.id ? 'Copied' : 'Copy')}</span></button>
          <a className="share-invite-action" href={`https://wa.me/?text=${encodeURIComponent(inviteLink(invite))}`} target="_blank" rel="noreferrer" aria-label={t('Share on WhatsApp')}><MessageCircle size={17} /><span>{t('WhatsApp')}</span></a>
          <button type="button" className="share-revoke-button" disabled={busy} onClick={() => void createLink(invite.role, true)}>{t('Reset link')}</button>
          <button type="button" className="share-revoke-button" disabled={busy} onClick={() => void revoke(invite)}>{t('Revoke')}</button>
        </div>
        })}</div> : <p className="share-empty-note">{t('No active invite links.')}</p>}
      </section>
      </div>}
      {activeTab === 'members' && <section id="share-panel-members" className="share-tree-section share-members-section" role="tabpanel" aria-labelledby="share-tab-members">
        <h3>{t('Family members')} <span>{members.length}</span></h3>
        {!members.length && <p className="share-empty-note">{t('No family members yet.')}</p>}
        {members.map((member) => {
          const displayName = member.email ?? member.user_id
          const initials = displayName.slice(0, 1).toLocaleUpperCase()
          return <div className="share-member-row" key={member.user_id}><span className="share-member-icon" aria-hidden="true">{initials || <UserRound size={16} />}</span><span className="share-member-copy"><strong dir="auto">{displayName}</strong><small>{t(member.role === 'owner' ? 'Owner' : member.role === 'editor' ? 'Editor' : 'Viewer')}</small></span>{member.role !== 'owner' && member.user_id !== currentUserId && <div className="share-member-actions"><select aria-label={t('Change role for {email}', { email: displayName })} value={member.role} disabled={busy} onChange={(event) => void changeMember(member.user_id, event.target.value as ShareRole)}><option value="viewer">{t('Viewer')}</option><option value="editor">{t('Editor')}</option></select><button type="button" className="share-remove-button" title={t('Remove member')} aria-label={t('Remove member')} disabled={busy} onClick={() => void changeMember(member.user_id, 'remove')}><Trash2 size={15} /></button></div>}</div>
        })}
      </section>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
    <footer className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>{t('Done')}</button></footer>
  </section></div>
}
