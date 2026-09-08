export function safeErr(err) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || String(err);
}

export const log = {
  info(message, meta = {}) {
    console.log(JSON.stringify({ level: 'info', message, ...meta }));
  },
  warn(message, meta = {}) {
    console.warn(JSON.stringify({ level: 'warn', message, ...meta }));
  },
  error(message, meta = {}) {
    console.error(JSON.stringify({ level: 'error', message, ...meta }));
  }
};

export function memoryLog() {
  const m = process.memoryUsage();
  log.info('[mem]', {
    rssMB: Math.round(m.rss / 1e6),
    heapUsedMB: Math.round(m.heapUsed / 1e6)
  });
}