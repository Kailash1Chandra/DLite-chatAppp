import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and a Supabase key must be set')
}

// Use the service role key when available so the service can insert and read messages safely.
export const supabase = createClient(supabaseUrl, supabaseKey)
