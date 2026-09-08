import { MongoClient } from 'mongodb';
import { log, safeErr } from './log.js';

let client = null;
let db = null;
let warnedMissingMongo = false;

export async function getDb(mongoUri) {
  if (!mongoUri) {
    if (!warnedMissingMongo) {
      warnedMissingMongo = true;
      log.warn('db not configured; using in-memory fallback', { 'MONGODB_URI set': false });
    }
    return null;
  }
  if (db) return db;
  try {
    client = new MongoClient(mongoUri, { maxPoolSize: 5, ignoreUndefined: true });
    await client.connect();
    db = client.db();
    log.info('db connected', { 'MONGODB_URI set': true });
    await ensureIndexes(db);
    return db;
  } catch (err) {
    log.error('db connect failed', { collection: 'system', operation: 'connect', err: safeErr(err) });
    return null;
  }
}

async function ensureIndexes(database) {
  const indexes = [
    ['users', { telegramId: 1 }, { unique: true }],
    ['warnings', { userId: 1, chatId: 1, active: 1 }, {}],
    ['moderationActions', { chatId: 1, createdAt: -1 }, {}],
    ['tickets', { ticketId: 1 }, { unique: true }],
    ['reports', { reportId: 1 }, { unique: true }],
    ['weatherCache', { provider: 1, locationKey: 1, dataType: 1 }, {}],
    ['publications', { idempotencyKey: 1 }, { unique: true }],
    ['memory_messages', { platform: 1, userId: 1, chatId: 1, ts: -1 }, {}]
  ];
  for (const [collection, key, options] of indexes) {
    try {
      await database.collection(collection).createIndex(key, options);
    } catch (err) {
      log.error('db index failed', { collection, operation: 'createIndex', err: safeErr(err) });
    }
  }
}

export async function closeDb() {
  if (client) await client.close();
  client = null;
  db = null;
}
