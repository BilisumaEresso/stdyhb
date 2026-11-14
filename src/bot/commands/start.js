const userService = require("../../services/user.service");
const LABELS = require("../keyboardLabels");
const { Markup } = require("telegraf");
const templates = require("../../telegram/templates");
const fileDelivery = require("../../telegram/fileDelivery");
const { getMainKeyboard } = require("../keyboards");

async function startCommand(ctx, skipWizard = false) {
  try {
    const telegramUser = ctx.from;
    const user = await userService.getOrCreateUser(telegramUser);

    // Answer callback query if invoked from inline button
    if (ctx.answerCbQuery) {
      await ctx.answerCbQuery().catch(() => {});
    }

    // Ensure the native [Menu] drawer button is active in private chat
    if (ctx.chat && ctx.chat.type === "private" && typeof ctx.setChatMenuButton === "function") {
      ctx.setChatMenuButton({ type: "commands" }).catch(() => {});
    }

    // Check for deep-link payload (e.g. /start get_<id> from inline search)
    const payload = (
      ctx.payload ||
      (ctx.message && ctx.message.text ? ctx.message.text.split(" ")[1] : "") ||
      ""
    ).trim();

    if (payload.startsWith("get_") || payload.startsWith("dl_")) {
      const resourceId = payload.startsWith("get_") ? payload.substring(4) : payload.substring(3);
      // Auto-detect if this resource belongs to an exam group album
      const TelegramResource = require("../../db/models/TelegramResource");
      const resItem = await TelegramResource.findById(resourceId).select("groupId").lean().catch(() => null);
      if (resItem && resItem.groupId) {
        return await fileDelivery.handleGroupDownload(ctx, resourceId);
      }
      return await fileDelivery.handleDownload(ctx, resourceId);
    } else if (payload.startsWith("grp_")) {
      const resourceId = payload.substring(4);
      return await fileDelivery.handleGroupDownload(ctx, resourceId);
    }

    // Enter onboarding wizard if no university is set and they didn't just skip it
    if (!skipWizard && (!user.university || user.university === "")) {
      return ctx.scene.enter("onboarding");
    }

    const keyboard = getMainKeyboard();

    // Decide which welcome message to send
    const messageText =
      user.searchCount === 0
        ? templates.welcomeNew(user)
        : templates.welcomeReturning(user);

    await ctx.reply(messageText, {
      parse_mode: "HTML",
      ...keyboard,
    });
  } catch (error) {
    console.error("Error in /start command:", error);
    await ctx.reply(templates.renderError(), { parse_mode: "HTML" });
  }
}

module.exports = startCommand;
