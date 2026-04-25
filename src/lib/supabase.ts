import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env'
  )
}

const noLock = async <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn()

const globalForSupabase = globalThis as unknown as {
  __supabaseClient?: SupabaseClient
}

export const supabase: SupabaseClient =
  globalForSupabase.__supabaseClient ??
  createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'gym-tracker-auth-token',
      lock: noLock,
    },
  })

if (import.meta.env.DEV) {
  globalForSupabase.__supabaseClient = supabase
}
