const userService = require("../../services/user.service");
const { Markup } = require("telegraf");
const templates = require("../../telegram/templates");

async function startCommand(ctx, skipWizard = false) {
  try {
    const telegramUser = ctx.from;
    const user = await userService.getOrCreateUser(telegramUser);

    // Enter onboarding wizard if no university is set and they didn't just skip it
    if (!skipWizard && (!user.university || user.university === "")) {
      return ctx.scene.enter("onboarding");
    }

    const keyboard = Markup.keyboard([
      ["🔍 Search Resources", "📚 My Saves"],
      ["📢 Recommend Channel", "❓ Help"]
    ]).resize();

    // Decide which welcome message to send
    const messageText = user.searchCount === 0 
      ? templates.welcomeNew(user) 
      : templates.welcomeReturning(user);

    await ctx.reply(messageText, {
      parse_mode: "HTML",
      ...keyboard
    });
  } catch (error) {
    console.error("Error in /start command:", error);
    await ctx.reply(templates.renderError(), { parse_mode: "HTML" });
  }
}

module.exports = startCommand;
