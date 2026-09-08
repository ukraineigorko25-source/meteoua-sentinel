import { createReport } from '../services/store.js';
import { cfg } from '../lib/config.js';
import { log, safeErr } from '../lib/log.js';

async function notifyModeration(ctx, report) {
  if (!cfg.TELEGRAM_MOD_CHAT_ID) return;
  try {
    await ctx.api.sendMessage(cfg.TELEGRAM_MOD_CHAT_ID, 'Новий репорт на модерацію:\n' + report.text + '\nID: ' + report.reportId);
  } catch (err) {
    log.error('report moderation notification failed', { err: safeErr(err) });
  }
}

export default function register(bot) {
  bot.command('report', async (ctx) => {
    const text = String(ctx.match || '').trim();
    if (!text) {
      if (ctx.session) ctx.session.reportMode = true;
      await ctx.reply('Опишіть погодну подію одним повідомленням. Можна також надіслати фото з підписом. Приклад: Київ, сильний вітер, повалені гілки біля метро.');
      return;
    }
    const report = await createReport({ userId: ctx.from?.id, city: cfg.DEFAULT_CITY, phenomenon: 'користувацький репорт', text });
    await ctx.reply('Дякуємо. Репорт отримано та передано на модерацію. Номер: ' + report.reportId);
    await notifyModeration(ctx, report);
  });
}
