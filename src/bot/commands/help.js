const { Markup } = require("telegraf");
const packageInfo = require("../../../package.json");
const TelegramResource = require("../../db/models/TelegramResource");
const TelegramChannel = require("../../db/models/TelegramChannel");
const { isAdminUser } = require("./admin");

/**
 * Escape HTML special characters
 */
function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Fetch live system stats for the About screen
 */
async function getLiveSystemStats() {
  try {
    const [totalResources, totalChannels] = await Promise.all([
      TelegramResource.countDocuments(),
      TelegramChannel.countDocuments({ active: true }),
    ]);
    return {
      totalResources: totalResources || 0,
      totalChannels: totalChannels || 0,
    };
  } catch (err) {
    return { totalResources: 0, totalChannels: 0 };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW RENDERERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Main Help Center Hub
 */
function renderHelpHub(isAdmin = false) {
  const version = packageInfo.version || "2.0.0";

  let text = `📚 <b>StudyHub ${version} — Academic Help Center</b>\n\n`;
  text += `Welcome to StudyHub, your high-speed academic search engine designed for Ethiopian university students.\n\n`;

  text += `<b>Quick Navigation:</b>\n`;
  text += `🔍 <b>Search Guide</b> — How to find exams, lecture notes, slides & photo bundles\n`;
  text += `⌨️ <b>Commands Reference</b> — All personal, group, and management shortcuts\n`;
  text += `ℹ️ <b>About StudyHub</b> — System architecture, live repository stats & mission\n`;
  text += `👨‍💻 <b>About Developer</b> — Meet the creator, vision, tech stack & contact\n\n`;

  text += `💡 <i>Pro Tip: You can search directly by typing any topic or course code (e.g. <code>CS301</code>, <code>General Physics</code>, <code>DBMS Final Exam</code>).</i>`;

  if (isAdmin) {
    text += `\n\n🛡️ <b>Admin Operator:</b> You have access to administrative controls and diagnostics.`;
  }

  const contactUrl =
    process.env.ADMIN_TELEGRAM_URL ||
    process.env.DEVELOPER_TELEGRAM_URL ||
    "https://t.me/Ethiel_Academy";

  const rows = [
    [
      Markup.button.callback("🔍 Search Guide", "help_search"),
      Markup.button.callback("⌨️ Commands Reference", "help_commands"),
    ],
    [
      Markup.button.callback("ℹ️ About StudyHub", "about_studyhub"),
      Markup.button.callback("👨‍💻 About Developer", "about_developer"),
    ],
  ];

  if (isAdmin) {
    rows.push([
      Markup.button.callback("🛡️ Admin Panel", "admin_panel"),
      Markup.button.url("📬 Support & Feedback", contactUrl),
    ]);
    rows.push([Markup.button.callback("◀ Main Menu", "nav_main")]);
  } else {
    rows.push([
      Markup.button.url("📬 Support & Feedback", contactUrl),
      Markup.button.callback("◀ Main Menu", "nav_main"),
    ]);
  }

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

/**
 * 2. Search Mastery Guide
 */
function renderSearchGuide(isAdmin = false) {
  let text = `🔍 <b>StudyHub Search Mastery Guide</b>\n\n`;

  text += `<b>1. Natural Query Search (Private Chat)</b>\n`;
  text += `Just type any topic, subject, or course code directly — no command required:\n`;
  text += `• <code>calculus 1 final exam</code>\n`;
  text += `• <code>networking slides lecture 4</code>\n`;
  text += `• <code>dbms midterm solved</code>\n\n`;

  text += `<b>2. Inline Search in Any Chat (@bot)</b>\n`;
  text += `Search and share past exams in any group or Saved Messages:\n`;
  text += `• Type <code>@${process.env.BOT_USERNAME || "studyhub_resource_bot"} physics</code>\n`;
  text += `• Tap any result to share the card instantly with a download link.\n\n`;

  text += `<b>3. Category Filter Pills</b>\n`;
  text += `Narrow your search results in 1 tap:\n`;
  text += `• <b>[🎓 Exams]</b> — Midterms, finals, exit exams & solution sheets\n`;
  text += `• <b>[📊 Slides]</b> — Lecture presentations & chapter slides\n`;
  text += `• <b>[📄 Notes]</b> — PDF handouts & reference summaries\n`;
  text += `• <b>[🏛️ My Campus]</b> — Materials specifically from your university\n\n`;

  text += `<b>4. Multi-Page Photo Exam Bundles</b>\n`;
  text += `Exam questions shared as photo sets are automatically grouped into clean, organized albums so you never get missing pages.\n\n`;

  text += `<b>5. Group Chat Search</b>\n`;
  text += `In groups, use <code>/search &lt;topic&gt;</code> or mention <code>@${process.env.BOT_USERNAME || "studyhub_resource_bot"} &lt;topic&gt;</code> to collaborate with classmates!`;

  const rows = [
    [
      Markup.button.callback("⌨️ Commands Reference", "help_commands"),
      Markup.button.callback("ℹ️ About StudyHub", "about_studyhub"),
    ],
    [Markup.button.callback("◀ Back to Help Center", "help_main")],
  ];

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

/**
 * 3. Commands Reference Guide
 */
function renderCommandsGuide(isAdmin = false) {
  let text = `⌨️ <b>StudyHub Commands Reference</b>\n\n`;

  text += `<b>🎓 Student Commands:</b>\n`;
  text += `• <code>/search &lt;query&gt;</code> — Search past exams, slides, and lecture notes\n`;
  text += `• <code>/saves</code> — View and manage your saved bookmarks\n`;
  text += `• <code>/profile</code> — View and update your campus/department\n`;
  text += `• <code>/trending</code> — Browse this week's most downloaded study materials\n`;
  text += `• <code>/recent</code> — See the freshest materials indexed today\n`;
  text += `• <code>/help</code> — Open the interactive Help Center\n`;
  text += `• <code>/about</code> — About StudyHub system specs & version\n`;
  text += `• <code>/developer</code> — About the developer (Billy)\n\n`;

  text += `<b>👥 Group Collaboration:</b>\n`;
  text += `• <code>/search &lt;topic&gt;</code> — Search materials directly in group chat\n`;
  text += `• <code>@${process.env.BOT_USERNAME || "studyhub_resource_bot"} &lt;topic&gt;</code> — Inline query popup in any chat\n\n`;

  if (isAdmin) {
    text += `<b>🛡️ Administrator Management Commands:</b>\n`;
    text += `• <code>/admin</code> — Main administrative control panel\n`;
    text += `• <code>/channels</code> — Interactive channel manager & crawler\n`;
    text += `• <code>/users</code> — Student registry & user actions (warning, ban, history)\n`;
    text += `• <code>/broadcast</code> — Multi-format broadcast engine (reply/photo/doc)\n`;
    text += `• <code>/archive</code> — Backup archive monitor & 1-tap mobile backfill\n`;
    text += `• <code>/reports</code> — Student broken file reports dashboard\n`;
    text += `• <code>/indexstatus</code> — Live MTProto indexer diagnostics & abort\n\n`;
  }

  text += `<i>Tip: In 1-on-1 private chat, you can also use the persistent menu buttons below your text input.</i>`;

  const rows = [
    [
      Markup.button.callback("🔍 Search Guide", "help_search"),
      Markup.button.callback("👨‍💻 About Developer", "about_developer"),
    ],
    [Markup.button.callback("◀ Back to Help Center", "help_main")],
  ];

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

/**
 * 4. About StudyHub System View
 */
function renderAboutView(stats = { totalResources: 0, totalChannels: 0 }, isAdmin = false) {
  const version = packageInfo.version || "2.0.0";
  const contactUrl =
    process.env.ADMIN_TELEGRAM_URL ||
    process.env.DEVELOPER_TELEGRAM_URL ||
    "https://t.me/Ethiel_Academy";

  let text = `ℹ️ <b>About StudyHub</b>\n\n`;
  text += `StudyHub is an academic search engine and open educational repository indexer built for Ethiopian university students.\n\n`;

  text += `✨ <b>System Highlights:</b>\n`;
  text += `• <b>Version:</b> <code>v${version} (StudyHub 2.0)</code>\n`;
  text += `• <b>Engine:</b> Fault-tolerant GramJS MTProto crawler with archive backup\n`;
  text += `• <b>Search:</b> Typo-tolerant lexical scoring with campus affinity weighting\n`;
  text += `• <b>Delivery:</b> Native Telegram Media Group album grouping & zero-loss forwarding\n\n`;

  text += `📊 <b>Live Repository Metrics:</b>\n`;
  text += `• 📚 Indexed Study Resources: <b>${stats.totalResources.toLocaleString()}</b>\n`;
  text += `• 📡 Monitored University Channels: <b>${stats.totalChannels.toLocaleString()}</b>\n`;
  text += `• 🏛️ Supported Campuses: AASTU, AAU, ASTU, Hawassa, Jimma, Bahir Dar & more\n\n`;

  text += `⚖️ <b>Open Access Mission:</b>\n`;
  text += `StudyHub does not host files on private servers; it indexes and curates publicly shared educational resources from Telegram channels to ensure every student has equal access to past exams and study materials.`;

  const rows = [
    [
      Markup.button.callback("👨‍💻 About Developer", "about_developer"),
      Markup.button.callback("🔍 Search Guide", "help_search"),
    ],
    [
      Markup.button.url("📬 Support & Contact", contactUrl),
      Markup.button.callback("◀ Back to Help", "help_main"),
    ],
  ];

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

/**
 * 5. About Developer View
 */
function renderDeveloperView(isAdmin = false) {
  const authorName = packageInfo.author || "Billy (Bilisuma Eresso)";
  const portfolioUrl =
    process.env.DEVELOPER_PORTFOLIO_URL ||
    packageInfo.homepage ||
    "https://bilisumaeresso.vercel.app";
  const contactUrl =
    process.env.DEVELOPER_TELEGRAM_URL ||
    process.env.ADMIN_TELEGRAM_URL ||
    "https://t.me/Ethiel_Academy";
  const githubUrl =
    process.env.GITHUB_REPO_URL || "https://github.com/studyhub";

  let text = `👨‍💻 <b>About the Developer</b>\n\n`;

  text += `<b>Lead Engineer:</b> <b>${escapeHtml(authorName)}</b>\n`;
  text += `<b>Role:</b> Full-Stack Software Engineer & AI Systems Developer\n`;
  text += `<b>Portfolio:</b> <a href="${portfolioUrl}">${portfolioUrl.replace(/^https?:\/\//, "")}</a>\n`;
  text += `<b>Project:</b> StudyHub Academic Repository Indexer (v${packageInfo.version || "2.0.0"})\n\n`;

  text += `🛠 <b>Core Technologies:</b>\n`;
  text += `• <b>Backend:</b> Node.js, Express, JavaScript (ES2024)\n`;
  text += `• <b>Telegram Engine:</b> Telegraf, GramJS MTProto Client\n`;
  text += `• <b>Database:</b> MongoDB Atlas with Mongoose ODM\n`;
  text += `• <b>Indexing:</b> Distributed background workers, fault-tolerant failovers\n\n`;

  text += `🎯 <b>Vision & Commitment:</b>\n`;
  text += `<i>"Educational materials should be freely accessible to every student, everywhere. StudyHub was engineered to eliminate the struggle of hunting through dozens of unorganized Telegram channels by providing instant, unified search."</i>\n\n`;

  text += `📬 <b>Connect & Collaborate:</b>\n`;
  text += `Feel free to explore my portfolio, reach out for feature suggestions, channel partnerships, or open-source collaboration!`;

  const rows = [
    [
      Markup.button.url("🌐 Developer Portfolio", portfolioUrl),
      Markup.button.url("💬 Contact Billy (Telegram)", contactUrl),
    ],
    [
      Markup.button.callback("ℹ️ About StudyHub", "about_studyhub"),
      Markup.button.callback("◀ Back to Help", "help_main"),
    ],
  ];

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

// ─────────────────────────────────────────────────────────────────────────────
// TOP-LEVEL COMMAND HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * /help command handler
 */
async function helpCommand(ctx) {
  try {
    const isAdmin = isAdminUser(ctx.from?.id);
    const view = renderHelpHub(isAdmin);
    const isCallback = Boolean(ctx.callbackQuery || ctx.updateType === "callback_query");

    if (isCallback) {
      await ctx
        .editMessageText(view.text, {
          parse_mode: "HTML",
          ...view.keyboard,
        })
        .catch(async () => {
          if (ctx.reply) {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          }
        });
      if (ctx.answerCbQuery) {
        await ctx.answerCbQuery().catch(() => {});
      }
    } else {
      await ctx.reply(view.text, {
        parse_mode: "HTML",
        ...view.keyboard,
      });
    }
  } catch (error) {
    console.error("[HelpCommand] Error:", error);
    if (ctx.reply) {
      await ctx.reply("❌ Error opening Help Center.").catch(() => {});
    }
  }
}

/**
 * /about command handler
 */
async function aboutCommand(ctx) {
  try {
    const isAdmin = isAdminUser(ctx.from?.id);
    const stats = await getLiveSystemStats();
    const view = renderAboutView(stats, isAdmin);
    const isCallback = Boolean(ctx.callbackQuery || ctx.updateType === "callback_query");

    if (isCallback) {
      await ctx
        .editMessageText(view.text, {
          parse_mode: "HTML",
          ...view.keyboard,
        })
        .catch(async () => {
          if (ctx.reply) {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          }
        });
      if (ctx.answerCbQuery) {
        await ctx.answerCbQuery().catch(() => {});
      }
    } else {
      await ctx.reply(view.text, {
        parse_mode: "HTML",
        ...view.keyboard,
      });
    }
  } catch (error) {
    console.error("[AboutCommand] Error:", error);
    if (ctx.reply) {
      await ctx.reply("❌ Error loading About StudyHub.").catch(() => {});
    }
  }
}

/**
 * /developer command handler
 */
async function developerCommand(ctx) {
  try {
    const isAdmin = isAdminUser(ctx.from?.id);
    const view = renderDeveloperView(isAdmin);
    const isCallback = Boolean(ctx.callbackQuery || ctx.updateType === "callback_query");

    if (isCallback) {
      await ctx
        .editMessageText(view.text, {
          parse_mode: "HTML",
          ...view.keyboard,
        })
        .catch(async () => {
          if (ctx.reply) {
            await ctx.reply(view.text, {
              parse_mode: "HTML",
              ...view.keyboard,
            });
          }
        });
      if (ctx.answerCbQuery) {
        await ctx.answerCbQuery().catch(() => {});
      }
    } else {
      await ctx.reply(view.text, {
        parse_mode: "HTML",
        ...view.keyboard,
      });
    }
  } catch (error) {
    console.error("[DeveloperCommand] Error:", error);
    if (ctx.reply) {
      await ctx.reply("❌ Error loading Developer info.").catch(() => {});
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION HANDLER REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

function registerHelpHandlers(bot) {
  bot.action("help_main", helpCommand);
  bot.action("nav_help", helpCommand);

  bot.action("help_search", async (ctx) => {
    try {
      const isAdmin = isAdminUser(ctx.from?.id);
      const view = renderSearchGuide(isAdmin);
      await ctx
        .editMessageText(view.text, {
          parse_mode: "HTML",
          ...view.keyboard,
        })
        .catch(async () => {
          await ctx.reply(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          });
        });
      await ctx.answerCbQuery().catch(() => {});
    } catch (err) {
      console.error("[HelpSearch] Error:", err);
      await ctx.answerCbQuery("❌ Error loading Search Guide", { show_alert: true });
    }
  });

  bot.action("help_commands", async (ctx) => {
    try {
      const isAdmin = isAdminUser(ctx.from?.id);
      const view = renderCommandsGuide(isAdmin);
      await ctx
        .editMessageText(view.text, {
          parse_mode: "HTML",
          ...view.keyboard,
        })
        .catch(async () => {
          await ctx.reply(view.text, {
            parse_mode: "HTML",
            ...view.keyboard,
          });
        });
      await ctx.answerCbQuery().catch(() => {});
    } catch (err) {
      console.error("[HelpCommands] Error:", err);
      await ctx.answerCbQuery("❌ Error loading Commands Guide", { show_alert: true });
    }
  });

  bot.action("about_studyhub", aboutCommand);
  bot.action("about_developer", developerCommand);
}

module.exports = {
  helpCommand,
  aboutCommand,
  developerCommand,
  renderHelpHub,
  renderSearchGuide,
  renderCommandsGuide,
  renderAboutView,
  renderDeveloperView,
  getLiveSystemStats,
  registerHelpHandlers,
};
