import { Bot, session } from 'grammy';
import { rememberUser, createReport, createTicket } from './services/store.js';
import { cfg } from './lib/config.js';
import { log, safeErr } from './lib/log.js';

async function notifyModeration(ctx, header, text) {
  if (!cfg.TELEGRAM_MOD_CHAT_ID) return;
  const fallbackText = [header, text].filter(Boolean).join('\n');
  try {
    if (ctx.message?.photo?.length) {
      await ctx.api.copyMessage(cfg.TELEGRAM_MOD_CHAT_ID, ctx.chat.id, ctx.message.message_id, {
        caption: fallbackText.slice(0, 1000)
      });
      return;
    }
    await ctx.api.sendMessage(cfg.TELEGRAM_MOD_CHAT_ID, fallbackText);
  } catch (err) {
    log.warn('moderation media forward failed; using text fallback', { err: safeErr(err) });
    try {
      await ctx.api.sendMessage(cfg.TELEGRAM_MOD_CHAT_ID, fallbackText.slice(0, 3900));
    } catch (fallbackErr) {
      log.error('moderation text fallback failed', { err: safeErr(fallbackErr) });
    }
  }
}

export function createBot(token) {
  const bot = new Bot(token);

  bot.use(session({ initial: () => ({ reportMode: false, ticketMode: false }) }));

  bot.use(async (ctx, next) => {
    log.info('telegram update handled', {
      updateId: ctx.update?.update_id,
      chatType: ctx.chat?.type || '',
      hasText: Boolean(ctx.message?.text),
      hasPhoto: Boolean(ctx.message?.photo?.length),
      isCommand: Boolean(ctx.message?.text?.startsWith('/'))
    });
    try {
      await rememberUser(ctx);
      await next();
    } catch (err) {
      log.error('middleware failed', { err: safeErr(err) });
      throw err;
    }
  });

  bot.on(['message:photo', 'message:text'], async (ctx, next) => {
    if (ctx.message?.text?.startsWith('/')) return next();
    if (ctx.session?.reportMode) {
      ctx.session.reportMode = false;
      const caption = ctx.message?.caption || ctx.message?.text || '';
      const photos = ctx.message?.photo || [];
      const photoFileIds = photos.length ? [photos[photos.length - 1].file_id] : [];
      const report = await createReport({
        userId: ctx.from?.id,
        city: cfg.DEFAULT_CITY,
        phenomenon: 'користувацький репорт',
        text: caption || 'Фото без опису',
        photoFileIds
      });
      await ctx.reply('Дякуємо. Репорт отримано та передано на модерацію. Номер: ' + report.reportId);
      await notifyModeration(ctx, 'Новий репорт на модерацію:', report.text + '\nID: ' + report.reportId);
      return;
    }
    if (ctx.session?.ticketMode) {
      ctx.session.ticketMode = false;
      const text = ctx.message?.text || ctx.message?.caption || '';
      const ticket = await createTicket({ userId: ctx.from?.id, subject: 'Звернення користувача', text });
      await ctx.reply('Звернення створено. Номер: ' + ticket.ticketId);
      await notifyModeration(ctx, 'Нове звернення:', text + '\nID: ' + ticket.ticketId);
      return;
    }
    return next();
  });

  bot.catch((err) => {
    log.error('bot update failed', { err: safeErr(err.error || err) });
  });

  return bot;
}
