const { isAdminUser } = require("../bot/commands/admin");

const envInt = (name, fallback) => {
  const val = parseInt(process.env[name], 10);
  return isNaN(val) ? fallback : val;
};

// Configuration
const getGlobalBudget = () => envInt("GLOBAL_BUDGET_PER_MINUTE", 120);
const getPerUserMin = () => envInt("PER_USER_MIN", 2);
const getPerUserMax = () => envInt("PER_USER_MAX", 8);
const getActiveUserWindowMs = () => envInt("ACTIVE_USER_WINDOW_MS", 300000);
const getRateWindowMs = () => envInt("RATE_WINDOW_MS", 60000);

// State
const activeUsers = new Map(); // telegramId -> lastSeenTimestamp
const userCounters = new Map(); // telegramId -> { count, resetAt }
const globalCounter = { count: 0, resetAt: 0 };

function getActiveUserCount() {
  const now = Date.now();
  const threshold = now - getActiveUserWindowMs();
  for (const [id, timestamp] of activeUsers.entries()) {
    if (timestamp < threshold) {
      activeUsers.delete(id);
    }
  }
  return activeUsers.size;
}

function rateLimitMiddleware() {
  return async (ctx, next) => {
    const telegramId = ctx.from?.id;
    if (!telegramId) return next();

    // Fast-path bypass for admins
    if (isAdminUser(telegramId)) {
      return next();
    }

    const now = Date.now();
    const isCallback = ctx.updateType === "callback_query";
    const callbackData = ctx.callbackQuery?.data || "";

    // Determine weight
    let weight = 0;
    if (isCallback) {
      if (callbackData.startsWith("get_") || callbackData.startsWith("grp_")) {
        weight = 2; // Expensive delivery actions
      } else {
        weight = 1; // Cheaper navigation actions
      }
    } else {
      weight = 1; // Text queries
    }

    if (weight === 0) return next();

    // Track active user
    activeUsers.set(telegramId, now);

    // Reset global counter if window passed
    if (now > globalCounter.resetAt) {
      globalCounter.count = 0;
      globalCounter.resetAt = now + getRateWindowMs();
    }

    // Initialize or reset user counter
    let userRecord = userCounters.get(telegramId);
    if (!userRecord || now > userRecord.resetAt) {
      userRecord = { count: 0, resetAt: now + getRateWindowMs() };
      userCounters.set(telegramId, userRecord);
    }

    // Calculate dynamic limit
    const activeCount = Math.max(getActiveUserCount(), 1);
    const dynamicPerUserMax = Math.min(
      Math.max(
        Math.floor(getGlobalBudget() / activeCount),
        getPerUserMin()
      ),
      getPerUserMax()
    );

    // 1. Check Global Limit
    if (globalCounter.count + weight > getGlobalBudget()) {
      const msg = "⏳ The bot is handling a lot of requests right now — please try again in a moment.";
      if (isCallback) {
        await ctx.answerCbQuery(msg, { show_alert: true }).catch(() => {});
      } else {
        await ctx.reply(msg).catch(() => {});
      }
      return;
    }

    // 2. Check Per-User Limit
    if (userRecord.count + weight > dynamicPerUserMax) {
      const msg = "⏳ You're searching a bit fast — please wait a moment and try again.";
      if (isCallback) {
        await ctx.answerCbQuery(msg, { show_alert: true }).catch(() => {});
      } else {
        await ctx.reply(msg).catch(() => {});
      }
      return;
    }

    // Increment counters
    globalCounter.count += weight;
    userRecord.count += weight;

    return next();
  };
}

module.exports = { rateLimitMiddleware };
