const { Markup } = require("telegraf");
const LABELS = require("./keyboardLabels");

/**
 * Returns the persistent reply keyboard for StudyHub.
 *
 * Configured with:
 * - resize: fits screen size cleanly without unnecessary vertical bulk
 * - persistent: keeps the keyboard permanently pinned below input (Telegram Bot API 6.0+)
 * - placeholder: guides the user on what to type in the message input
 */
function getMainKeyboard() {
  const webAppUrl = process.env.WEB_APP_URL || "https://webstudyhub.vercel.app";
  return Markup.keyboard([
    [Markup.button.webApp("🌐 Open Web App", webAppUrl), LABELS.SEARCH],
    [LABELS.SAVES, LABELS.RECOMMEND],
    [LABELS.PROFILE, LABELS.HELP],
  ])
    .resize()
    .persistent()
    .placeholder("🔍 Search past exams, lecture notes, slides...");
}

module.exports = {
  getMainKeyboard,
};
