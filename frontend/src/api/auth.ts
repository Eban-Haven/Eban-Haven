import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { apiFetch, parseJson } from './client'

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
