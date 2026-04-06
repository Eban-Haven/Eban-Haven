import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when Vite env is set (production: configure in Vercel Project → Environment Variables). */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey)
}

let _client: SupabaseClient | null = null

/** Browser Supabase client; only valid when {@link isSupabaseConfigured} is true. */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).',
    )
  }
  if (!_client) {
    _client = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  }
  return _client
}

// Example (with RLS policies in place): getSupabase().from('my_table').select('*')
