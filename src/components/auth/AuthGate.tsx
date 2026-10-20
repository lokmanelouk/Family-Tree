import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BookOpen, LogIn, TreePine } from 'lucide-react'
import { DashboardPage } from '../../pages/DashboardPage'
import { familyMembers } from '../../data/family'
import { useLanguage } from '../../i18n/useLanguage'
import { isSupabaseConfigured } from '../../lib/supabase/client'
import { createTree, loadTree, saveTreeChanges, type TreeRecord } from '../../lib/storage/supabase-tree-storage'
import { getCurrentSession, onAuthChange, signInWithPassword, signOut, signUpWithPassword } from '../../lib/storage/auth-storage'
import { cloneMembersWithNewIds } from '../../lib/storage/tree-data'
import type { FamilyMember } from '../../types/family'

type Workspace = { tree: TreeRecord; members: FamilyMember[] }

export function AuthGate() {
  const { t } = useLanguage()
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [setupTree, setSetupTree] = useState<TreeRecord | null>(null)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [treeError, setTreeError] = useState('')
  const [treeLoadError, setTreeLoadError] = useState(false)
  const authUserId = useRef<string | null>(null)
  const loadingTree = Boolean(session?.user.id && loadedUserId !== session.user.id)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    getCurrentSession().then(({ data, error }) => {
      if (!active) return
      if (error) setTreeError(t('Could not check your sign-in status.'))
      authUserId.current = data.session?.user.id ?? null
      setSession(data.session)
      setAuthReady(true)
    }).catch(() => setAuthReady(true))
    const subscription = onAuthChange((nextSession) => {
      const nextUserId = nextSession?.user.id ?? null
      if (authUserId.current !== nextUserId) {
        authUserId.current = nextUserId
        setWorkspace(null)
        setSetupTree(null)
        setTreeError('')
        setTreeLoadError(false)
        setLoadedUserId(null)
      }
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [t])

  useEffect(() => {
    if (!session?.user.id) return
    let active = true
    loadTree().then((result) => {
      if (active) {
        if (result.tree && result.members.length === 0) {
          setSetupTree(result.tree)
          setWorkspace(null)
        } else {
          setWorkspace(result.tree ? { tree: result.tree, members: result.members } : null)
        }
        setTreeError('')
        setTreeLoadError(false)
        setLoadedUserId(session.user.id)
      }
    }).catch(() => {
      if (active) {
        setTreeLoadError(true)
        setLoadedUserId(session.user.id)
      }
    })
    return () => { active = false }
  }, [session?.user.id, t])

  if (!authReady) return <LoadingScreen />
  if (!isSupabaseConfigured) return <SetupNotice />
  if (!session) return <LoginScreen onSession={setSession} />
  if (loadingTree) return <LoadingScreen />
  if (treeLoadError) return <main className="auth-screen"><AuthLanguageToggle /><div className="auth-card"><h1>{t('Could not load your family tree.')}</h1><button className="primary-button" onClick={() => window.location.reload()}>{t('Try again')}</button></div></main>
  if (setupTree) return <TreeStarter tree={setupTree} onStart={(members) => { setWorkspace({ tree: setupTree, members }); setSetupTree(null) }} onCancel={() => { setSetupTree(null); void signOut() }} />
  if (!workspace) return <CreateTree error={treeError} onCreate={async (name) => {
    try {
      const tree = await createTree(name, session.user.id)
      setTreeError('')
      setSetupTree(tree)
    } catch {
      setTreeError(t('Could not create the family tree. Try again.'))
    }
  }} />
  return <DashboardPage key={workspace.tree.id} treeId={workspace.tree.id} initialMembers={workspace.members} userEmail={session.user.email ?? ''} onSignOut={() => void signOut()} />
}

function LoadingScreen() {
  const { t } = useLanguage()
  return <main className="auth-screen"><AuthLanguageToggle /><div className="auth-card"><span className="auth-brand-mark">k</span><p>{t('Loading your account…')}</p></div></main>
}

function SetupNotice() {
  const { t, language } = useLanguage()
  return <main className="auth-screen" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}><AuthLanguageToggle /><div className="auth-card"><span className="auth-brand-mark">k</span><h1>{t('Connect Kinfolk to Supabase')}</h1><p>{t('Add your Supabase project URL and public anon key to the local .env file, then restart the app.')}</p></div></main>
}

