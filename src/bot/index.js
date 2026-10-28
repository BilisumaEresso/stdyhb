const { Telegraf, session, Scenes } = require("telegraf");
const { setBot } = require("./botInstance");
const startCommand = require("./commands/start");
const {
  searchCommand,
  performSearch,
  showSearchScreen,
  registerSearchHandlers,
} = require("./commands/search");
const adminCommands = require("./commands/admin");
const profileCommand = require("./commands/profile");
const trendingCommand = require("./commands/trending");
const recentCommand = require("./commands/recent");
const {
  helpCommand,
  aboutCommand,
  developerCommand,
  registerHelpHandlers,
} = require("./commands/help");
const savesCommand = require("./commands/saves");
const { broadcastCommand, registerBroadcastHandlers } = require("./commands/broadcast");
const onboardingWizard = require("./scenes/onboarding");
const recommendWizard = require("./scenes/recommend");
const { registerFileDeliveryHandlers } = require("../telegram/fileDelivery");
const { handleInlineQuery } = require("./inline/inlineQuery");
const { rateLimitMiddleware } = require("../middleware/rateLimiter");
const LABELS = require("./keyboardLabels");

const bot = new Telegraf(process.env.BOT_TOKEN);
setBot(bot);

// Apply session and scene middleware
const stage = new Scenes.Stage([onboardingWizard, recommendWizard]);

// Global Error Handler for Telegraf
bot.catch((err, ctx) => {
  console.error(`[FATAL-TELEGRAF] Error for ${ctx?.updateType}`, err);
  // Log to admin panel
  adminCommands.pushAdminLog("error", `${err.message} — ${ctx?.updateType}`);
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

// Global ban enforcement middleware
bot.use(async (ctx, next) => {
  if (!ctx.from || adminCommands.isAdminId(ctx.from.id)) {
    return next();
  }
  try {
    const user = await userService.findByTelegramId(ctx.from.id);
    if (user && user.isBanned) {
      if (ctx.callbackQuery) {
        return ctx.answerCbQuery(
          "⛔ Your StudyHub account has been suspended.",
          { show_alert: true },
        );
      }
      return ctx.reply(
        "⛔ <b>Account Suspended</b>\n\nYour StudyHub account has been suspended by an administrator.",
        { parse_mode: "HTML" },
      );
    }
  } catch (err) {
    // Fail-open for safety
  }
  return next();
});

// Register public commands
bot.start((ctx) => startCommand(ctx, false)); // Pass skipWizard=false by default
bot.command("search", searchCommand);
bot.command("profile", profileCommand);
bot.command("trending", trendingCommand);
bot.command("recent", recentCommand);
bot.command("help", helpCommand);
bot.command("about", aboutCommand);
bot.command("developer", developerCommand);
bot.command("dev", developerCommand);
bot.command("saves", savesCommand);

bot.action("edit_profile", (ctx) => {
  ctx.answerCbQuery().catch(() => {});
  ctx.scene.enter("onboarding");
});

bot.action("nav_saves", async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  return savesCommand(ctx);
});

bot.action("nav_main", async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  return startCommand(ctx, true);
});

// Register unified interactive Help, About, and Developer handlers
registerHelpHandlers(bot);

// Register admin commands
bot.command("admin", adminCommands.isAdmin, adminCommands.adminPanelCommand);
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
bot.command("channels", adminCommands.isAdmin, adminCommands.channelsCommand);
bot.command(
  "listchannels",
  adminCommands.isAdmin,
  adminCommands.channelsCommand,
);
bot.command("forcescan", adminCommands.isAdmin, adminCommands.forceScanCommand);
bot.command("pendingchannels", adminCommands.isAdmin, adminCommands.pendingChannelsCommand);
bot.command("reports", adminCommands.isAdmin, adminCommands.reportsCommand);
bot.command("archive", adminCommands.isAdmin, adminCommands.archiveCommand);
bot.command("user", adminCommands.isAdmin, adminCommands.userInspectorCommand);
bot.command("users", adminCommands.isAdmin, adminCommands.usersCommand);
bot.command("indexstatus", adminCommands.isAdmin, adminCommands.indexStatusCommand);
bot.command("broadcast", adminCommands.isAdmin, broadcastCommand);
bot.on("message", (ctx, next) => {
  const caption = ctx.message?.caption;
  if (caption && caption.trim().startsWith("/broadcast")) {
    return adminCommands.isAdmin(ctx, () => broadcastCommand(ctx));
  }
  return next();
});
adminCommands.registerAdminActionHandlers(bot);
adminCommands.registerAdminPanelHandlers(bot);
registerBroadcastHandlers(bot);

// Register file delivery handlers (for inline buttons)
registerFileDeliveryHandlers(bot);
registerSearchHandlers(bot);

// Register Telegram inline query mode (@StudyHubBot <query>)
bot.on("inline_query", handleInlineQuery);

// Catch plain text for searching
const { detectChannelInput } = require("./channelDetector");
const { quickRecommend } = require("./commands/quickRecommend");

bot.on("text", async (ctx, next) => {
  const text = ctx.message.text.trim();
  const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);

  // 1. Never intercept messages sent via inline bots (prevent recursive re-search)
  if (ctx.message.via_bot) return next();

  // 2. Ignore commands or relay group internal traffic
  if (text.startsWith("/")) return next();
  if (ctx.chat.id === relayGroupId) return next();

  // 3. Handle persistent keyboard buttons (only in private chat)
  if (ctx.chat.type === "private") {
    if (text === LABELS.SEARCH) {
      return showSearchScreen(ctx);
    } else if (text === LABELS.SAVES) {
      return savesCommand(ctx);
    } else if (text === LABELS.RECOMMEND) {
      return ctx.scene.enter("recommendChannel");
    } else if (text === LABELS.PROFILE) {
      return profileCommand(ctx);
    } else if (text === LABELS.TRENDING) {
      return trendingCommand(ctx);
    } else if (text === LABELS.HELP) {
      return helpCommand(ctx);
    }
  }

  // 4. Group / Supergroup privacy filter:
  // In groups, DO NOT treat casual conversation as search queries.
  // Only trigger if bot is mentioned by username or if replying to the bot.
  if (ctx.chat.type !== "private") {
    const botUsername =
      (ctx.botInfo && ctx.botInfo.username) ||
      process.env.BOT_USERNAME ||
      "StudyHubBot";

    const mentionPrefix = `@${botUsername.toLowerCase()}`;
    const textLower = text.toLowerCase();
    const isMentioned = textLower.startsWith(mentionPrefix);
    const isReplyToBot =
      ctx.message.reply_to_message &&
      ctx.message.reply_to_message.from &&
      ctx.message.reply_to_message.from.is_bot &&
      ctx.message.reply_to_message.from.username?.toLowerCase() === botUsername.toLowerCase();

    if (isMentioned) {
      const strippedQuery = text.substring(mentionPrefix.length).trim();
      if (strippedQuery.length >= 2) {
        return await performSearch(ctx, strippedQuery);
      } else {
        return await ctx.reply(
          `💡 <b>How to search in groups:</b>\nType <code>@${botUsername} &lt;subject&gt;</code> or <code>/search &lt;subject&gt;</code>\n<i>Example: /search general physics</i>`,
          { parse_mode: "HTML" }
        );
      }
    } else if (isReplyToBot && text.length >= 2) {
      return await performSearch(ctx, text);
    } else {
      // Regular group chatter — ignore!
      return next();
    }
  }

  // 5. Private chat text search:
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
