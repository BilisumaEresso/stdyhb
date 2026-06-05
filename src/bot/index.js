const { Telegraf } = require("telegraf");
const startCommand = require("./commands/start");
const searchCommand = require("./commands/search");
const { registerFileDeliveryHandlers } = require("../telegram/fileDelivery");
const { rateLimitMiddleware } = require("../middleware/rateLimiter");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Apply rate limiting middleware
bot.use(rateLimitMiddleware());

// Register commands
bot.start(startCommand);
bot.command("search", searchCommand);

// Register file delivery handlers (for inline buttons)
registerFileDeliveryHandlers(bot);

module.exports = bot;
