import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseKey)

// Use the service role key when available so the service can insert and read messages safely.
export const supabase = isSupabaseConfigured() ? createClient(supabaseUrl, supabaseKey) : null
