import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set')
}

// The anon key is enough for normal client-style auth flows such as signup/login/getUser.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
