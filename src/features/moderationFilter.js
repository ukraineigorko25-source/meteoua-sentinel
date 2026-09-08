import { cfg } from '../lib/config.js';
import { addWarning, isLocked, logModerationAction } from '../services/store.js';
import { log, safeErr } from '../lib/log.js';

const buckets = new Map();
const badWords = ['лохотрон', 'шахрай', 'ідіот', 'дебіл'];
const mentionRe = /@\w+/g;
const urlRe = /(https?:\/\/|t\.me\/|www\.)/i;

export function registerModerationFilter(bot) {
  bot.on('message', async (ctx, next) => {
    const text = ctx.message?.text || ctx.message?.caption || '';
    if (!ctx.chat || ctx.chat.type === 'private' || text.startsWith('/')) return next();
    try {
      const userId = String(ctx.from?.id || 'unknown');
      const key = ctx.chat.id + ':' + userId;
      const now = Date.now();
      const rows = (buckets.get(key) || []).filter((ts) => now - ts < cfg.FLOOD_WINDOW_MS);
      rows.push(now);
      buckets.set(key, rows);
      let reason = '';
      if (rows.length > cfg.FLOOD_MAX_MESSAGES) reason = 'антифлуд';
      if (!reason && await isLocked(ctx.chat.id, 'links') && urlRe.test(text)) reason = 'посилання заблоковані';
      if (!reason && (text.match(mentionRe) || []).length >= 6) reason = 'масові згадки';
      if (!reason && badWords.some((w) => text.toLowerCase().includes(w))) reason = 'образи або підозрілий текст';
      if (!reason) return next();
      await ctx.deleteMessage().catch((err) => log.warn('moderation delete fallback', { err: safeErr(err) }));
      await addWarning({ userId, chatId: ctx.chat.id, type: 'auto', severity: 1, reason, issuedBy: 'bot' });
      await logModerationAction({ actionType: 'auto_delete_warn', targetUserId: userId, actorUserId: 'bot', chatId: String(ctx.chat.id), reason });
      return;
    } catch (err) {
      log.error('moderation filter failed', { err: safeErr(err) });
      return next();
    }
  });
}