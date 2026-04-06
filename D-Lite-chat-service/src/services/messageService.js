import { isSupabaseConfigured, supabase } from '../config/supabase.js'

const TABLE_NAME = 'messages'

export const saveMessage = async ({ chatId, senderId, content, type = 'text' }) => {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Chat storage is not configured (missing SUPABASE_URL / SUPABASE key)')
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      chat_id: chatId,
      sender_id: senderId,
      content,
      type,
    })
    .select('id, chat_id, sender_id, content, type, created_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export const getMessagesByChatId = async (chatId) => {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Chat storage is not configured (missing SUPABASE_URL / SUPABASE key)')
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('id, chat_id, sender_id, content, type, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
