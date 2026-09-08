import { randomUUID } from 'node:crypto';
import { cfg } from '../lib/config.js';
import { getDb } from '../lib/db.js';
import { log, safeErr } from '../lib/log.js';

const mem = {
  users: new Map(),
  reports: [],
  tickets: [],
  warnings: [],
  moderationActions: [],
  locks: new Map(),
  publications: new Set()
};

function mutableCopy(fields = {}) {
  const mutable = { ...fields };
  delete mutable._id;
  delete mutable.createdAt;
  return mutable;
}

export async function rememberUser(ctx) {
  const from = ctx.from;
  if (!from) return;
  const now = new Date();
  const doc = {
    telegramId: String(from.id),
    username: from.username || '',
    firstName: from.first_name || '',
    language: from.language_code || 'uk',
    lastSeenAt: now
  };
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) {
    mem.users.set(doc.telegramId, { ...(mem.users.get(doc.telegramId) || {}), ...doc });
    return;
  }
  try {
    await db.collection('users').updateOne(
      { telegramId: doc.telegramId },
      {
        $setOnInsert: { createdAt: now, selectedCity: cfg.DEFAULT_CITY, selectedRegion: 'Київ' },
        $set: { username: doc.username, firstName: doc.firstName, language: doc.language, lastSeenAt: doc.lastSeenAt, updatedAt: now }
      },
      { upsert: true }
    );
  } catch (err) {
    log.error('db write failed', { collection: 'users', operation: 'updateOne', err: safeErr(err) });
  }
}

export async function getUserCity(userId) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return mem.users.get(String(userId))?.selectedCity || cfg.DEFAULT_CITY;
  try {
    const user = await db.collection('users').findOne({ telegramId: String(userId) });
    return user?.selectedCity || cfg.DEFAULT_CITY;
  } catch (err) {
    log.error('db read failed', { collection: 'users', operation: 'findOne', err: safeErr(err) });
    return cfg.DEFAULT_CITY;
  }
}

export async function setUserCity(userId, city) {
  const safeCity = String(city || cfg.DEFAULT_CITY).slice(0, 80);
  const now = new Date();
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) {
    const key = String(userId);
    mem.users.set(key, { ...(mem.users.get(key) || {}), selectedCity: safeCity });
    return;
  }
  try {
    await db.collection('users').updateOne(
      { telegramId: String(userId) },
      { $setOnInsert: { }, $set: { selectedCity: safeCity, updatedAt: now } },
      { upsert: true }
    );
  } catch (err) {
    log.error('db write failed', { collection: 'users', operation: 'updateOne', err: safeErr(err) });
  }
}

export async function createReport({ userId, city, phenomenon, text, photoFileIds = [] }) {
  const now = new Date();
  const report = {
    reportId: randomUUID(),
    userId: String(userId || ''),
    city: String(city || cfg.DEFAULT_CITY),
    phenomenon: String(phenomenon || 'користувацький репорт'),
    text: String(text || '').slice(0, 3000),
    photoFileIds,
    status: 'pending',
    updatedAt: now
  };
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) mem.reports.push(report);
  else {
    try {
      await db.collection('reports').insertOne(report);
    } catch (err) {
      log.error('db write failed', { collection: 'reports', operation: 'insertOne', err: safeErr(err) });
    }
  }
  return report;
}

export async function createTicket({ userId, subject, text }) {
  const now = new Date();
  const ticket = {
    ticketId: randomUUID(),
    userId: String(userId || ''),
    status: 'open',
    subject: String(subject || 'Звернення користувача').slice(0, 200),
    messages: [{ from: String(userId || ''), text: String(text || '').slice(0, 3000), ts: now }],
    updatedAt: now
  };
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) mem.tickets.push(ticket);
  else {
    try {
      await db.collection('tickets').insertOne(ticket);
    } catch (err) {
      log.error('db write failed', { collection: 'tickets', operation: 'insertOne', err: safeErr(err) });
    }
  }
  return ticket;
}

export async function addWarning({ userId, chatId, type, severity, reason, issuedBy }) {
  const warning = {
    warningId: randomUUID(),
    userId: String(userId || ''),
    chatId: String(chatId || ''),
    type,
    severity,
    reason,
    issuedBy: String(issuedBy || ''),
    active: true,
    issuedAt: new Date(),
  };
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) mem.warnings.push(warning);
  else {
    try {
      await db.collection('warnings').insertOne(warning);
    } catch (err) {
      log.error('db write failed', { collection: 'warnings', operation: 'insertOne', err: safeErr(err) });
    }
  }
  return warning;
}

