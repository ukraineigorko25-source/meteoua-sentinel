import { cfg } from '../lib/config.js';
import { addTurn, getRecentTurns } from '../lib/memory.js';
import { aiChat } from '../lib/ai.js';
import { buildBotProfile } from '../lib/botProfile.js';

const locks = new Set();
let globalInFlight = 0;
const GLOBAL_CAP = 1;

function mentioned(ctx, text) {
  const username = ctx.me?.username || ctx.botInfo?.username || '';
  if (!username) return false;
  return text.toLowerCase().includes('@' + username.toLowerCase());
}

function stripMention(ctx, text) {
  const username = ctx.me?.username || ctx.botInfo?.username || '';
  return username ? text.replace(new RegExp('@' + username + '\\b', 'ig'), '').trim() : text.trim();
}

export function registerAgent(bot) {
  bot.on('message:text', async (ctx, next) => {
    const raw = ctx.message?.text || '';
    if (raw.startsWith('/')) return next();
    const isPrivate = ctx.chat?.type === 'private';
    const replyToBot = ctx.message?.reply_to_message?.from?.is_bot;
    if (!isPrivate && !mentioned(ctx, raw) && !replyToBot) return next();
    const text = stripMention(ctx, raw);
    if (!text) return ctx.reply('Напишіть, чим допомогти щодо МетеоUA.');
    const key = String(ctx.chat?.id || ctx.from?.id || 'unknown');
    if (locks.has(key)) return ctx.reply('Я ще працюю над вашим попереднім запитом.');
    if (globalInFlight >= GLOBAL_CAP) return ctx.reply('Зараз зайнятий. Спробуйте ще раз за хвилину.');
    locks.add(key);
    globalInFlight += 1;
    try {
      await addTurn({ mongoUri: cfg.MONGODB_URI, platform: 'telegram', userId: ctx.from?.id, chatId: ctx.chat?.id, role: 'user', text });
      const history = await getRecentTurns({ mongoUri: cfg.MONGODB_URI, platform: 'telegram', userId: ctx.from?.id, chatId: ctx.chat?.id, limit: 12 });
      const messages = [
        { role: 'system', content: buildBotProfile() },
        { role: 'system', content: 'Відповідай українською. Не вигадуй погодні факти. Якщо потрібні фактичні погодні дані, запропонуй команди /weather, /forecast або /alerts.' },
        ...history.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text || '').slice(0, 1500) })),
        { role: 'user', content: text.slice(0, 3000) }
      ];
      const res = await aiChat(cfg, messages, { feature: 'assistant', chatId: ctx.chat?.id, userId: ctx.from?.id });
      const reply = res.ok && res.content ? res.content : 'AI-помічник тимчасово недоступний. Для функцій бота використайте /help.';
      await addTurn({ mongoUri: cfg.MONGODB_URI, platform: 'telegram', userId: ctx.from?.id, chatId: ctx.chat?.id, role: 'assistant', text: reply });
      await ctx.reply(reply.slice(0, 3900));
    } finally {
      locks.delete(key);
      globalInFlight -= 1;
    }
  });
}