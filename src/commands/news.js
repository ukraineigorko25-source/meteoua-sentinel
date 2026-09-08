import { getNews, formatNews } from '../services/news.js';

export default function register(bot) {
  bot.command('news', async (ctx) => {
    await ctx.reply(formatNews(await getNews()));
  });
}