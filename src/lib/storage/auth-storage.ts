import { requireSupabase } from '../supabase/client.ts'

export function getCurrentSession() {
  return requireSupabase().auth.getSession()
}

export function onAuthChange(callback: (session: import('@supabase/supabase-js').Session | null) => void) {
  return requireSupabase().auth.onAuthStateChange((_event, session) => callback(session)).data.subscription
}

export function signInWithPassword(email: string, password: string) {
  return requireSupabase().auth.signInWithPassword({ email, password })
}

export function signUpWithPassword(email: string, password: string, emailRedirectTo?: string) {
  return requireSupabase().auth.signUp({ email, password, options: emailRedirectTo ? { emailRedirectTo } : undefined })
}

export function signInWithGoogle(redirectTo: string) {
  return requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  })
}

export function sendPasswordReset(email: string, redirectTo: string) {
  return requireSupabase().auth.resetPasswordForEmail(email, { redirectTo })
}

export function signOut() {
  return requireSupabase().auth.signOut()
}
