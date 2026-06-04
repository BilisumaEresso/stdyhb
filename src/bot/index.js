const { Telegraf } = require("telegraf");
const startCommand = require("./commands/start");
const searchCommand = require("./commands/search");
const { registerFileDeliveryHandlers } = require("../telegram/fileDelivery");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Register commands
bot.start(startCommand);
bot.command("search", searchCommand);

// Register file delivery handlers (for inline buttons)
registerFileDeliveryHandlers(bot);

// Add other commands here in the future
// bot.command("save", saveCommand);
// etc.

module.exports = bot;
