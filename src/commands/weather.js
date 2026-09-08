import { getWeather, formatCurrent } from '../services/weather.js';
import { getUserCity, setUserCity } from '../services/store.js';
import { safeErr, log } from '../lib/log.js';

export default function register(bot) {
  bot.command('weather', async (ctx) => {
    try {
      const arg = ctx.match ? String(ctx.match).trim() : '';
      const city = arg || await getUserCity(ctx.from?.id);
      if (arg) await setUserCity(ctx.from?.id, arg);
      const data = await getWeather(city);
      await ctx.reply(formatCurrent(data));
    } catch (err) {
      log.error('weather command failed', { err: safeErr(err) });
      await ctx.reply('Не вдалося отримати погоду. Перевірте назву міста або спробуйте пізніше.');
    }
  });
}