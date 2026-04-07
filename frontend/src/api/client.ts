import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

/** Base URL for the ASP.NET API (no trailing slash). Empty = same origin. */
export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
}

function resolveUrl(input: string): string {
  if (input.startsWith('http://') || input.startsWith('https://')) return input
  const base = apiBaseUrl()
  if (!base) return input
  return `${base}${input.startsWith('/') ? '' : '/'}${input}`
}

/** All API calls: cookies for legacy staff login; Bearer when Supabase session exists. */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await getSupabase().auth.getSession()
      if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
    } catch {
      /* Supabase not initialized */
    }
  }
  return fetch(resolveUrl(input), {
    ...init,
    credentials: 'include',
    headers,
  })
}

export async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!res.ok) {
    let message = text || res.statusText
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) message = j.error
    } catch {
      /* keep text */
    }
    throw new Error(message)
  }
  const trimmed = text.trimStart()
  if (trimmed.startsWith('<!') || trimmed.toLowerCase().startsWith('<html')) {
    throw new Error(
      'Received HTML instead of JSON — there is no /api backend on this host. Either set VITE_USE_SUPABASE_DATA=true ' +
        '(and redeploy) so admin data loads from Supabase, or deploy the .NET API and set VITE_API_BASE_URL to its URL.',
    )
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text.slice(0, 160) || 'Invalid JSON response')
  }
}
