import { getOfficialAlerts, formatAlerts } from '../services/alerts.js';

export default function register(bot) {
  bot.command('alerts', async (ctx) => {
    const result = await getOfficialAlerts();
    await ctx.reply(formatAlerts(result));
  });
}