import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Archive, BookOpen, Pencil, Plus, Trash2, TreePine, X } from 'lucide-react'
import { DashboardPage } from '../../pages/DashboardPage'
import { familyMembers } from '../../data/family'
import { useLanguage } from '../../i18n/useLanguage'
import { cloneMembersWithNewIds } from '../../lib/clone-family-members'
import { createTree, deleteTree, getLocalStorageErrorKey, listTrees, loadTree, renameTree, saveTreeChanges, type TreeRecord, type TreeSettings } from '../../lib/storage/local-tree-storage'
import { getLayoutDirection } from '../../config/layout'
import type { FamilyMember } from '../../types/family'
import { FAMILY_NETWORK_LOADER_CYCLE_MS, FamilyNetworkLoader } from '../auth/FamilyNetworkLoader'
import { TreeArchiveImportDialog } from './TreeArchiveImportDialog'
import { createTreeArchive, getTreeArchiveFilename, type ParsedTreeArchive } from '../../lib/tree-archive'
import { importTreeData, loadTreePhotos, recordTreeBackup } from '../../lib/storage/local-tree-storage'

type Workspace = { tree: TreeRecord; members: FamilyMember[]; settings: TreeSettings }
type WelcomeIntroMode = 'first-visit' | 'preview' | null

const WELCOME_INTRO_STORAGE_KEY = 'rootly-welcome-intro-shown'
const ACTIVE_TREE_STORAGE_KEY = 'rootly-active-local-tree'
const WELCOME_PREVIEW_DURATION_MS = 5_000
const LOADING_SCREEN_SHOW_DELAY_MS = 180
const LOADING_SCREEN_EXIT_MS = 260

function getWelcomeIntroMode(): WelcomeIntroMode {
  if (typeof window === 'undefined') return null
  try {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('previewWelcome') === '1') return 'preview'
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
    return window.localStorage.getItem(WELCOME_INTRO_STORAGE_KEY) === 'true' ? null : 'first-visit'
  } catch {
    return null
  }
}

function setActiveTreeId(treeId: string) {
  try {
    localStorage.setItem(ACTIVE_TREE_STORAGE_KEY, treeId)
  } catch {
    return
  }
}

