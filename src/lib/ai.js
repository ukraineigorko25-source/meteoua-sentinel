import { log, safeErr } from './log.js';

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function readJson(response) {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

export async function aiChat(cfg, messages, meta = {}) {
  if (!cfg.COOKMYBOTS_AI_KEY || !cfg.COOKMYBOTS_AI_ENDPOINT) {
    return { ok: false, status: 412, content: '' };
  }
  const timeoutMs = Number(cfg.AI_TIMEOUT_MS || 600000);
  const retries = Number(cfg.AI_MAX_RETRIES || 2);
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const t = timeoutSignal(timeoutMs);
    try {
      log.info('ai call start', { feature: 'chat', platform: 'telegram', attempt });
      const response = await fetch(cfg.COOKMYBOTS_AI_ENDPOINT + '/chat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + cfg.COOKMYBOTS_AI_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages, model: cfg.AI_MODEL || undefined, meta: { platform: 'telegram', ...meta } }),
        signal: t.signal
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.json?.error?.message || body.json?.message || body.json?.error || body.text || 'AI request failed');
      const content = String(body.json?.output?.content || '').trim();
      log.info('ai call success', { feature: 'chat', platform: 'telegram' });
      return { ok: true, status: response.status, content };
    } catch (err) {
      log.error('ai call failed', { feature: 'chat', platform: 'telegram', attempt, err: safeErr(err) });
      if (attempt > retries) return { ok: false, status: err?.name === 'AbortError' ? 408 : 500, content: '' };
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    } finally {
      t.clear();
    }
  }
  return { ok: false, status: 500, content: '' };
}