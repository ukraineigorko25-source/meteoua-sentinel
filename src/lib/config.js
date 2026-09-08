function list(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

const ownerIds = process.env.TELEGRAM_OWNER_ID || process.env.OWNER_TELEGRAM_IDS || '';

export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  MONGODB_URI: process.env.MONGODB_URI || '',
  COOKMYBOTS_AI_ENDPOINT: (process.env.COOKMYBOTS_AI_ENDPOINT || 'https://api.cookmybots.com/api/ai').replace(/\/+$/, ''),
  COOKMYBOTS_AI_KEY: process.env.COOKMYBOTS_AI_KEY || '',
  AI_TIMEOUT_MS: Number(process.env.AI_TIMEOUT_MS || 600000),
  AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES || 2),
  CONCURRENCY: Number(process.env.CONCURRENCY || 20),
  AI_MODEL: process.env.AI_MODEL || '',
  UKRHYDROMET_ALERTS_URL: process.env.UKRHYDROMET_ALERTS_URL || '',
  WEATHER_NEWS_RSS_URL: process.env.WEATHER_NEWS_RSS_URL || '',
  DEFAULT_CITY: process.env.DEFAULT_CITY || 'Київ',
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE || 'Europe/Kyiv',
  TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID || '',
  TELEGRAM_MOD_CHAT_ID: process.env.TELEGRAM_MOD_CHAT_ID || '',
  TELEGRAM_LOG_CHANNEL_ID: process.env.TELEGRAM_LOG_CHANNEL_ID || '',
  TELEGRAM_OWNER_ID: process.env.TELEGRAM_OWNER_ID || '',
  OWNER_TELEGRAM_IDS: list(ownerIds),
  AUTO_PUBLICATIONS_ENABLED: String(process.env.AUTO_PUBLICATIONS_ENABLED || '0') === '1',
  MORNING_FORECAST_TIME: process.env.MORNING_FORECAST_TIME || '07:00',
  DAY_FORECAST_TIME: process.env.DAY_FORECAST_TIME || '13:00',
  EVENING_FORECAST_TIME: process.env.EVENING_FORECAST_TIME || '19:00',
  TOMORROW_FORECAST_TIME: process.env.TOMORROW_FORECAST_TIME || '21:00',
  FLOOD_WINDOW_MS: Number(process.env.FLOOD_WINDOW_MS || 10000),
  FLOOD_MAX_MESSAGES: Number(process.env.FLOOD_MAX_MESSAGES || 6),
  MUTE_DEFAULT_MINUTES: Number(process.env.MUTE_DEFAULT_MINUTES || 60)
};
