import { fetchMessages } from './supabaseService.js'
import { getBackupCollection } from './mongoService.js'
import { logger } from '../utils/logger.js'

let isRunning = false
let lastSyncedAt = null

const toBackupDocument = (message) => ({
  messageId: message.id,
  chatId: message.chat_id,
  senderId: message.sender_id,
  content: message.content,
  type: message.type,
  createdAt: new Date(message.created_at),
  backedUpAt: new Date(),
})

export const runBackupJob = async () => {
  if (isRunning) {
    logger.info('Backup job skipped because a previous run is still in progress')
    return
  }

  isRunning = true

  try {
    logger.info('Backup job started', { lastSyncedAt })

    const messages = await fetchMessages(lastSyncedAt)

    if (messages.length === 0) {
      logger.info('No new messages found for backup')
      return
    }

    const collection = await getBackupCollection()

    const operations = messages.map((message) => ({
      updateOne: {
        filter: { messageId: message.id },
        update: {
          $set: toBackupDocument(message),
        },
        upsert: true,
      },
    }))

    const result = await collection.bulkWrite(operations, { ordered: false })

    lastSyncedAt = messages[messages.length - 1].created_at

    logger.info('Backup job finished', {
      fetched: messages.length,
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
      lastSyncedAt,
    })
  } catch (error) {
    logger.error('Backup job failed', { error: error.message })
  } finally {
    isRunning = false
  }
}
