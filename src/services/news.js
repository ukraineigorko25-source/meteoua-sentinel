import { cfg } from '../lib/config.js';
import { safeErr, log } from '../lib/log.js';

function pick(text, tag) {
  const match = text.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>', 'i'));
  return match ? match[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : '';
}

export async function getNews() {
  if (!cfg.WEATHER_NEWS_RSS_URL) return [];
  try {
    const response = await fetch(cfg.WEATHER_NEWS_RSS_URL, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('news http ' + response.status);
    const xml = await response.text();
    return xml.split(/<item[\s>]/i).slice(1, 6).map((chunk) => ({ title: pick(chunk, 'title'), url: pick(chunk, 'link'), summary: pick(chunk, 'description'), publishedAt: pick(chunk, 'pubDate') })).filter((n) => n.title);
  } catch (err) {
    log.error('news fetch failed', { err: safeErr(err) });
    return [];
  }
}

export function formatNews(items) {
  if (!items.length) return 'Новини тимчасово недоступні або WEATHER_NEWS_RSS_URL ще не налаштовано.';
  return ['Останні погодні новини:', ...items.map((n) => n.title + (n.summary ? '\n' + n.summary.slice(0, 220) : '') + (n.url ? '\n' + n.url : ''))].join('\n\n');
}