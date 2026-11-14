/**
 * StudyHub Telegram Bot Menu & Commands Configuration
 *
 * Configures Telegram's native commands list (setMyCommands) and
 * ensures the Chat Menu Button is set to the standard "commands" drawer
 * rather than being hijacked by a web_app launcher button.
 */

const BOT_COMMANDS = [
  { command: "start", description: "🚀 Start StudyHub & Open Main Menu" },
  { command: "search", description: "🔍 Search exams, lecture notes & slides" },
  { command: "menu", description: "📋 Show persistent keyboard & menu" },
  { command: "web", description: "🌐 Launch StudyHub Web & Mini App" },
  { command: "saves", description: "📚 View your saved bookmarks" },
  { command: "trending", description: "🔥 Popular & trending study materials" },
  { command: "recent", description: "🆕 Freshly indexed study resources" },
  { command: "profile", description: "👤 View & update your campus profile" },
  { command: "help", description: "❓ Help center & search guide" },
  { command: "about", description: "ℹ️ About StudyHub platform & specs" },
];

/**
 * Configure Telegram Bot menu button and command list.
 *
 * @param {import('telegraf').Telegraf} bot
 * @param {number} retries
 * @param {number} delay
 */
async function configureTelegramMenu(bot, retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // 1. Force Chat Menu Button to "commands" drawer
      // This restores the standard [Menu] drawer button beside the text input,
      // preventing Telegram from replacing it with a single web_app launcher.
      await bot.telegram.setChatMenuButton({
        menuButton: {
          type: "commands",
        },
      });
      console.log("✅ Chat Menu Button configured to Commands Drawer (type: commands)");

      // 2. Register native Telegram commands list
      await bot.telegram.setMyCommands(BOT_COMMANDS);
      console.log(`✅ Registered ${BOT_COMMANDS.length} bot commands with Telegram`);
      return true;
    } catch (err) {
      console.warn(
        `⚠️ Telegram menu configuration attempt ${attempt}/${retries} failed:`,
        err.message
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delay * attempt));
      }
    }
  }
  return false;
}

module.exports = {
  BOT_COMMANDS,
  configureTelegramMenu,
};
