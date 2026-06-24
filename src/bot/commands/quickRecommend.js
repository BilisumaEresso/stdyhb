const { Markup } = require("telegraf");
const ChannelRecommendation = require("../../db/models/ChannelRecommendation");
const { notifyAdmin } = require("../../services/notify.service");
const userService = require("../../services/user.service");
const { checkDuplicates, validateWithGramJS } = require("../channelDetector");

/**
 * Handles a channel recommendation that came in through the smart-detect
 * path (user typed a link/username without going through the wizard).
 * Validates, saves, notifies admin — all in one go.
 */
async function quickRecommend(ctx, username) {
  // 1. Duplicate check (fast, DB only)
  const dupStatus = await checkDuplicates(username);
  if (dupStatus === "already_active") {
    return ctx.reply(
      `✅ <b>@${username}</b> is already indexed in StudyHub! You can search its resources right now.`,
      { parse_mode: "HTML" },
    );
  }
  if (dupStatus === "already_pending") {
    return ctx.reply(
      `⏳ <b>@${username}</b> has already been recommended and is waiting for admin review. Thanks!`,
      { parse_mode: "HTML" },
    );
  }

  // 2. GramJS validation (network — may be unavailable)
  const statusMsg = await ctx.reply(
    `🔍 Checking <code>@${username}</code>...`,
    { parse_mode: "HTML" },
  );

  const validation = await validateWithGramJS(username);

  const editStatus = (text) =>
    ctx.telegram
      .editMessageText(ctx.chat.id, statusMsg.message_id, null, text, {
        parse_mode: "HTML",
      })
      .catch(() => ctx.reply(text, { parse_mode: "HTML" }));

  if (validation.reason === "not_found") {
    return editStatus(
      `❌ <b>@${username}</b> doesn't exist on Telegram.\n\nDouble-check the username and try again.`,
    );
  }
  if (validation.reason === "not_channel") {
    return editStatus(
      `❌ <b>@${username}</b> is not a public channel — it looks like a group or a user account.\n\nStudyHub only indexes public broadcast channels.`,
    );
  }

  // 3. Save recommendation (with or without GramJS validation — if unavailable we still accept it)
  try {
    const user = await userService.findByTelegramId(ctx.from.id);
    const title = validation.valid ? validation.title : username;
    const sizeNote =
      validation.valid && validation.participantsCount
        ? ` · ${validation.participantsCount.toLocaleString()} members`
        : "";

    const rec = new ChannelRecommendation({
      channelUsername: username,
      type: "Other",
      university: "All Universities",
      recommendedBy: user._id,
    });
    await rec.save();

    notifyAdmin("CHANNEL_RECOMMENDATION", {
      channelUsername: username,
      channelTitle: title,
      userUsername: ctx.from.username,
      userId: ctx.from.id,
      type: "Other",
      university: "All Universities",
      recId: rec._id.toString(),
      validatedByGramJS: validation.valid,
      sizeNote,
    });

    const validationBadge = validation.valid
      ? `✅ Channel verified (${validation.participantsCount ? validation.participantsCount.toLocaleString() + " members" : "verified"})`
      : `⚠️ Could not verify automatically — admin will review`;

    return editStatus(
      `📢 <b>Thank you!</b> Your recommendation for <b>@${username}</b> has been submitted.\n\n` +
        `${validationBadge}\n\n` +
        `<i>If approved, it will be indexed and available for all students.</i>`,
    );
  } catch (err) {
    console.error("[QuickRecommend] Error saving:", err);
    return editStatus(
      `❌ Something went wrong saving your recommendation. Please try again.`,
    );
  }
}

module.exports = { quickRecommend };
