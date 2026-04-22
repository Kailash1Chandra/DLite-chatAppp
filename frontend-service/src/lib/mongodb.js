import { MongoClient } from 'mongodb';

// Prefer server-only env vars; keep NEXT_PUBLIC_* for backward compatibility.
const uriRaw = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI;
const uri = uriRaw ? String(uriRaw).trim() : undefined;

const dbName = String(
  process.env.MONGODB_DB_NAME || process.env.NEXT_PUBLIC_MONGODB_DB_NAME || 'd_lite_backup',
).trim() || 'd_lite_backup';

let client;
let clientPromise; // may be reset on transient failures
let indexesPromise;

function _connect() {
  client = new MongoClient(uri);
  return client.connect();
}

function _getClientPromise() {
  if (!uri) return null;

  // In dev, reuse across HMR reloads.
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = _connect().catch((e) => {
        // Allow a later retry if e.g. DNS/boot ordering failed.
        global._mongoClientPromise = undefined;
        throw e;
      });
    }
    return global._mongoClientPromise;
  }

  if (!clientPromise) {
    clientPromise = _connect().catch((e) => {
      // Reset so the next request can retry.
      clientPromise = undefined;
      throw e;
    });
  }
  return clientPromise;
}

export function isMongoBackupConfigured() {
  return Boolean(uri);
}

export async function getMongoDb() {
  const p = _getClientPromise();
  if (!p) {
    throw new Error('MongoDB backup is not configured.');
  }
  const connectedClient = await p;
  return connectedClient.db(dbName);
}

export async function ensureMessageBackupIndexes() {
  if (!_getClientPromise()) return;
  if (!indexesPromise) {
    indexesPromise = (async () => {
      const db = await getMongoDb();
      const collection = db.collection('message_backups');

      // Fast upsert by backupKey + common history queries.
      await collection.createIndexes([
        { key: { backupKey: 1 }, unique: true, name: 'uniq_backupKey' },
        { key: { scope: 1, threadId: 1, sourceCreatedAt: -1 }, name: 'direct_history' },
        { key: { scope: 1, groupId: 1, sourceCreatedAt: -1 }, name: 'group_history' },
        { key: { status: 1, backupUpdatedAt: -1 }, name: 'status_updated' },
      ]);
    })().catch((e) => {
      indexesPromise = undefined;
      console.warn('[mongodb] ensureMessageBackupIndexes failed', e?.message || e);
    });
  }
  return indexesPromise;
}
