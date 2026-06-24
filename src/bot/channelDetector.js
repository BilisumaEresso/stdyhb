const ChannelRecommendation = require("../db/models/ChannelRecommendation");
const TelegramChannel = require("../db/models/TelegramChannel");

// Patterns that clearly identify a Telegram channel link or username
const T_ME_REGEX = /(?:https?:\/\/)?t\.me\/([a-zA-Z][a-zA-Z0-9_]{3,31})/i;
const USERNAME_REGEX = /^@([a-zA-Z][a-zA-Z0-9_]{3,31})$/;

/**
 * Returns { isChannel: true, username: "channelname" } or { isChannel: false }
 * Does NOT do any network validation — purely text pattern matching.
 */
function detectChannelInput(text) {
  if (!text) return { isChannel: false };

  const trimmed = text.trim();

  // t.me link
  const tmeMatch = trimmed.match(T_ME_REGEX);
  if (tmeMatch) return { isChannel: true, username: tmeMatch[1].toLowerCase() };

  // @username
  const atMatch = trimmed.match(USERNAME_REGEX);
  if (atMatch) return { isChannel: true, username: atMatch[1].toLowerCase() };

  return { isChannel: false };
}

/**
 * Checks MongoDB only (no network). Returns:
 *   "already_active"    — channel already in our system
 *   "already_pending"   — recommendation already submitted
 *   "ok"                — not seen before
 */
async function checkDuplicates(username) {
  const [existingChan, existingRec] = await Promise.all([
    TelegramChannel.findOne({ username }),
    ChannelRecommendation.findOne({
      channelUsername: username,
      status: "pending",
    }),
  ]);
  if (existingChan) return "already_active";
  if (existingRec) return "already_pending";
  return "ok";
}

/**
 * Attempts GramJS validation. Returns:
 *   { valid: true,  title, participantsCount }
 *   { valid: false, reason: "not_found" | "not_channel" | "gramjs_unavailable" | "error" }
 *
 * Never throws — all errors are caught and returned as { valid: false }.
 */
async function validateWithGramJS(username) {
  try {
    const { getClient } = require("../search/telegramIndexer");
    const tg = await getClient();
    const entity = await tg.getEntity(`@${username}`);

    // GramJS entity types: Channel (broadcast=true), Chat, User
    if (!entity || entity.className === "User") {
      return { valid: false, reason: "not_channel" };
    }
    if (entity.className === "Chat") {
      return { valid: false, reason: "not_channel" };
    }
    // Channel with broadcast flag = public channel
    if (entity.className === "Channel") {
      if (!entity.broadcast) {
        // It's a supergroup, not a broadcast channel
        return { valid: false, reason: "not_channel" };
      }
      return {
        valid: true,
        title: entity.title || username,
        participantsCount: entity.participantsCount || null,
      };
    }
    return { valid: false, reason: "not_found" };
  } catch (err) {
    if (
      err.message &&
      (err.message.includes("USERNAME_NOT_OCCUPIED") ||
        err.message.includes("Cannot find any entity") ||
        err.message.includes("USERNAME_INVALID"))
    ) {
      return { valid: false, reason: "not_found" };
    }
    // GramJS is down / session issue — don't block the recommendation, just skip validation
    if (
      err.message &&
      (err.message.includes("AUTH_KEY") ||
        err.message.includes("not connected") ||
        err.message.includes("TIMEOUT"))
    ) {
      return { valid: false, reason: "gramjs_unavailable" };
    }
    console.warn(
      `[ChannelDetector] GramJS validation error for @${username}:`,
      err.message,
    );
    return { valid: false, reason: "error" };
  }
}

module.exports = { detectChannelInput, checkDuplicates, validateWithGramJS };
