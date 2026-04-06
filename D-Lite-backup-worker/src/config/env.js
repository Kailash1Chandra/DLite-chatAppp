import 'dotenv/config'

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'MONGODB_URI']
const missing = required.filter((key) => !process.env[key])

export const isWorkerConfigured = () => missing.length === 0

export const env = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  mongoUri: process.env.MONGODB_URI,
  mongoDbName: process.env.MONGODB_DB_NAME || 'd_lite_backup',
  mongoCollectionName: process.env.MONGODB_COLLECTION_NAME || 'message_backups',
  cronSchedule: process.env.BACKUP_CRON_SCHEDULE || '*/5 * * * *',
  batchSize: Number.parseInt(process.env.BACKUP_BATCH_SIZE || '500', 10),
  missingRequired: missing,
}

export default env
