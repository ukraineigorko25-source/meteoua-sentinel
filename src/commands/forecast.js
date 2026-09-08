import { InlineKeyboard } from 'grammy';
import { getForecast, formatForecast, formatAllRegions } from '../services/weather.js';
import { getUserCity } from '../services/store.js';
import { log, safeErr } from '../lib/log.js';

async function sendForecast(ctx, mode) {
  try {
    if (mode === 'regions') return ctx.reply(await formatAllRegions());
    const city = await getUserCity(ctx.from?.id);
    const data = await getForecast(city);
    return ctx.reply(formatForecast(data, mode));
  } catch (err) {
    log.error('forecast failed', { err: safeErr(err) });
    return ctx.reply('Прогноз тимчасово недоступний. Спробуйте пізніше.');
  }
}

export default function register(bot) {
  bot.command('forecast', async (ctx) => {
    const keyboard = new InlineKeyboard().text('Сьогодні', 'forecast:today').text('Завтра', 'forecast:tomorrow').row().text('7 днів', 'forecast:week').text('Усі області', 'forecast:regions');
    await ctx.reply('Оберіть тип прогнозу:', { reply_markup: keyboard });
  });
  bot.callbackQuery(/^forecast:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await sendForecast(ctx, ctx.match[1]); });
}