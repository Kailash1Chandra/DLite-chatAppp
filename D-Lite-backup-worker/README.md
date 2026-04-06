# D-Lite Backup Worker

This service runs separately from the main apps and periodically backs up chat messages from Supabase PostgreSQL into MongoDB.

## What It Does

- Fetches messages from Supabase
- Stores them in MongoDB using a simple document shape
- Runs on a schedule using `node-cron`
- Logs each backup run
- Avoids blocking the main application because it runs as its own worker process

## Folder Structure

```text
src/
├── config/
│   └── env.js
├── services/
│   ├── backupService.js
│   ├── mongoService.js
│   └── supabaseService.js
├── utils/
│   └── logger.js
└── index.js
```

## MongoDB Backup Shape

Each MongoDB document is intentionally simple:

```json
{
  "messageId": "uuid",
  "chatId": "uuid",
  "senderId": "uuid",
  "content": "Hello",
  "type": "text",
  "createdAt": "2026-03-31T10:00:00.000Z",
  "backedUpAt": "2026-03-31T10:05:00.000Z"
}
```

## Environment Variables

Create a `.env` file inside `D-Lite-backup-worker`:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=d_lite_backup
MONGODB_COLLECTION_NAME=message_backups
BACKUP_CRON_SCHEDULE=*/5 * * * *
BACKUP_BATCH_SIZE=500
```

## How It Works

1. The worker starts in its own Node.js process.
2. It fetches messages from Supabase.
3. It upserts them into MongoDB by `messageId`.
4. It remembers the latest `created_at` it has synced during runtime.
5. `node-cron` triggers the same job again on the configured schedule.

## Run Locally

```bash
npm install
npm run dev
```

For production:

```bash
npm start
```

## Important Note

This worker is asynchronous and separate from the main services, so backup work does not slow down chat, auth, media, or call requests.