export async function getWarnings(userId, chatId) {
  const q = { userId: String(userId || ''), chatId: String(chatId || ''), active: true };
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return mem.warnings.filter((w) => w.userId === q.userId && w.chatId === q.chatId && w.active);
  try {
    return await db.collection('warnings').find(q).sort({ issuedAt: -1 }).limit(20).toArray();
  } catch (err) {
    log.error('db read failed', { collection: 'warnings', operation: 'find', err: safeErr(err) });
    return [];
  }
}

export async function removeWarning(warningId, actorId, reason) {
  const now = new Date();
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) {
    const w = mem.warnings.find((item) => item.warningId === warningId);
    if (w) Object.assign(w, { active: false, removedBy: String(actorId), removedAt: now, removeReason: reason, updatedAt: now });
    return Boolean(w);
  }
  try {
    const result = await db.collection('warnings').updateOne(
      { warningId, active: true },
      { $set: { active: false, removedBy: String(actorId), removedAt: now, removeReason: String(reason || ''), updatedAt: now } }
    );
    return result.modifiedCount > 0;
  } catch (err) {
    log.error('db write failed', { collection: 'warnings', operation: 'updateOne', err: safeErr(err) });
    return false;
  }
}

export async function logModerationAction(action) {
  const now = new Date();
  const doc = mutableCopy({ ...action, updatedAt: now });
  doc.createdAt = now;
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) mem.moderationActions.push(doc);
  else {
    try {
      await db.collection('moderationActions').insertOne(doc);
    } catch (err) {
      log.error('db write failed', { collection: 'moderationActions', operation: 'insertOne', err: safeErr(err) });
    }
  }
}

export async function recentModLogs(chatId, limit = 10) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return mem.moderationActions.filter((a) => String(a.chatId) === String(chatId)).slice(-limit).reverse();
  try {
    return await db.collection('moderationActions').find({ chatId: String(chatId) }).sort({ createdAt: -1 }).limit(limit).toArray();
  } catch (err) {
    log.error('db read failed', { collection: 'moderationActions', operation: 'find', err: safeErr(err) });
    return [];
  }
}

export async function setLock(chatId, kind, enabled) {
  const key = String(chatId) + ':' + kind;
  const now = new Date();
  mem.locks.set(key, enabled);
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return;
  try {
    await db.collection('settings').updateOne(
      { key },
      { $setOnInsert: { createdAt: now }, $set: { key, value: Boolean(enabled), updatedAt: now } },
      { upsert: true }
    );
  } catch (err) {
    log.error('db write failed', { collection: 'settings', operation: 'updateOne', err: safeErr(err) });
  }
}

export async function isLocked(chatId, kind) {
  const key = String(chatId) + ':' + kind;
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return Boolean(mem.locks.get(key));
  try {
    const row = await db.collection('settings').findOne({ key });
    return Boolean(row?.value);
  } catch (err) {
    log.error('db read failed', { collection: 'settings', operation: 'findOne', err: safeErr(err) });
    return false;
  }
}

export async function claimPublication(key) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) {
    if (mem.publications.has(key)) return false;
    mem.publications.add(key);
    return true;
  }
  const now = new Date();
  try {
    await db.collection('publications').updateOne(
      { idempotencyKey: key },
      { $setOnInsert: { idempotencyKey: key, status: 'pending', }, $set: { updatedAt: now } },
      { upsert: true }
    );
    const row = await db.collection('publications').findOne({ idempotencyKey: key });
    return row?.status === 'pending';
  } catch (err) {
    log.error('db write failed', { collection: 'publications', operation: 'updateOne', err: safeErr(err) });
    return false;
  }
}

export async function markPublication(key, fields) {
  const db = await getDb(cfg.MONGODB_URI);
  if (!db) return;
  const mutable = mutableCopy(fields);
  try {
    await db.collection('publications').updateOne(
      { idempotencyKey: key },
      { $set: { ...mutable, updatedAt: new Date() } }
    );
  } catch (err) {
    log.error('db write failed', { collection: 'publications', operation: 'updateOne', err: safeErr(err) });
  }
}
