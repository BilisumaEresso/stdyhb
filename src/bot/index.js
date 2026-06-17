const { Telegraf, session, Scenes } = require("telegraf");
const { setBot } = require("./botInstance");
const startCommand = require("./commands/start");
const { searchCommand, performSearch } = require("./commands/search");
const adminCommands = require("./commands/admin");
const profileCommand = require("./commands/profile");
const helpCommand = require("./commands/help");
const savesCommand = require("./commands/saves");
const onboardingWizard = require("./scenes/onboarding");
const recommendWizard = require("./scenes/recommend");
const { registerFileDeliveryHandlers } = require("../telegram/fileDelivery");
const { rateLimitMiddleware } = require("../middleware/rateLimiter");

const bot = new Telegraf(process.env.BOT_TOKEN);
setBot(bot);


// Apply session and scene middleware
const stage = new Scenes.Stage([onboardingWizard, recommendWizard]);
bot.use(session());
bot.use(stage.middleware());

// Apply rate limiting middleware
bot.use(rateLimitMiddleware());

// Register public commands
bot.start((ctx) => startCommand(ctx, false)); // Pass skipWizard=false by default
bot.command("search", searchCommand);
bot.command("profile", profileCommand);
bot.command("help", helpCommand);
bot.command("saves", savesCommand);

bot.action("edit_profile", (ctx) => {
  ctx.answerCbQuery().catch(()=> {});
  ctx.scene.enter("onboarding");
});

// Register admin commands
bot.command("addchannel", adminCommands.isAdmin, adminCommands.addChannelCommand);
bot.command("removechannel", adminCommands.isAdmin, adminCommands.removeChannelCommand);
bot.command("listchannels", adminCommands.isAdmin, adminCommands.listChannelsCommand);
bot.command("forcescan", adminCommands.isAdmin, adminCommands.forceScanCommand);
adminCommands.registerAdminActionHandlers(bot);

// Register file delivery handlers (for inline buttons)
registerFileDeliveryHandlers(bot);

// Catch plain text for searching
bot.on("text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);

  if (text.startsWith("/")) return next();
  if (ctx.chat.id === relayGroupId) return next();

  if (text === "🔍 Search Resources") {
    return ctx.reply("Type anything to search — e.g. 'dbms exam' or 'networking notes'");
  } else if (text === "📚 My Saves") {
    return savesCommand(ctx);
  } else if (text === "📢 Recommend Channel") {
    return ctx.scene.enter("recommendChannel");
  } else if (text === "❓ Help") {
    return helpCommand(ctx);
  }

  if (text.length < 2) return next();

  await performSearch(ctx, text);
});

module.exports = bot;
