import { getDb } from './db.js';
import { log, safeErr } from './log.js';

const COL = 'memory_messages';
const fallback = [];
const MAX_FALLBACK = 500;

function cleanText(text) {
  return String(text || '').replace(/(bot|telegram|cookmybots)[_ -]?(token|key)\s*[:=]\s*\S+/gi, '[redacted]').slice(0, 4000);
}

export async function addTurn({ mongoUri, platform, userId, chatId, role, text }) {
  const doc = { platform, userId: String(userId || ''), chatId: String(chatId || ''), role, text: cleanText(text), ts: new Date() };
  const db = await getDb(mongoUri);
  if (!db) {
    fallback.push(doc);
    while (fallback.length > MAX_FALLBACK) fallback.shift();
    return;
  }
  try {
    await db.collection(COL).insertOne(doc);
  } catch (err) {
    log.error('db write failed', { collection: COL, operation: 'insertOne', err: safeErr(err) });
  }
}

export async function getRecentTurns({ mongoUri, platform, userId, chatId, limit = 12 }) {
  const db = await getDb(mongoUri);
  const query = { platform, userId: String(userId || '') };
  if (chatId) query.chatId = String(chatId);
  if (!db) {
    return fallback.filter((m) => m.platform === query.platform && m.userId === query.userId && (!query.chatId || m.chatId === query.chatId)).slice(-limit).map((m) => ({ role: m.role, text: m.text }));
  }
  try {
    const rows = await db.collection(COL).find(query).sort({ ts: -1 }).limit(limit).toArray();
    return rows.reverse().map((r) => ({ role: r.role, text: r.text }));
  } catch (err) {
    log.error('db read failed', { collection: COL, operation: 'find', err: safeErr(err) });
    return [];
  }
}

export async function clearUserMemory({ mongoUri, platform, userId, chatId }) {
  const db = await getDb(mongoUri);
  const query = { platform, userId: String(userId || '') };
  if (chatId) query.chatId = String(chatId);
  if (!db) {
    for (let i = fallback.length - 1; i >= 0; i -= 1) {
      if (fallback[i].platform === query.platform && fallback[i].userId === query.userId && (!query.chatId || fallback[i].chatId === query.chatId)) fallback.splice(i, 1);
    }
    return;
  }
  try {
    await db.collection(COL).deleteMany(query);
  } catch (err) {
    log.error('db write failed', { collection: COL, operation: 'deleteMany', err: safeErr(err) });
  }
}