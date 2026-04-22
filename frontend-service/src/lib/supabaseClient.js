import { createClient } from '@supabase/supabase-js'

// Trim: host env UIs often add trailing newlines; avoids "Invalid API key" with invisible chars.
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/g, '') || undefined
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim() || undefined

export const isSupabaseConfigured = () => Boolean(url && anonKey)

export const supabase = isSupabaseConfigured()
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

