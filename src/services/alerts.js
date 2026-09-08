import { cfg } from '../lib/config.js';
import { log, safeErr } from '../lib/log.js';

export async function getOfficialAlerts() {
  if (!cfg.UKRHYDROMET_ALERTS_URL) {
    return { source: 'УкрГМЦ: джерело не налаштовано', alerts: [], configured: false };
  }
  try {
    const response = await fetch(cfg.UKRHYDROMET_ALERTS_URL, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('official alerts http ' + response.status);
    const json = await response.json();
    const raw = Array.isArray(json) ? json : json.alerts || json.items || [];
    const alerts = raw.slice(0, 20).map((a, i) => ({
      id: String(a.id || a.alertId || i),
      region: String(a.region || a.area || a.oblast || a.title || 'Україна'),
      severity: String(a.severity || a.level || 'інформація'),
      phenomenon: String(a.phenomenon || a.event || a.type || 'попередження'),
      title: String(a.title || a.name || 'Офіційне попередження'),
      description: String(a.description || a.text || a.message || '').slice(0, 800),
      sourceUrl: String(a.sourceUrl || a.url || cfg.UKRHYDROMET_ALERTS_URL)
    }));
    return { source: 'УкрГМЦ', alerts, configured: true };
  } catch (err) {
    log.error('official alerts failed', { err: safeErr(err) });
    return { source: 'УкрГМЦ: дані тимчасово недоступні', alerts: [], configured: true };
  }
}

export function formatAlerts(result) {
  if (!result.configured) return 'Джерело офіційних попереджень УкрГМЦ ще не налаштовано. Додайте UKRHYDROMET_ALERTS_URL, щоб увімкнути цю функцію.';
  if (!result.alerts.length) return 'Активних офіційних попереджень не знайдено.\nДжерело: ' + result.source;
  return ['Офіційні попередження УкрГМЦ:', ...result.alerts.map((a) => a.region + ' · ' + a.severity + ' · ' + a.phenomenon + '\n' + a.title + (a.description ? '\n' + a.description : '') + '\nДжерело: ' + a.sourceUrl)].join('\n\n');
}
