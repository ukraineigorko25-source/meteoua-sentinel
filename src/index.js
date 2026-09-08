import 'dotenv/config';

function safeErr(err) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || String(err);
}

let shuttingDown = false;
let activeRunner = null;
let stopSchedulerFn = null;

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ level: 'error', message: 'unhandledRejection', err: safeErr(reason) }));
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({ level: 'error', message: 'uncaughtException', err: safeErr(err) }));
  process.exit(1);
});

function requestShutdown(signal) {
  console.log(JSON.stringify({ level: 'info', message: 'shutdown requested', signal }));
  shuttingDown = true;
  if (stopSchedulerFn) stopSchedulerFn();
  if (activeRunner) activeRunner.stop();
}

process.once('SIGINT', () => requestShutdown('SIGINT'));
process.once('SIGTERM', () => requestShutdown('SIGTERM'));

async function boot() {
  try {
    const { run } = await import('@grammyjs/runner');
    const { cfg } = await import('./lib/config.js');
    const { log, memoryLog } = await import('./lib/log.js');
    const { createBot } = await import('./bot.js');
    const { registerCommands } = await import('./commands/loader.js');
    const { registerModerationFilter } = await import('./features/moderationFilter.js');
    const { registerAgent } = await import('./features/agent.js');
    const { startScheduler, stopScheduler } = await import('./features/scheduler.js');

    stopSchedulerFn = stopScheduler;

    log.info('boot start', {
      'TELEGRAM_BOT_TOKEN set': Boolean(cfg.TELEGRAM_BOT_TOKEN),
      'MONGODB_URI set': Boolean(cfg.MONGODB_URI),
      'COOKMYBOTS_AI_ENDPOINT set': Boolean(cfg.COOKMYBOTS_AI_ENDPOINT),
      'COOKMYBOTS_AI_KEY set': Boolean(cfg.COOKMYBOTS_AI_KEY),
      'TELEGRAM_MOD_CHAT_ID set': Boolean(cfg.TELEGRAM_MOD_CHAT_ID),
      'TELEGRAM_OWNER_ID set': Boolean(cfg.TELEGRAM_OWNER_ID || cfg.OWNER_TELEGRAM_IDS.length),
      'DEFAULT_CITY set': Boolean(cfg.DEFAULT_CITY),
      'UKRHYDROMET_ALERTS_URL set': Boolean(cfg.UKRHYDROMET_ALERTS_URL),
      'WEATHER_NEWS_RSS_URL set': Boolean(cfg.WEATHER_NEWS_RSS_URL)
    });

    if (!cfg.TELEGRAM_BOT_TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN is required. Add your BotFather token to TELEGRAM_BOT_TOKEN, then restart this single Node.js service.');
      process.exit(1);
    }

    const bot = createBot(cfg.TELEGRAM_BOT_TOKEN);
    await bot.init();
    await registerCommands(bot);
    registerModerationFilter(bot);
    registerAgent(bot);

    await bot.api.setMyCommands([
      { command: 'start', description: 'Головне меню' },
      { command: 'weather', description: 'Поточна погода' },
      { command: 'forecast', description: 'Прогноз' },
      { command: 'alerts', description: 'Попередження УкрГМЦ' },
      { command: 'news', description: 'Погодні новини' },
      { command: 'report', description: 'Повідомити про погодну подію' },
      { command: 'ticket', description: 'Створити звернення' },
      { command: 'moderation', description: 'Меню модерації' },
      { command: 'reset', description: 'Очистити памʼять AI' },
      { command: 'help', description: 'Допомога' }
    ]).catch((err) => log.warn('set commands failed', { err: safeErr(err) }));

    await bot.api.deleteWebhook({ drop_pending_updates: true });
    log.info('telegram webhook cleared', { dropPendingUpdates: true });

    startScheduler(bot);
    setInterval(memoryLog, 60000).unref();

    let delay = 2000;
    while (!shuttingDown) {
      try {
        log.info('polling start', { concurrency: 1 });
        activeRunner = run(bot, { runner: { concurrency: 1 } });
        await activeRunner.task();
        activeRunner = null;
        delay = 2000;
        if (!shuttingDown) log.warn('polling stopped unexpectedly; restarting', { backoffMs: delay });
      } catch (err) {
        activeRunner = null;
        const msg = safeErr(err);
        log.error('polling failed', { err: msg });
        if (shuttingDown) break;
        if (msg.includes('409') || msg.toLowerCase().includes('conflict') || msg.includes('429') || msg.toLowerCase().includes('timeout')) {
          log.warn('polling backoff', { backoffMs: delay });
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay = Math.min(delay * 2, 20000);
          continue;
        }
        throw err;
      }
    }

    stopScheduler();
    log.info('bot stopped', {});
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', message: 'boot failed', err: safeErr(err), code: err?.code || '' }));
    if (err?.code === 'ERR_MODULE_NOT_FOUND') console.error('Check ESM .js extensions and created files under src/.');
    process.exit(1);
  }
}

boot();
