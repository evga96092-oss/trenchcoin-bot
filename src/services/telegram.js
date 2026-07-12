import { config } from "../config.js";

let cache = { value: null, fetchedAt: 0 };
function setup(message) { return { status: "configuration_required", memberCount: null, chatId: config.telegramChatId || null, message, updatedAt: new Date().toISOString() }; }

export async function getTelegramMemberCount({ force = false } = {}) {
  if (!config.telegramBotToken) return setup("Add TELEGRAM_BOT_TOKEN to Railway.");
  if (!config.telegramChatId) return setup("Add TELEGRAM_CHAT_ID (for example @publicgroup or -100...) to Railway.");
  const now = Date.now();
  if (!force && cache.value && now - cache.fetchedAt < config.telegramCacheTtlMs) return { ...cache.value, status: "cached", cacheAgeMs: now - cache.fetchedAt };
  try {
    const response = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getChatMemberCount?chat_id=${encodeURIComponent(config.telegramChatId)}`, { signal: AbortSignal.timeout(config.integrationTimeoutMs) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      const description = String(payload.description || `HTTP ${response.status}`);
      const diagnostic = response.status === 401 ? "invalid_token" : /chat not found/i.test(description) ? "chat_not_found_or_bot_not_added" : /not enough rights|administrator/i.test(description) ? "bot_lacks_permission" : response.status === 429 ? "rate_limited" : "telegram_error";
      throw new Error(`${diagnostic}: ${description}`);
    }
    const value = { status: "verified", memberCount: Number(payload.result), chatId: config.telegramChatId, source: "Telegram Bot API getChatMemberCount", updatedAt: new Date().toISOString(), cacheAgeMs: 0 };
    cache = { value, fetchedAt: now }; return value;
  } catch (error) {
    if (cache.value) return { ...cache.value, status: "cached", cacheAgeMs: now - cache.fetchedAt, error: error.message };
    return { status: "provider_unavailable", memberCount: null, chatId: config.telegramChatId, source: "Telegram Bot API", updatedAt: new Date().toISOString(), error: error.message };
  }
}