function AuthLanguageToggle() {
  const { language, setLanguage } = useLanguage()
  return <button className="auth-language-toggle" type="button" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>{language === 'en' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'English'}</button>
}

function LoginScreen({ onSession }: { onSession: (session: Session | null) => void }) {
  const { t, language } = useLanguage()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setNotice('')
    setError('')
    try {
      if (mode === 'signin') {
        const result = await signInWithPassword(email.trim(), password)
        if (result.error) throw result.error
        onSession(result.data.session)
      } else {
        const result = await signUpWithPassword(email.trim(), password)
        if (result.error) throw result.error
        if (result.data.session) onSession(result.data.session)
        else setNotice(t('Check your email'))
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.toLowerCase() : ''
      setError(message.includes('invalid login') || message.includes('invalid credentials')
        ? t('Email or password is incorrect.')
        : message.includes('already registered')
          ? t('An account with this email already exists.')
          : message.includes('password')
            ? t('Use a password with at least 6 characters.')
            : t('Could not complete sign in. Please try again.'))
    } finally {
      setBusy(false)
    }
  }
  return <main className="auth-screen" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}><AuthLanguageToggle />
    <section className="auth-card"><span className="auth-brand-mark">k</span><p className="auth-kicker">Kinfolk</p><h1>{t(mode === 'signin' ? 'Welcome back' : 'Create your account')}</h1><p className="auth-description">{t('Keep your family history together and private.')}</p>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <label>{t('Email')}<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} dir="auto" /></label>
        <label>{t('Password')}<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {notice && <p className="auth-notice" role="status">{notice}</p>}{error && <p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button auth-submit" type="submit" disabled={busy}>{mode === 'signin' ? <LogIn size={18} /> : <TreePine size={18} />}{t(busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up')}</button>
      </form>
      <button className="auth-mode-toggle" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice('') }}>{t(mode === 'signin' ? 'New to Kinfolk? Create an account' : 'Already have an account? Sign in')}</button>
    </section>
  </main>
}

function CreateTree({ onCreate, error }: { onCreate: (name: string) => Promise<void>; error: string }) {
  const { t, language } = useLanguage()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    await onCreate(name)
    setBusy(false)
  }
  return <main className="auth-screen" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}><AuthLanguageToggle /><section className="auth-card tree-create-card"><span className="auth-brand-mark"><TreePine size={23} /></span><h1>{t('Create your family tree')}</h1><p className="auth-description">{t('Give your private family space a name to get started.')}</p><form className="auth-form" onSubmit={(event) => void submit(event)}><label>{t('Tree name')}<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} dir="auto" /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{t(busy ? 'Please wait…' : 'Create tree')}</button></form></section></main>
}

function TreeStarter({ tree, onStart, onCancel }: { tree: TreeRecord; onStart: (members: FamilyMember[]) => void; onCancel: () => void }) {
  const { t, language } = useLanguage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [exampleMembers, setExampleMembers] = useState<FamilyMember[] | null>(null)
  async function tryExample() {
    setBusy(true)
    try {
      const members = exampleMembers ?? cloneMembersWithNewIds(familyMembers)
      setExampleMembers(members)
      await saveTreeChanges(tree.id, [], members)
      const loaded = await loadTree()
      onStart(loaded.members)
    } catch {
      setError(t('Could not load the example tree. Please try again.'))
    } finally {
      setBusy(false)
    }
  }
  return <main className="auth-screen" lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}><AuthLanguageToggle /><section className="auth-card tree-starter-card"><span className="auth-brand-mark"><BookOpen size={22} /></span><p className="auth-kicker">{tree.name}</p><h1>{t('Your family tree is ready')}</h1><p className="auth-description">{t('Start with a person from your family, or explore the app with a sample tree.')}</p>{error && <p className="auth-error" role="alert">{error}</p>}<button className="primary-button auth-submit" disabled={busy} onClick={() => onStart([])}><TreePine size={18} />{t('Add first person')}</button><button className="auth-secondary-action" disabled={busy} onClick={() => void tryExample()}>{t(busy ? 'Please wait…' : 'Try the example tree')}</button><button className="auth-mode-toggle" onClick={onCancel}>{t('Sign out')}</button></section></main>
}
