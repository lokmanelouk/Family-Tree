import { useState } from 'react'
import { ArrowLeft, LockKeyhole, Share2 } from 'lucide-react'
import { FamilyTreeCanvas } from '../components/family-tree/FamilyTreeCanvas'
import { parseTreeBackup } from '../lib/tree-backup'
import { useLanguage } from '../i18n/useLanguage'
import type { FamilyMember } from '../types/family'

function readSharedTree(): FamilyMember[] | null {
  try {
    const payload = new URLSearchParams(window.location.hash.slice(1)).get('shared')
    if (!payload || payload.length > 1_500_000) return null
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - payload.length % 4) % 4)
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return parseTreeBackup(JSON.parse(new TextDecoder().decode(bytes)))
  } catch { return null }
}

export function SharedTreePage() {
  const { t } = useLanguage()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [members] = useState<FamilyMember[] | null>(() => readSharedTree())
  const homeUrl = `${window.location.pathname}${window.location.search}`
  if (!members) return <main className="shared-tree-page"><section className="shared-tree-error"><Share2 size={23} /><h1>{t('This share link is invalid or has expired.')}</h1><p>{t('Ask the person who shared it to create a new read-only link.')}</p><a href={homeUrl}><ArrowLeft size={16} />{t('Open family tree app')}</a></section></main>
  return <main className="shared-tree-page" data-theme="light" dir={document.documentElement.dir}>
    <header className="shared-tree-header"><div className="shared-tree-title"><span className="shared-tree-lock"><LockKeyhole size={16} /></span><span><strong>{t('Shared family tree')}</strong><small>{t('Read-only snapshot · {count} people', { count: members.length })}</small></span></div><a href={homeUrl}><ArrowLeft size={15} />{t('Open family tree app')}</a></header>
    <section className="shared-tree-canvas"><FamilyTreeCanvas members={members} collapsedIds={new Set()} zoom={1} selectedId={selectedId} onSelect={(member) => setSelectedId((current) => current === member.id ? null : member.id)} onToggleBranch={() => {}} onAddRelative={() => {}} onProposeRelationship={() => {}} onEmptyAdd={() => {}} mode="rectangle" focusId={null} showBranchColors readOnly /></section>
  </main>
}
