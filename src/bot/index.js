const { Telegraf, session, Scenes, Markup } = require("telegraf");
const { setBot } = require("./botInstance");
const startCommand = require("./commands/start");
const { searchCommand, performSearch } = require("./commands/search");
const adminCommands = require("./commands/admin");
const profileCommand = require("./commands/profile");
const helpCommand = require("./commands/help");
const savesCommand = require("./commands/saves");
const {
  broadcastCommand,
  registerBroadcastHandlers,
} = require("./commands/broadcast");
const onboardingWizard = require("./scenes/onboarding");
const recommendWizard = require("./scenes/recommend");
const { registerFileDeliveryHandlers } = require("../telegram/fileDelivery");
const { rateLimitMiddleware } = require("../middleware/rateLimiter");
const LABELS = require("./keyboardLabels");

const bot = new Telegraf(process.env.BOT_TOKEN);
setBot(bot);

// Apply session and scene middleware
const stage = new Scenes.Stage([onboardingWizard, recommendWizard]);

// Global Error Handler for Telegraf
bot.catch((err, ctx) => {
  console.error(`[FATAL-TELEGRAF] Error for ${ctx.updateType}`, err);
  if (ctx && ctx.reply) {
    ctx
      .reply(
        "⚠️ Something went wrong processing your request. Please try again.",
      )
      .catch(() => {});
  }
});

const BotSession = require("../db/models/BotSession");

const mongoSessionStore = {
  get: async (key) => {
    const sessionDoc = await BotSession.findOne({ key });
    return sessionDoc ? sessionDoc.data : undefined;
  },
  set: async (key, value) => {
    await BotSession.findOneAndUpdate(
      { key },
      { key, data: value, updatedAt: new Date() },
      { upsert: true },
    );
  },
  delete: async (key) => {
    await BotSession.deleteOne({ key });
  },
};

bot.use(session({ store: mongoSessionStore }));
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
  ctx.answerCbQuery().catch(() => {});
  ctx.scene.enter("onboarding");
});

bot.action("nav_main", async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  return startCommand(ctx, true);
});

bot.action("nav_saves", async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  return savesCommand(ctx);
});

bot.action("about_studyhub", async (ctx) => {
  await ctx.answerCbQuery();
  const aboutText =
    `<b>ℹ️ About StudyHub</b>\n\n` +
    `StudyHub is a Telegram bot built to help Ethiopian university students ` +
    `find study materials without digging through dozens of channels.\n\n` +
    `<b>Built by:</b> <a href="${process.env.ADMIN_TELEGRAM_URL || "#"}">Billy</a>\n` +
    `<b>Indexed resources:</b> 46,000+\n` +
    `<b>Channels monitored:</b> 30+\n` +
    `<b>Universities covered:</b> AAU, ASTU, JU, HU, MU, BDU and more\n\n` +
    `<i>If a resource is missing or broken, use the Recommend Channel ` +
    `feature to suggest a new source.</i>`;
  await ctx.reply(aboutText, {
    parse_mode: "HTML",
    reply_markup: Markup.inlineKeyboard([
      [
        Markup.button.url(
          "📬 Contact",
          process.env.ADMIN_TELEGRAM_URL || "https://t.me/",
        ),
      ],
    ]).reply_markup,
  });
});

// Register admin commands
bot.command(
  "addchannel",
  adminCommands.isAdmin,
  adminCommands.addChannelCommand,
);
bot.command(
  "removechannel",
  adminCommands.isAdmin,
  adminCommands.removeChannelCommand,
);
bot.command(
  "listchannels",
  adminCommands.isAdmin,
  adminCommands.listChannelsCommand,
);
bot.command("forcescan", adminCommands.isAdmin, adminCommands.forceScanCommand);
bot.command("broadcast", adminCommands.isAdmin, broadcastCommand);
adminCommands.registerAdminActionHandlers(bot);
registerBroadcastHandlers(bot);

// Register file delivery handlers (for inline buttons)
registerFileDeliveryHandlers(bot);

// Catch plain text for searching
const { detectChannelInput } = require("./channelDetector");
const { quickRecommend } = require("./commands/quickRecommend");

bot.on("text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);

  if (text.startsWith("/")) return next();
  if (ctx.chat.id === relayGroupId) return next();

  if (text === LABELS.SEARCH) {
    return ctx.reply(
      "Type anything to search — e.g. 'dbms exam' or 'networking notes'",
    );
  } else if (text === LABELS.SAVES) {
    return savesCommand(ctx);
  } else if (text === LABELS.RECOMMEND) {
    return ctx.scene.enter("recommendChannel");
  } else if (text === LABELS.HELP) {
    return helpCommand(ctx);
  } else if (text === LABELS.PROFILE) {
    return profileCommand(ctx);
  } else if (text === LABELS.TRENDING) {
    return ctx.reply("🔥 Trending coming soon! Use /trending for now.");
  }

  if (text.length < 2) return next();

  // Smart channel detection — intercept before search
  const detected = detectChannelInput(text);
  if (detected.isChannel) {
    return quickRecommend(ctx, detected.username);
  }

  await performSearch(ctx, text);
});

// Handle forwarded messages from channels — extract channel username directly
bot.on("message", async (ctx, next) => {
  const msg = ctx.message;
  const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
  if (ctx.chat.id === relayGroupId) return next();

  // Only care about forwarded channel messages
  const origin = msg?.forward_origin;
  if (!origin) return next();

  // forward_origin.type === "channel" means it was forwarded from a public channel
  if (origin.type === "channel" && origin.chat?.username) {
    const username = origin.chat.username.toLowerCase();
    return quickRecommend(ctx, username);
  }

  // forward_origin.type === "hidden_user" or "user" — forwarded from a person, not a channel
  if (origin.type !== "channel") {
    return ctx.reply(
      "ℹ️ That message was forwarded from a person or a private source, not a public channel.\n\nTo recommend a channel, forward a message <b>directly from the channel</b> or send its username/link.",
      { parse_mode: "HTML" },
    );
  }

  return next();
});

module.exports = bot;
