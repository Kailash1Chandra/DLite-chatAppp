import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey)

// The anon key is enough for normal client-style auth flows such as signup/login/getUser.
export const supabase = isSupabaseConfigured() ? createClient(supabaseUrl, supabaseAnonKey) : null
