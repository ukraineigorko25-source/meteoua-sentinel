import { InlineKeyboard } from 'grammy';

export default function register(bot) {
  bot.command('start', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text('Погода', 'menu:weather').text('Прогноз', 'menu:forecast').row()
      .text('Попередження', 'menu:alerts').text('Новини', 'menu:news').row()
      .text('Повідомити про подію', 'menu:report').text('Допомога', 'menu:help');
    await ctx.reply('Вітаємо в офіційному боті МетеоUA.\n\nТут можна переглянути погоду, прогноз, офіційні попередження УкрГМЦ, надіслати погодний репорт або створити звернення до команди.', { reply_markup: keyboard });
  });

  bot.callbackQuery('menu:help', async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply('Напишіть /help, щоб побачити всі команди.'); });
  bot.callbackQuery('menu:weather', async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply('Для поточної погоди використайте /weather або /weather Київ.'); });
  bot.callbackQuery('menu:forecast', async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply('Для прогнозу використайте /forecast.'); });
  bot.callbackQuery('menu:alerts', async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply('Для офіційних попереджень використайте /alerts.'); });
  bot.callbackQuery('menu:news', async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply('Для новин використайте /news.'); });
  bot.callbackQuery('menu:report', async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply('Для репорту використайте /report.'); });
}