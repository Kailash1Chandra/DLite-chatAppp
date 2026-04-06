import { createClient } from '@supabase/supabase-js'
import env from '../config/env.js'

const supabase = createClient(env.supabaseUrl, env.supabaseKey)

export const fetchMessages = async (lastSyncedAt) => {
  let query = supabase
    .from('messages')
    .select('id, chat_id, sender_id, content, type, created_at')
    .order('created_at', { ascending: true })
    .limit(env.batchSize)

  if (lastSyncedAt) {
    query = query.gt('created_at', lastSyncedAt)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  return data
}
