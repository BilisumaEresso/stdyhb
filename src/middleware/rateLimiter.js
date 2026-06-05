/**
 * Simple in-memory rate limiter for /search command
 * Prevents spam: max 5 searches per minute per user
 */

const userSearches = new Map(); // userId -> { count, resetAt }
const MAX_SEARCHES_PER_MINUTE = 5;

/**
 * Check if user exceeded rate limit
 */
function isRateLimited(telegramId) {
  const now = Date.now();

  if (!userSearches.has(telegramId)) {
    userSearches.set(telegramId, {
      count: 1,
      resetAt: now + 60000,
    });
    return false;
  }

  const record = userSearches.get(telegramId);

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + 60000;
    return false;
  }

  record.count++;
  return record.count > MAX_SEARCHES_PER_MINUTE;
}

/**
 * Middleware for rate limiting
 */
function rateLimitMiddleware() {
  return (ctx, next) => {
    if (ctx.message?.text?.startsWith("/search")) {
      if (isRateLimited(ctx.from.id)) {
        return ctx.reply(
          "⏳ Too many searches. Please wait a moment and try again.\n\n_Limit: 5 searches per minute_",
          { parse_mode: "Markdown" },
        );
      }
    }
    return next();
  };
}

module.exports = { rateLimitMiddleware };
