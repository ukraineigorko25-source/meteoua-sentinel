МетеоUA | Офіційний бот

Повноцінний Telegram-бот для каналу та спільноти «МетеоUA 🌦️». Інтерфейс українською, команди англійською.

Можливості:
1) Поточна погода через Open-Meteo.
2) Прогноз на сьогодні, завтра, 7 днів та огляд по областях України.
3) Офіційні попередження УкрГМЦ через налаштований JSON URL.
4) Погодні новини через RSS.
5) Репорти користувачів із премодерацією.
6) Тикети до команди МетеоUA.
7) Модерація групи: антифлуд, антиспам, попередження, mute, ban, purge, lock.
8) Автоматичні публікації в канал.
9) AI-помічник через CookMyBots AI Gateway без вигадування погодних фактів.

Архітектура:
1) src/index.js — безпечний старт, long polling через @grammyjs/runner, очищення webhook, scheduler.
2) src/bot.js — grammY bot, session, базові middleware.
3) src/commands — публічні та модераційні команди.
4) src/services/weather.js — Open-Meteo provider і кеш.
5) src/services/alerts.js — офіційні попередження з UKRHYDROMET_ALERTS_URL.
6) src/services/store.js — MongoDB або in-memory fallback.
7) src/features/moderationFilter.js — антифлуд і базова автомодерація.
8) src/features/scheduler.js — автопублікації в одному Node.js процесі.
9) src/features/agent.js — AI-допомога з backpressure.

Запуск локально:
1) Встановіть Node.js 18 або новіший.
2) Скопіюйте .env.sample у .env.
3) Заповніть TELEGRAM_BOT_TOKEN.
4) За можливості додайте MONGODB_URI.
5) Виконайте npm run build.
6) Запустіть npm start або npm run dev.

Команди:
/start — головне меню.
/weather або /weather Київ — поточна погода.
/forecast — меню прогнозу.
/alerts — офіційні попередження.
/news — новини.
/report Київ, гроза, сильний дощ — репорт на модерацію.
/ticket Питання до модерації — створити звернення.
/help — довідка.
/moderation — меню модерації.

Модераційні команди працюють переважно через reply на повідомлення користувача: /warn, /strictwarn, /warnings, /mute, /unmute, /kick, /ban, /unban, /delete. Для роботи потрібні права адміністратора Telegram у групі.

База даних:
MongoDB використовується для users, warnings, moderationActions, tickets, reports, weatherCache, publications, memory_messages і settings. Індекси створюються автоматично тільки для прикладних полів, без ручного індексу _id.

Інтеграції:
Open-Meteo: геокодування та прогноз без API ключа.
CookMyBots AI Gateway: POST /chat, тільки для редакторської допомоги й відповідей про бота.
УкрГМЦ: підключається через UKRHYDROMET_ALERTS_URL, якщо доступний офіційний JSON endpoint.
RSS новини: WEATHER_NEWS_RSS_URL.

Render deployment:
1) Створіть Web Service.
2) Build command: npm run build.
3) Start command: npm start.
4) Додайте TELEGRAM_BOT_TOKEN.
5) Додайте MONGODB_URI для постійної памʼяті та журналів.
6) Додайте chat ids для каналу, модчату й лог-каналу за потреби.

Troubleshooting:
Якщо бот не стартує, перевірте TELEGRAM_BOT_TOKEN.
Якщо погода не показується, перевірте назву міста та доступ до api.open-meteo.com.
Якщо модераційні дії не працюють, перевірте права адміністратора бота.
Якщо AI не відповідає, перевірте COOKMYBOTS_AI_KEY та COOKMYBOTS_AI_ENDPOINT.
Логи не містять секретів, лише ознаки наявності env vars.

Розширення:
Нові команди додавайте в src/commands/*.js з default export register(bot). Loader підключить їх автоматично. Нові сервіси додавайте в src/services.