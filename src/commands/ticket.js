import { createTicket } from '../services/store.js';
import { cfg } from '../lib/config.js';
import { log, safeErr } from '../lib/log.js';

async function notifyModeration(ctx, ticket, text) {
  if (!cfg.TELEGRAM_MOD_CHAT_ID) return;
  try {
    await ctx.api.sendMessage(cfg.TELEGRAM_MOD_CHAT_ID, 'Нове звернення:\n' + text + '\nID: ' + ticket.ticketId);
  } catch (err) {
    log.error('ticket moderation notification failed', { err: safeErr(err) });
  }
}

export default function register(bot) {
  bot.command('ticket', async (ctx) => {
    const text = String(ctx.match || '').trim();
    if (!text) {
      if (ctx.session) ctx.session.ticketMode = true;
      await ctx.reply('Опишіть ваше звернення одним повідомленням. Наприклад: проблема з репортом, питання до модерації або пропозиція.');
      return;
    }
    const ticket = await createTicket({ userId: ctx.from?.id, subject: 'Звернення користувача', text });
    await ctx.reply('Звернення створено. Номер: ' + ticket.ticketId);
    await notifyModeration(ctx, ticket, text);
  });
}
