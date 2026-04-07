import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { apiFetch, parseJson } from './client'

function supabaseEnvMissingMessage(): string {
  return (
    'This deployment is missing Supabase settings. In Vercel, add VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY to Environment Variables and redeploy (Vite bakes them in at build time).'
  )
}

export async function login(username: string, password: string, rememberMe = false): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: username.trim(),
      password,
    })
    if (error) throw new Error(error.message)
    if (rememberMe) {
      /* Supabase client persists session in localStorage by default */
    }
    return
  }
  const hasApiBase = Boolean(import.meta.env.VITE_API_BASE_URL?.trim())
  if (import.meta.env.PROD && !hasApiBase) {
    throw new Error(supabaseEnvMissingMessage())
  }
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, rememberMe }),
  })
  await parseJson<{ ok: boolean }>(res)
}

export async function logout(): Promise<void> {
  if (isSupabaseConfigured()) {
    await getSupabase().auth.signOut()
    return
  }
  const res = await apiFetch('/api/auth/logout', { method: 'POST' })
  if (!res.ok && res.status !== 401) await parseJson(res)
}

export async function getMe(): Promise<{ user: string } | null> {
  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await getSupabase().auth.getSession()
      const email = session?.user?.email
      if (email) return { user: email }
      return null
    } catch {
      return null
    }
  }
  try {
    const res = await apiFetch('/api/auth/me')
    if (res.status === 401) return null
    return await parseJson<{ user: string }>(res)
  } catch {
    return null
  }
}
