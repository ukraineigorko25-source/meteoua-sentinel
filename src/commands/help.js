export default function register(bot) {
  bot.command('help', async (ctx) => {
    await ctx.reply([
      'Довідка МетеоUA',
      '/start — головне меню',
      '/weather або /weather Київ — поточна погода',
      '/forecast — прогноз на сьогодні, завтра, 7 днів або всі області',
      '/alerts — небезпечні явища та офіційні попередження УкрГМЦ',
      '/news — останні погодні новини',
      '/report — надіслати повідомлення або фото про погодну подію на модерацію',
      '/ticket — створити звернення до команди',
      '/moderation — меню модерації',
      '/reset — очистити памʼять AI для цього чату',
      '',
      'Модерація: /warn, /strictwarn, /warnings, /removewarn, /mute, /unmute, /kick, /ban, /unban, /delete, /purge, /lock, /unlock, /modlog.'
    ].join('\n'));
  });
}