function getActiveTreeId() {
  try {
    return localStorage.getItem(ACTIVE_TREE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function LocalTreeGate() {
  const { t } = useLanguage()
  const [trees, setTrees] = useState<TreeRecord[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [starterTree, setStarterTree] = useState<TreeRecord | null>(null)
  const [openAddAfterStart, setOpenAddAfterStart] = useState(false)
  const [loading, setLoading] = useState(true)
  const [storageError, setStorageError] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [welcomeIntroMode, setWelcomeIntroMode] = useState<WelcomeIntroMode>(getWelcomeIntroMode)
  const [loadingScreenVisible, setLoadingScreenVisible] = useState(false)
  const [keepLoadingScreenVisible, setKeepLoadingScreenVisible] = useState(false)
  const [loadingScreenExiting, setLoadingScreenExiting] = useState(false)
  const isLoadingScreenActive = welcomeIntroMode !== null || (loading && loadingScreenVisible)

  const refreshLocalTrees = useCallback(async () => {
    setLoading(true)
    setStorageError('')
    try {
      const availableTrees = await listTrees()
      setTrees(availableTrees)
      if (!availableTrees.length) {
        setWorkspace(null)
        setStarterTree(null)
        return
      }
      const activeTreeId = getActiveTreeId()
      const selectedTree = availableTrees.find((tree) => tree.id === activeTreeId) ?? availableTrees[0]
      const result = await loadTree(selectedTree.id)
      if (!result.tree) throw new Error('LOCAL_TREE_NOT_FOUND')
      setActiveTreeId(selectedTree.id)
      setWorkspace({ tree: result.tree, members: result.members, settings: result.settings })
    } catch (error) {
      setStorageError(getLocalStorageErrorKey(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshLocalTrees(), 0)
    return () => window.clearTimeout(timer)
  }, [refreshLocalTrees])

  useEffect(() => {
    if (!welcomeIntroMode) return
    if (welcomeIntroMode === 'first-visit') {
      try {
        window.localStorage.setItem(WELCOME_INTRO_STORAGE_KEY, 'true')
      } catch {
        const timer = window.setTimeout(() => setWelcomeIntroMode(null), 0)
        return () => window.clearTimeout(timer)
      }
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = welcomeIntroMode === 'preview' ? WELCOME_PREVIEW_DURATION_MS : reducedMotion ? 0 : FAMILY_NETWORK_LOADER_CYCLE_MS
    const timer = window.setTimeout(() => setWelcomeIntroMode(null), duration)
    return () => window.clearTimeout(timer)
  }, [welcomeIntroMode])

  useEffect(() => {
    if (!loading) return
    const timer = window.setTimeout(() => setLoadingScreenVisible(true), LOADING_SCREEN_SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    if (loading || !loadingScreenVisible) return
    const timer = window.setTimeout(() => setLoadingScreenVisible(false), 0)
    return () => window.clearTimeout(timer)
  }, [loading, loadingScreenVisible])

  useEffect(() => {
    if (isLoadingScreenActive) {
      const frame = window.requestAnimationFrame(() => {
        setKeepLoadingScreenVisible(true)
        setLoadingScreenExiting(false)
      })
      return () => window.cancelAnimationFrame(frame)
    }
    if (!keepLoadingScreenVisible) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frame = reducedMotion ? null : window.requestAnimationFrame(() => setLoadingScreenExiting(true))
    const timer = window.setTimeout(() => {
      setKeepLoadingScreenVisible(false)
      setLoadingScreenExiting(false)
      setLoadingScreenVisible(false)
    }, reducedMotion ? 0 : LOADING_SCREEN_EXIT_MS)
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [isLoadingScreenActive, keepLoadingScreenVisible])

  async function selectTree(treeId: string) {
    setOpenAddAfterStart(false)
    setStorageError('')
    try {
      const result = await loadTree(treeId)
      if (!result.tree) throw new Error('LOCAL_TREE_NOT_FOUND')
      setActiveTreeId(treeId)
      setWorkspace({ tree: result.tree, members: result.members, settings: result.settings })
      setStarterTree(null)
    } catch (error) {
      setStorageError(getLocalStorageErrorKey(error))
    }
  }

  async function createLocalTree(name: string) {
    const tree = await createTree(name)
    const updatedTrees = await listTrees()
    setTrees(updatedTrees)
    setActiveTreeId(tree.id)
    setOpenAddAfterStart(false)
    setWorkspace(null)
    setStarterTree(tree)
    setManagerOpen(false)
  }

  async function startWithMembers(members: FamilyMember[], openAdd = false) {
    if (!starterTree) return
    try {
      if (members.length) await saveTreeChanges(starterTree.id, [], members)
      const result = await loadTree(starterTree.id)
      setWorkspace({ tree: result.tree ?? starterTree, members: result.members, settings: result.settings })
      setOpenAddAfterStart(openAdd)
      setStarterTree(null)
      setActiveTreeId(starterTree.id)
    } catch (error) {
      setStorageError(getLocalStorageErrorKey(error))
    }
  }

  async function handleRenameTree(treeId: string, name: string) {
    const updated = await renameTree(treeId, name)
    setTrees((current) => current.map((tree) => tree.id === treeId ? updated : tree))
    setWorkspace((current) => current?.tree.id === treeId ? { ...current, tree: updated } : current)
    setStarterTree((current) => current?.id === treeId ? updated : current)
  }

  async function handleDeleteTree(treeId: string) {
    await deleteTree(treeId)
    const updatedTrees = await listTrees()
    setTrees(updatedTrees)
    if (workspace?.tree.id === treeId) {
      setWorkspace(null)
      if (updatedTrees.length) await selectTree(updatedTrees[0].id)
    }
    if (starterTree?.id === treeId) {
      setStarterTree(null)
      if (updatedTrees.length) await selectTree(updatedTrees[0].id)
    }
  }

  async function exportLocalTree(treeId: string) {
    const result = await loadTree(treeId)
    if (!result.tree) throw new Error('LOCAL_TREE_NOT_FOUND')
    const photos = await loadTreePhotos(treeId)
    const archive = await createTreeArchive({ tree: result.tree, members: result.members, settings: result.settings, photos })
    const download = new Blob([archive.slice().buffer as ArrayBuffer], { type: 'application/zip' })
    const url = URL.createObjectURL(download)
    const link = document.createElement('a')
    link.href = url
    link.download = getTreeArchiveFilename(result.tree.name)
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    const updated = await recordTreeBackup(treeId)
    const updatedTrees = await listTrees()
    setTrees(updatedTrees)
    setWorkspace((current) => current?.tree.id === treeId ? { ...current, tree: updated } : current)
    setStarterTree((current) => current?.id === treeId ? updated : current)
  }

  async function finishImport(archive: ParsedTreeArchive, mode: 'new' | 'replace') {
    const currentTree = workspace?.tree ?? starterTree
    const destination = mode === 'replace' && currentTree ? { kind: 'replace' as const, treeId: currentTree.id } : { kind: 'new' as const }
    const imported = await importTreeData({
      treeName: archive.treeName,
      members: archive.members,
      settings: archive.settings,
      photos: archive.photos,
      exportDate: archive.exportDate,
    }, destination)
    const result = await loadTree(imported.id)
    const updatedTrees = await listTrees()
    setTrees(updatedTrees)
    setActiveTreeId(imported.id)
    setWorkspace({ tree: result.tree ?? imported, members: result.members, settings: result.settings })
    setStarterTree(null)
    setOpenAddAfterStart(false)
    setManagerOpen(false)
    setArchiveDialogOpen(false)
    setStorageError('')
  }

  if (isLoadingScreenActive || keepLoadingScreenVisible) return <LoadingScreen isVisible={keepLoadingScreenVisible} isExiting={loadingScreenExiting} />
  if (loading && !storageError) return <main className="auth-screen auth-loading-screen auth-loading-placeholder" aria-busy="true" />
  if (storageError && !workspace && !starterTree) return <StorageErrorScreen message={t(storageError)} onRetry={() => void refreshLocalTrees()} />
  if (starterTree) return <>
    <TreeStarter tree={starterTree} error={storageError ? t(storageError) : ''} onStart={startWithMembers} onManageTrees={() => setManagerOpen(true)} />
    {managerOpen && <LocalTreeManagerDialog trees={trees} activeTreeId={starterTree.id} onClose={() => setManagerOpen(false)} onCreate={createLocalTree} onRename={handleRenameTree} onDelete={handleDeleteTree} onSwitch={selectTree} onExport={exportLocalTree} onImport={() => setArchiveDialogOpen(true)} />}
    {archiveDialogOpen && <TreeArchiveImportDialog currentTree={starterTree} onClose={() => setArchiveDialogOpen(false)} onImport={finishImport} />}
  </>
  if (!workspace) return <>
    <CreateTree error={storageError ? t(storageError) : ''} onCreate={(name) => createLocalTree(name).catch((error) => setStorageError(getLocalStorageErrorKey(error)))} onImport={() => setArchiveDialogOpen(true)} />
    {archiveDialogOpen && <TreeArchiveImportDialog currentTree={null} onClose={() => setArchiveDialogOpen(false)} onImport={finishImport} />}
  </>

  return <>
    <DashboardPage
      key={workspace.tree.id}
      treeId={workspace.tree.id}
      treeName={workspace.tree.name}
      treeCreatedAt={workspace.tree.createdAt}
      treeUpdatedAt={workspace.tree.updatedAt}
      lastBackupAt={workspace.tree.lastBackupAt}
      initialMembers={workspace.members}
      initialSettings={workspace.settings}
      openAddPersonOnStart={openAddAfterStart}
      trees={trees}
      onSwitchTree={(treeId) => void selectTree(treeId)}
      onManageTrees={() => setManagerOpen(true)}
      onExportTreeArchive={() => exportLocalTree(workspace.tree.id)}
      onOpenTreeImport={() => setArchiveDialogOpen(true)}
    />
    {managerOpen && <LocalTreeManagerDialog
      trees={trees}
      activeTreeId={workspace.tree.id}
      onClose={() => setManagerOpen(false)}
      onCreate={createLocalTree}
      onRename={handleRenameTree}
      onDelete={handleDeleteTree}
      onSwitch={selectTree}
      onExport={exportLocalTree}
      onImport={() => setArchiveDialogOpen(true)}
    />}
    {archiveDialogOpen && <TreeArchiveImportDialog currentTree={workspace.tree} onClose={() => setArchiveDialogOpen(false)} onImport={finishImport} />}
  </>
}

function LoadingScreen({ isVisible, isExiting }: { isVisible: boolean; isExiting: boolean }) {
  const { t, language } = useLanguage()
  return <main className={`auth-screen auth-loading-screen${isVisible ? ' is-visible' : ''}${isExiting ? ' is-exiting' : ''}`} lang={language} dir={getLayoutDirection(language)}>
    <FamilyNetworkLoader label={t('Loading')} />
  </main>
}

function StorageErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t, language } = useLanguage()
  return <main className="auth-screen" lang={language} dir={getLayoutDirection(language)}><section className="auth-card"><span className="auth-brand-mark"><TreePine size={23} /></span><h1>{t('Local storage unavailable')}</h1><p className="auth-error" role="alert">{message}</p><button className="primary-button auth-submit" onClick={onRetry}>{t('Try again')}</button></section></main>
}

function CreateTree({ onCreate, onImport, error }: { onCreate: (name: string) => Promise<void>; onImport: () => void; error: string }) {
  const { t, language } = useLanguage()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    await onCreate(name)
    setBusy(false)
  }
  return <main className="auth-screen" lang={language} dir={getLayoutDirection(language)}><section className="auth-card tree-create-card"><span className="auth-brand-mark"><TreePine size={23} /></span><h1>{t('Create your family tree')}</h1><p className="auth-description">{t('Give your private family space a name to get started.')}</p><form className="auth-form" onSubmit={(event) => void submit(event)}><label>{t('Tree name')}<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} dir="auto" /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={busy}><Plus size={18} />{t(busy ? 'Please wait\u2026' : 'Create tree')}</button></form><button className="auth-secondary-action" type="button" onClick={onImport}><Archive size={15} />{t('Import tree')}</button></section></main>
}

function TreeStarter({ tree, error, onStart, onManageTrees }: { tree: TreeRecord; error: string; onStart: (members: FamilyMember[], openAdd?: boolean) => Promise<void>; onManageTrees: () => void }) {
  const { t, language } = useLanguage()
  const [busy, setBusy] = useState(false)
  async function addFirstPerson() {
    setBusy(true)
    await onStart([], true)
    setBusy(false)
  }
  async function tryExample() {
    setBusy(true)
    await onStart(cloneMembersWithNewIds(familyMembers))
    setBusy(false)
  }
  return <main className="auth-screen" lang={language} dir={getLayoutDirection(language)}><section className="auth-card tree-starter-card"><span className="auth-brand-mark"><BookOpen size={22} /></span><p className="auth-kicker">{tree.name}</p><h1>{t('Your family tree is ready')}</h1><p className="auth-description">{t('Start with a person from your family, or explore the app with a sample tree.')}</p>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={busy} onClick={() => void addFirstPerson()}><TreePine size={18} />{t('Add first person')}</button><button className="auth-secondary-action" disabled={busy} onClick={() => void tryExample()}>{t(busy ? 'Please wait\u2026' : 'Try the example tree')}</button><button className="auth-mode-toggle" type="button" onClick={onManageTrees}>{t('Manage trees')}</button></section></main>
}

type LocalTreeManagerDialogProps = {
  trees: TreeRecord[]
  activeTreeId: string
  onClose: () => void
  onCreate: (name: string) => Promise<void>
  onRename: (treeId: string, name: string) => Promise<void>
  onDelete: (treeId: string) => Promise<void>
  onSwitch: (treeId: string) => Promise<void>
  onExport: (treeId: string) => Promise<void>
  onImport: () => void
}

function LocalTreeManagerDialog({ trees, activeTreeId, onClose, onCreate, onRename, onDelete, onSwitch, onExport, onImport }: LocalTreeManagerDialogProps) {
  const { t, language } = useLanguage()
  const [newName, setNewName] = useState('')
  const [renameId, setRenameId] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [deleteTree, setDeleteTree] = useState<TreeRecord | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (cause) {
      setError(t(cause instanceof Error ? cause.message : getLocalStorageErrorKey(cause)))
    } finally {
      setBusy(false)
    }
  }

  return <div className="modal-shade local-tree-manager-shade"><section className="confirm-dialog local-tree-manager-dialog" role="dialog" aria-modal="true" aria-labelledby="local-tree-manager-title">
    <button type="button" className="dialog-close" aria-label={t('Close')} onClick={onClose}><X size={17} /></button>
    <span className="confirm-mark"><TreePine size={19} /></span>
    <h2 id="local-tree-manager-title">{t('Manage trees')}</h2>
    <p>{t('Your trees are saved on this device.')}</p>
    <form className="local-tree-create-row" onSubmit={(event) => { event.preventDefault(); if (newName.trim()) void run(() => onCreate(newName).then(() => setNewName(''))) }}>
      <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={t('New tree name')} aria-label={t('New tree name')} dir="auto" maxLength={120} />
      <button type="submit" className="primary-button" disabled={!newName.trim() || busy}><Plus size={16} />{t('Create')}</button>
      <button type="button" className="secondary-button" disabled={busy} onClick={onImport}><Archive size={15} />{t('Import tree')}</button>
    </form>
    <div className="local-tree-list">
      {trees.map((tree) => <article className="local-tree-row" key={tree.id}>
        <div className="local-tree-row-heading"><strong dir="auto">{tree.name}</strong>{tree.id === activeTreeId && <small>{t('Current')}</small>}</div>
        <p className="local-tree-backup-date">{t('Last backup')}: <bdi>{tree.lastBackupAt ? new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(new Date(tree.lastBackupAt)) : t('Never')}</bdi></p>
        {renameId === tree.id ? <form className="local-tree-rename-row" onSubmit={(event) => { event.preventDefault(); void run(() => onRename(tree.id, renameValue).then(() => setRenameId(''))) }}>
          <input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} aria-label={t('Tree name')} dir="auto" maxLength={120} />
          <button className="secondary-button" type="button" onClick={() => setRenameId('')}>{t('Cancel')}</button>
          <button className="primary-button" type="submit" disabled={!renameValue.trim() || busy}>{t('Save')}</button>
        </form> : deleteTree?.id === tree.id ? <div className="local-tree-delete-confirm">
          <label>{t('Type the tree name to confirm')}<input autoFocus value={confirmName} onChange={(event) => setConfirmName(event.target.value)} dir="auto" /></label>
          <div className="dialog-actions"><button type="button" className="secondary-button" onClick={() => { setDeleteTree(null); setConfirmName('') }}>{t('Cancel')}</button><button type="button" className="primary-button danger-button" disabled={confirmName !== tree.name || busy} onClick={() => void run(() => onDelete(tree.id).then(() => { setDeleteTree(null); setConfirmName('') }))}>{t('Delete tree')}</button></div>
        </div> : <div className="local-tree-row-actions">
          {tree.id !== activeTreeId && <button className="secondary-button" type="button" onClick={() => void run(() => onSwitch(tree.id).then(onClose))}>{t('Switch')}</button>}
          <button className="secondary-button" type="button" onClick={() => void run(() => onExport(tree.id))}><Archive size={14} />{t('Export tree')}</button>
          <button className="secondary-button" type="button" title={t('Rename tree')} aria-label={t('Rename tree')} onClick={() => { setRenameId(tree.id); setRenameValue(tree.name) }}><Pencil size={15} />{t('Rename')}</button>
          <button className="local-tree-delete-button" type="button" title={t('Delete tree')} aria-label={t('Delete tree')} onClick={() => { setDeleteTree(tree); setConfirmName('') }}><Trash2 size={15} />{t('Delete')}</button>
        </div>}
      </article>)}
    </div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>{t('Done')}</button></div>
  </section></div>
}
