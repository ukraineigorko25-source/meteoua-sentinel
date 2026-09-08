import { cfg } from '../lib/config.js';
import { memoryLog, log, safeErr } from '../lib/log.js';
import { getWeather, formatForecast } from '../services/weather.js';
import { getOfficialAlerts, formatAlerts } from '../services/alerts.js';
import { claimPublication, markPublication } from '../services/store.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let running = false;
let stopped = false;
let cycle = 0;

function kyivStamp() {
  return new Intl.DateTimeFormat('uk-UA', { timeZone: cfg.DEFAULT_TIMEZONE, hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

async function publish(bot, type, text) {
  if (!cfg.TELEGRAM_CHANNEL_ID) return;
  const key = type + ':' + kyivStamp();
  if (!(await claimPublication(key))) return;
  try {
    const sent = await bot.api.sendMessage(cfg.TELEGRAM_CHANNEL_ID, text);
    await markPublication(key, { status: 'sent', sentAt: new Date(), telegramMessageId: sent.message_id, type, targetChannelId: cfg.TELEGRAM_CHANNEL_ID });
  } catch (err) {
    await markPublication(key, { status: 'failed', error: safeErr(err), type, targetChannelId: cfg.TELEGRAM_CHANNEL_ID });
    log.error('publication failed', { err: safeErr(err) });
  }
}

async function runCycle(bot) {
  const hhmm = new Intl.DateTimeFormat('uk-UA', { timeZone: cfg.DEFAULT_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const schedules = [
    ['morning', cfg.MORNING_FORECAST_TIME, 'today'],
    ['day', cfg.DAY_FORECAST_TIME, 'today'],
    ['evening', cfg.EVENING_FORECAST_TIME, 'today'],
    ['tomorrow', cfg.TOMORROW_FORECAST_TIME, 'tomorrow']
  ];
  for (const [type, time, mode] of schedules) {
    if (hhmm === time) {
      const data = await getWeather(cfg.DEFAULT_CITY);
      await publish(bot, type, formatForecast(data, mode));
    }
  }
  if (cycle % 10 === 0) {
    const alerts = await getOfficialAlerts();
    if (alerts.alerts.length) await publish(bot, 'official-alerts', formatAlerts(alerts));
  }
}

export function startScheduler(bot) {
  if (running) return;
  running = true;
  stopped = false;
  log.info('scheduler started', { enabled: cfg.AUTO_PUBLICATIONS_ENABLED, channelSet: Boolean(cfg.TELEGRAM_CHANNEL_ID) });
  (async () => {
    while (!stopped) {
      cycle += 1;
      try {
        log.info('scheduler cycle', { cycle });
        if (cfg.AUTO_PUBLICATIONS_ENABLED) await runCycle(bot);
        if (cycle % 60 === 0) memoryLog();
      } catch (err) {
        log.error('scheduler cycle failed', { err: safeErr(err) });
      }
      await sleep(60000);
    }
  })();
}

export function stopScheduler() {
  stopped = true;
  running = false;
}