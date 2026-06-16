const { Telegraf } = require("telegraf");
const startCommand = require("./commands/start");
const searchCommand = require("./commands/search");
const adminCommands = require("./commands/admin");
const { registerFileDeliveryHandlers } = require("../telegram/fileDelivery");
const { rateLimitMiddleware } = require("../middleware/rateLimiter");

const bot = new Telegraf(process.env.BOT_TOKEN);

// Apply rate limiting middleware
bot.use(rateLimitMiddleware());

// Register public commands
bot.start(startCommand);
bot.command("search", searchCommand);

// Register admin commands
bot.command("addchannel", adminCommands.isAdmin, adminCommands.addChannelCommand);
bot.command("removechannel", adminCommands.isAdmin, adminCommands.removeChannelCommand);
bot.command("listchannels", adminCommands.isAdmin, adminCommands.listChannelsCommand);
bot.command("forcescan", adminCommands.isAdmin, adminCommands.forceScanCommand);

// Register file delivery handlers (for inline buttons)
registerFileDeliveryHandlers(bot);

module.exports = bot;
