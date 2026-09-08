import { cfg } from '../lib/config.js';
import { addWarning, getWarnings, removeWarning, logModerationAction, recentModLogs, setLock } from '../services/store.js';
import { safeErr, log } from '../lib/log.js';

function isOwner(id) {
  return cfg.OWNER_TELEGRAM_IDS.includes(String(id));
}

async function canModerate(ctx) {
  if (isOwner(ctx.from?.id)) return true;
  try {
    const member = await ctx.getChatMember(ctx.from.id);
    return ['creator', 'administrator'].includes(member.status);
  } catch {
    return false;
  }
}

function targetFromReply(ctx) {
  return ctx.message?.reply_to_message?.from || null;
}

async function requireMod(ctx) {
  if (await canModerate(ctx)) return true;
  await ctx.reply('Ця команда доступна лише модерації.');
  return false;
}

async function notifyLog(ctx, text) {
  if (!cfg.TELEGRAM_LOG_CHANNEL_ID) return;
  await ctx.api.sendMessage(cfg.TELEGRAM_LOG_CHANNEL_ID, text).catch((err) => log.error('log channel send failed', { err: safeErr(err) }));
}

async function warnCommand(ctx, strict = false) {
  if (!(await requireMod(ctx))) return;
  const target = targetFromReply(ctx);
  if (!target) return ctx.reply('Використайте команду відповіддю на повідомлення користувача.');
  if (String(target.id) === String(ctx.from.id)) return ctx.reply('Не можна застосовувати дію до себе.');
  const reason = String(ctx.match || '').trim() || 'причину не вказано';
  const warning = await addWarning({ userId: target.id, chatId: ctx.chat.id, type: strict ? 'strictwarn' : 'warn', severity: strict ? 2 : 1, reason, issuedBy: ctx.from.id });
  await logModerationAction({ actionType: strict ? 'strictwarn' : 'warn', targetUserId: String(target.id), actorUserId: String(ctx.from.id), chatId: String(ctx.chat.id), reason });
  await notifyLog(ctx, 'Модерація: ' + (strict ? 'strictwarn' : 'warn') + ' для ' + target.id + '\nПричина: ' + reason);
  await ctx.reply('Попередження видано. ID: ' + warning.warningId);
}

async function restrict(ctx, action) {
  if (!(await requireMod(ctx))) return;
  const target = targetFromReply(ctx);
  if (!target) return ctx.reply('Використайте команду відповіддю на повідомлення користувача.');
  if (String(target.id) === String(ctx.from.id)) return ctx.reply('Не можна застосовувати дію до себе.');
  const reason = String(ctx.match || '').trim() || 'причину не вказано';
  try {
    if (action === 'mute') {
      const until = Math.floor(Date.now() / 1000) + cfg.MUTE_DEFAULT_MINUTES * 60;
      await ctx.api.restrictChatMember(ctx.chat.id, target.id, { permissions: { can_send_messages: false }, until_date: until });
    }
    if (action === 'unmute') await ctx.api.restrictChatMember(ctx.chat.id, target.id, { permissions: { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true } });
    if (action === 'kick') { await ctx.api.banChatMember(ctx.chat.id, target.id); await ctx.api.unbanChatMember(ctx.chat.id, target.id); }
    if (action === 'ban') await ctx.api.banChatMember(ctx.chat.id, target.id);
    if (action === 'unban') await ctx.api.unbanChatMember(ctx.chat.id, target.id);
    await logModerationAction({ actionType: action, targetUserId: String(target.id), actorUserId: String(ctx.from.id), chatId: String(ctx.chat.id), reason });
    await notifyLog(ctx, 'Модерація: ' + action + ' для ' + target.id + '\nПричина: ' + reason);
    await ctx.reply('Дію виконано: ' + action);
  } catch (err) {
    log.error('moderation action failed', { action, err: safeErr(err) });
    await ctx.reply('Не вдалося виконати дію. Перевірте права бота в Telegram.');
  }
}

export default function register(bot) {
  bot.command('moderation', async (ctx) => ctx.reply('Меню модерації: /warn, /strictwarn, /warnings, /removewarn, /mute, /unmute, /kick, /ban, /unban, /delete, /purge, /lock, /unlock, /modlog. Команди санкцій використовуйте через reply.'));
  bot.command('warn', (ctx) => warnCommand(ctx, false));
  bot.command('strictwarn', (ctx) => warnCommand(ctx, true));
  bot.command('warnings', async (ctx) => {
    if (!(await requireMod(ctx))) return;
    const target = targetFromReply(ctx) || ctx.from;
    const rows = await getWarnings(target.id, ctx.chat.id);
    await ctx.reply(rows.length ? rows.map((w) => w.warningId + ' · ' + w.type + ' · ' + w.reason).join('\n') : 'Активних попереджень немає.');
  });
  bot.command('removewarn', async (ctx) => {
    if (!(await requireMod(ctx))) return;
    const [id, ...rest] = String(ctx.match || '').trim().split(/\s+/);
    if (!id) return ctx.reply('Вкажіть ID попередження.');
    const ok = await removeWarning(id, ctx.from.id, rest.join(' '));
    await ctx.reply(ok ? 'Попередження знято.' : 'Попередження не знайдено.');
  });
  for (const name of ['mute', 'unmute', 'kick', 'ban', 'unban']) bot.command(name, (ctx) => restrict(ctx, name));
  bot.command('delete', async (ctx) => {
    if (!(await requireMod(ctx))) return;
    const msg = ctx.message?.reply_to_message;
    if (!msg) return ctx.reply('Використайте /delete відповіддю на повідомлення.');
    try { await ctx.api.deleteMessage(ctx.chat.id, msg.message_id); await ctx.deleteMessage().catch(() => {}); await logModerationAction({ actionType: 'delete', targetUserId: String(msg.from?.id || ''), actorUserId: String(ctx.from.id), chatId: String(ctx.chat.id), reason: String(ctx.match || '') }); } catch { await ctx.reply('Не вдалося видалити повідомлення.'); }
  });
  bot.command('purge', async (ctx) => {
    if (!(await requireMod(ctx))) return;
    const count = Math.max(1, Math.min(Number(ctx.match || 10), 50));
    const start = ctx.message.message_id;
    for (let id = start; id > start - count; id -= 1) await ctx.api.deleteMessage(ctx.chat.id, id).catch(() => {});
    await logModerationAction({ actionType: 'purge', actorUserId: String(ctx.from.id), chatId: String(ctx.chat.id), reason: String(count) });
  });
  bot.command('lock', async (ctx) => { if (await requireMod(ctx)) { const kind = String(ctx.match || 'links').trim(); await setLock(ctx.chat.id, kind, true); await ctx.reply('Блокування увімкнено: ' + kind); } });
  bot.command('unlock', async (ctx) => { if (await requireMod(ctx)) { const kind = String(ctx.match || 'links').trim(); await setLock(ctx.chat.id, kind, false); await ctx.reply('Блокування вимкнено: ' + kind); } });
  bot.command('modlog', async (ctx) => { if (await requireMod(ctx)) { const rows = await recentModLogs(ctx.chat.id, 10); await ctx.reply(rows.length ? rows.map((r) => new Date(r.createdAt).toLocaleString('uk-UA') + ' · ' + r.actionType + ' · ' + (r.reason || '')).join('\n') : 'Журнал порожній.'); } });
}