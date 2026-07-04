const TelegramChannel = require("../../db/models/TelegramChannel");
const TelegramResource = require("../../db/models/TelegramResource");
const User = require("../../db/models/User");
const ChannelRecommendation = require("../../db/models/ChannelRecommendation");
const {
  indexChannel,
  indexAllChannels,
  isIndexingInProgress,
} = require("../../search/telegramIndexer");
const { Markup } = require("telegraf");

// ─── Admin Logging ────────────────────────────────────────────────────────

const adminLogs = [];
const MAX_LOGS = 50;

function pushAdminLog(level, message) {
  adminLogs.push({ level, message, time: new Date() });
  if (adminLogs.length > MAX_LOGS) adminLogs.shift();
}

function getAdminLogs(count = 20) {
  return adminLogs.slice(-count).reverse();
}

// ─── Admin Authorization ─────────────────────────────────────────────────

/**
 * Helper to check if a Telegram ID is admin
 */
function isAdminId(id) {
  return String(id) === String(process.env.ADMIN_ID);
}

/**
 * Helper to synchronously check if a user is an admin
 */
const isAdminUser = (userId) => {
  const adminIds = process.env.ADMIN_ID ? process.env.ADMIN_ID.split(",") : [];
  return adminIds.includes(userId?.toString());
};

/**
 * Middleware to restrict commands to ADMIN_ID from .env
 */
const isAdmin = async (ctx, next) => {
  if (!isAdminUser(ctx.from?.id)) {
    return ctx.reply(
      "❌ Admin only. You are not authorized to use this command.",
    );
  }
  return next();
};

// ─── Admin Panel ─────────────────────────────────────────────────────────

/**
 * Generate the admin panel message with live stats
 */
async function getAdminPanelMessage() {
  try {
    const resourceCount = await TelegramResource.countDocuments();
    const userCount = await User.countDocuments();
    const channels = await TelegramChannel.find({});
    const activeCount = channels.filter(
      (c) => c.active && c.healthStatus !== "DEAD",
    ).length;
    const deadCount = channels.filter((c) => c.healthStatus === "DEAD").length;
    const indexing = isIndexingInProgress();

    const message =
      `🛠 <b>StudyHub Admin Panel</b>\n\n` +
      `📦 Resources: <b>${resourceCount.toLocaleString()}</b>\n` +
      `👥 Users: <b>${userCount.toLocaleString()}</b>\n` +
      `📡 Channels: <b>${activeCount}</b> active / <b>${deadCount}</b> dead\n` +
      `⏱ Indexer: ${indexing ? "🔄 <b>Running</b>" : "💤 <b>Idle</b>"}\n\n` +
      `<i>Last updated: ${new Date().toLocaleTimeString()}</i>`;

    return message;
  } catch (error) {
    console.error("[ADM-PANEL] Error generating message:", error);
    return "❌ Error loading panel. Try again.";
  }
}

/**
 * Send the admin panel
 */
const adminPanelCommand = async (ctx) => {
  try {
    const message = await getAdminPanelMessage();

    const keyboard = Markup.inlineKeyboard([
      // Stats & Monitoring
      [
        Markup.button.callback("📊 Full Stats", "adm_stats"),
        Markup.button.callback("🏥 Channel Health", "adm_health"),
      ],
      [
        Markup.button.callback("📋 Pending", "adm_pending"),
        Markup.button.callback("📜 Recent Logs", "adm_logs"),
      ],

      // Indexer Control
      [
        Markup.button.callback("▶ Run Full Scan", "adm_scan"),
        Markup.button.callback("⏸ Status", "adm_indexstatus"),
      ],

      // Communication
      [
        Markup.button.callback("📢 Broadcast", "adm_broadcast"),
        Markup.button.callback("👥 User List", "adm_users"),
      ],

      // Quick Actions
      [
        Markup.button.callback("🔄 Refresh", "adm_refresh"),
        Markup.button.callback("❓ Help", "adm_help"),
      ],
    ]);

    await ctx.reply(message, {
      parse_mode: "HTML",
      ...keyboard,
    });
  } catch (error) {
    console.error("[ADM-PANEL] Error sending panel:", error);
    await ctx.reply("❌ Error showing admin panel.");
  }
};

/**
 * Register all admin panel handlers
 */
const registerAdminPanelHandlers = (bot) => {
  // Helper: Check admin access
  const requireAdmin = (handler) => {
    return async (ctx) => {
      if (!isAdminId(ctx.from.id)) {
        return ctx.answerCbQuery("⛔ Admin only", { show_alert: true });
      }
      return handler(ctx);
    };
  };

  // 📊 STATS
  bot.action(
    "adm_stats",
    requireAdmin(async (ctx) => {
      try {
        const resourceCount = await TelegramResource.countDocuments();
        const userCount = await User.countDocuments();
        const channels = await TelegramChannel.find({});
        const downloads = await TelegramResource.aggregate([
          { $group: { _id: null, total: { $sum: "$downloadCount" } } },
        ]);
        const downloadTotal = downloads[0]?.total || 0;

        const stats =
          `📊 <b>Full Statistics</b>\n\n` +
          `📦 Resources: <b>${resourceCount.toLocaleString()}</b>\n` +
          `👥 Users: <b>${userCount.toLocaleString()}</b>\n` +
          `📡 Channels: <b>${channels.length}</b>\n` +
          `📥 Total Downloads: <b>${downloadTotal.toLocaleString()}</b>\n\n` +
          `<i>Generated: ${new Date().toLocaleString()}</i>`;

        await ctx.reply(stats, { parse_mode: "HTML" });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-STATS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading stats", { show_alert: true });
      }
    }),
  );

  // 🏥 CHANNEL HEALTH
  bot.action(
    "adm_health",
    requireAdmin(async (ctx) => {
      try {
        const channels = await TelegramChannel.find({}).sort({
          healthStatus: 1,
        });
        let message = "🏥 <b>Channel Health Status</b>\n\n";

        const activeCount = channels.filter(
          (c) => c.healthStatus === "ACTIVE",
        ).length;
        const degradedCount = channels.filter(
          (c) => c.healthStatus === "DEGRADED",
        ).length;
        const deadCount = channels.filter(
          (c) => c.healthStatus === "DEAD",
        ).length;

        message += `✅ Active: <b>${activeCount}</b>\n`;
        message += `⚠️ Degraded: <b>${degradedCount}</b>\n`;
        message += `❌ Dead: <b>${deadCount}</b>\n\n`;

        if (deadCount > 0) {
          message += "<b>Dead Channels:</b>\n";
          channels
            .filter((c) => c.healthStatus === "DEAD")
            .slice(0, 10)
            .forEach((ch) => {
              message += `• @${ch.username} (${ch.failureCount} failures)\n`;
            });
        }

        message += `\n<i>Last scan: ${channels[0]?.lastSuccessfulScan?.toLocaleString() || "Never"}</i>`;

        await ctx.reply(message, { parse_mode: "HTML" });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-HEALTH] Error:", error);
        await ctx.answerCbQuery("❌ Error loading health", {
          show_alert: true,
        });
      }
    }),
  );

  // 📋 PENDING CHANNELS
  bot.action(
    "adm_pending",
    requireAdmin(async (ctx) => {
      try {
        const pending = await ChannelRecommendation.find({ status: "pending" })
          .sort({ createdAt: -1 })
          .limit(10);

        if (pending.length === 0) {
          await ctx.reply("✅ No pending channel recommendations.", {
            parse_mode: "HTML",
          });
          await ctx.answerCbQuery();
          return;
        }

        let message = `📋 <b>Pending Recommendations</b> (${pending.length})\n\n`;
        pending.forEach((rec) => {
          message += `@${rec.channelUsername}\n`;
          message += `  Reason: ${rec.reason}\n\n`;
        });

        await ctx.reply(message, { parse_mode: "HTML" });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-PENDING] Error:", error);
        await ctx.answerCbQuery("❌ Error loading pending", {
          show_alert: true,
        });
      }
    }),
  );

  // 📜 RECENT LOGS
  bot.action(
    "adm_logs",
    requireAdmin(async (ctx) => {
      try {
        const logs = getAdminLogs(20);

        if (logs.length === 0) {
          await ctx.reply("📜 No errors logged yet.", { parse_mode: "HTML" });
          await ctx.answerCbQuery();
          return;
        }

        let message = `📜 <b>Recent Logs</b> (last ${Math.min(20, logs.length)})\n\n`;
        message += `<pre>`;
        logs.forEach((log) => {
          const time = log.time.toLocaleTimeString();
          const level = log.level.toUpperCase();
          message += `[${time}] ${level}: ${log.message.substring(0, 50)}\n`;
        });
        message += `</pre>`;

        await ctx.reply(message, { parse_mode: "HTML" });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-LOGS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading logs", { show_alert: true });
      }
    }),
  );

  // ▶ RUN FULL SCAN
  bot.action(
    "adm_scan",
    requireAdmin(async (ctx) => {
      try {
        // Fire off scan in background (no await)
        indexAllChannels().catch((err) => {
          console.error("[ADM-SCAN] Background error:", err);
          pushAdminLog("error", `Scan failed: ${err.message}`);
        });

        await ctx.answerCbQuery("🔄 Scan started");
        await ctx.reply(
          "🔄 Full scan started in background. Use /channelhealth to monitor.",
        );
      } catch (error) {
        console.error("[ADM-SCAN] Error:", error);
        await ctx.answerCbQuery("❌ Error starting scan", { show_alert: true });
      }
    }),
  );

  // ⏸ INDEXER STATUS
  bot.action(
    "adm_indexstatus",
    requireAdmin(async (ctx) => {
      try {
        const running = isIndexingInProgress();
        const channels = await TelegramChannel.find({ fullyIndexed: false });

        let message = `⏸ <b>Indexer Status</b>\n\n`;
        message += `Status: ${running ? "🔄 <b>Running</b>" : "💤 <b>Idle</b>"}\n`;
        message += `Channels not fully indexed: <b>${channels.length}</b>\n`;

        if (channels.length > 0) {
          message += `\nPending (first 5):\n`;
          channels.slice(0, 5).forEach((ch) => {
            message += `  • @${ch.username}\n`;
          });
        }

        await ctx.reply(message, { parse_mode: "HTML" });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-INDEXSTATUS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading status", {
          show_alert: true,
        });
      }
    }),
  );

  // 📢 BROADCAST
  bot.action(
    "adm_broadcast",
    requireAdmin(async (ctx) => {
      try {
        const message =
          `📢 <b>Broadcast Instructions</b>\n\n` +
          `Use: <code>/broadcast &lt;message&gt;</code>\n\n` +
          `This will send your message to all users.\n` +
          `Be mindful of rate limits!`;

        await ctx.reply(message, { parse_mode: "HTML" });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-BROADCAST] Error:", error);
        await ctx.answerCbQuery("❌ Error", { show_alert: true });
      }
    }),
  );

  // 👥 USER LIST
  bot.action(
    "adm_users",
    requireAdmin(async (ctx) => {
      try {
        const total = await User.countDocuments();
        const newToday = await User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });
        const activeToday = await User.countDocuments({
          lastActivityAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });

        const message =
          `👥 <b>User Metrics</b>\n\n` +
          `Total Users: <b>${total}</b>\n` +
          `New Today: <b>${newToday}</b>\n` +
          `Active Today: <b>${activeToday}</b>`;

        await ctx.reply(message, { parse_mode: "HTML" });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-USERS] Error:", error);
        await ctx.answerCbQuery("❌ Error loading users", { show_alert: true });
      }
    }),
  );

  // 🔄 REFRESH PANEL
  bot.action(
    "adm_refresh",
    requireAdmin(async (ctx) => {
      try {
        const message = await getAdminPanelMessage();

        const keyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback("📊 Full Stats", "adm_stats"),
            Markup.button.callback("🏥 Channel Health", "adm_health"),
          ],
          [
            Markup.button.callback("📋 Pending", "adm_pending"),
            Markup.button.callback("📜 Recent Logs", "adm_logs"),
          ],
          [
            Markup.button.callback("▶ Run Full Scan", "adm_scan"),
            Markup.button.callback("⏸ Status", "adm_indexstatus"),
          ],
          [
            Markup.button.callback("📢 Broadcast", "adm_broadcast"),
            Markup.button.callback("👥 User List", "adm_users"),
          ],
          [
            Markup.button.callback("🔄 Refresh", "adm_refresh"),
            Markup.button.callback("❓ Help", "adm_help"),
          ],
        ]);

        await ctx.editMessageText(message, {
          parse_mode: "HTML",
          ...keyboard,
        });
        await ctx.answerCbQuery("✅ Updated");
      } catch (error) {
        console.error("[ADM-REFRESH] Error:", error);
        await ctx.answerCbQuery("❌ Error refreshing", { show_alert: true });
      }
    }),
  );

  // ❓ HELP
  bot.action(
    "adm_help",
    requireAdmin(async (ctx) => {
      try {
        const help =
          `<b>Admin Commands</b>\n\n` +
          `/admin — open this panel\n` +
          `/stats — usage statistics\n` +
          `/channelhealth — channel scan status\n` +
          `/addchannel @username — add a new channel\n` +
          `/removechannel @username — remove a channel\n` +
          `/listchannels — list all channels\n` +
          `/forcescan @username — force scan one channel\n` +
          `/pendingchannels — review recommendations\n` +
          `/broadcast — send message to all users`;

        await ctx.reply(help, { parse_mode: "HTML" });
        await ctx.answerCbQuery();
      } catch (error) {
        console.error("[ADM-HELP] Error:", error);
        await ctx.answerCbQuery("❌ Error loading help", { show_alert: true });
      }
    }),
  );
};

/**
 * /addchannel <username> [university] [department] [type] [priority]
 */
const addChannelCommand = async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    return ctx.reply(
      "⚠️ Usage: /addchannel <username> [university] [department] [type] [priority]\nExample: /addchannel ethioacadamic AA AAU general 1",
    );
  }

  let username = args[0].replace("@", "");
  const university = args[1] || "";
  const department = args[2] || "";
  const type = args[3] || "general";
  const priority = args[4] ? parseInt(args[4]) : 1;

  try {
    await TelegramChannel.findOneAndUpdate(
      { username },
      {
        username,
        university,
        department,
        type,
        priority,
        active: true,
        lastScannedAt: null, // Force full scan next time
        totalIndexed: 0,
      },
      { upsert: true, new: true },
    );
    await ctx.reply(
      `✅ Channel @${username} added successfully and queued for full scan.`,
    );
  } catch (error) {
    console.error("[Admin] Error adding channel:", error);
    await ctx.reply("❌ Failed to add channel.");
  }
};

/**
 * /removechannel <username>
 */
const removeChannelCommand = async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    return ctx.reply("⚠️ Usage: /removechannel <username>");
  }

  let username = args[0].replace("@", "");

  try {
    const channel = await TelegramChannel.findOneAndUpdate(
      { username },
      { active: false },
      { new: true },
    );

    if (channel) {
      await ctx.reply(`✅ Channel @${username} has been deactivated.`);
    } else {
      await ctx.reply(`⚠️ Channel @${username} not found in database.`);
    }
  } catch (error) {
    console.error("[Admin] Error removing channel:", error);
    await ctx.reply("❌ Failed to remove channel.");
  }
};

/**
 * /listchannels
 */
const listChannelsCommand = async (ctx) => {
  try {
    const channels = await TelegramChannel.find({}).sort({
      active: -1,
      username: 1,
    });

    if (channels.length === 0) {
      return ctx.reply("No channels found in database.");
    }

    let responseText = "📊 <b>Telegram Channels</b>\n\n";
    let index = 1;

    for (const channel of channels) {
      const statusEmoji = channel.active ? "✅" : "❌";
      const lastScan = channel.lastScannedAt
        ? channel.lastScannedAt.toISOString().split("T")[0]
        : "Never";
      const line = `${index}. @${channel.username} | ${statusEmoji} | Indexed: ${channel.totalIndexed} | Scan: ${lastScan}\n`;

      // Prevent exceeding Telegram's 4096 character limit
      if (responseText.length + line.length > 4000) {
        await ctx.reply(responseText, { parse_mode: "HTML" });
        responseText = "";
      }

      responseText += line;
      index++;
    }

    if (responseText.length > 0) {
      await ctx.reply(responseText, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("[Admin] Error listing channels:", error);
    await ctx.reply("❌ Failed to list channels.");
  }
};

/**
 * /forcescan <username>
 */
const forceScanCommand = async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    return ctx.reply("⚠️ Usage: /forcescan <username>");
  }

  let username = args[0].replace("@", "");

  try {
    const channel = await TelegramChannel.findOne({ username });
    if (!channel) {
      return ctx.reply(
        `⚠️ Channel @${username} not found in database. Add it first with /addchannel.`,
      );
    }
    if (isIndexingInProgress()) {
      await ctx.reply(
        `ℹ️ Heads up: a scheduled full scan is currently running. This force-scan will run alongside it — that's safe, but may be slower than usual.`,
      );
    }
    const statusMsg = await ctx.reply(
      `⏳ Forcing scan on @${username}... This might take a while depending on channel size.`,
    );

    indexChannel(username)
      .then(async (results) => {
        let report = `✅ <b>Force Scan Complete: @${username}</b>\n\n`;
        report += `📑 Total Parsed: ${results.indexed + results.skipped}\n`;
        report += `🆕 New/Updated: ${results.indexed}\n`;
        report += `⏭️ Skipped: ${results.skipped}\n`;

        await ctx.telegram
          .editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            undefined,
            report,
            { parse_mode: "HTML" },
          )
          .catch(() => {});
      })
      .catch(async (error) => {
        console.error("[Admin] Error forcing scan:", error);
        await ctx.telegram
          .editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            undefined,
            `❌ Failed to force scan @${username}. Error: ${error.message}`,
          )
          .catch(() => {});
      });

    return;
  } catch (error) {
    console.error("[Admin] Error forcing scan:", error);
    await ctx.reply(
      `❌ Failed to force scan @${username}. Error: ${error.message}`,
    );
  }
};

const registerAdminActionHandlers = (bot) => {
  bot.action(/approve_rec_(.+)/, async (ctx) => {
    try {
      const recId = ctx.match[1];
      const rec =
        await ChannelRecommendation.findById(recId).populate("recommendedBy");
      if (!rec || rec.status !== "pending") {
        return await ctx.answerCbQuery(
          "Recommendation already processed or not found.",
          { show_alert: true },
        );
      }

      rec.status = "approved";
      await rec.save();

      await TelegramChannel.findOneAndUpdate(
        { username: rec.channelUsername },
        {
          username: rec.channelUsername,
          university:
            rec.university === "All Universities" ? "" : rec.university,
          department: "",
          type: "general",
          priority: 1,
          active: true,
          lastScannedAt: null,
          totalIndexed: 0,
        },
        { upsert: true, new: true },
      );

      await ctx
        .editMessageText(
          ctx.callbackQuery.message.text + "\n\n✅ <b>APPROVED</b>",
          { parse_mode: "HTML" },
        )
        .catch(() => {});

      if (rec.recommendedBy && rec.recommendedBy.telegramId) {
        await bot.telegram
          .sendMessage(
            rec.recommendedBy.telegramId,
            `✅ Thanks! Your recommendation for @${rec.channelUsername} has been approved and added to StudyHub!`,
          )
          .catch(() => {});
      }

      await ctx.answerCbQuery("Approved!");
    } catch (err) {
      console.error("Error approving rec:", err);
      await ctx.answerCbQuery("Error processing approval", {
        show_alert: true,
      });
    }
  });

  bot.action(/reject_rec_(.+)/, async (ctx) => {
    try {
      const recId = ctx.match[1];
      const rec =
        await ChannelRecommendation.findById(recId).populate("recommendedBy");
      if (!rec || rec.status !== "pending") {
        return await ctx.answerCbQuery(
          "Recommendation already processed or not found.",
          { show_alert: true },
        );
      }

      rec.status = "rejected";
      await rec.save();

      await ctx
        .editMessageText(
          ctx.callbackQuery.message.text + "\n\n❌ <b>REJECTED</b>",
          { parse_mode: "HTML" },
        )
        .catch(() => {});

      if (rec.recommendedBy && rec.recommendedBy.telegramId) {
        await bot.telegram
          .sendMessage(
            rec.recommendedBy.telegramId,
            `Thanks for the suggestion! We reviewed @${rec.channelUsername} but it didn't meet our criteria right now.`,
          )
          .catch(() => {});
      }

      await ctx.answerCbQuery("Rejected!");
    } catch (err) {
      console.error("Error rejecting rec:", err);
      await ctx.answerCbQuery("Error processing rejection", {
        show_alert: true,
      });
    }
  });
};

module.exports = {
  isAdminUser,
  isAdmin,
  isAdminId,
  pushAdminLog,
  getAdminLogs,
  adminPanelCommand,
  registerAdminPanelHandlers,
  addChannelCommand,
  removeChannelCommand,
  listChannelsCommand,
  forceScanCommand,
  registerAdminActionHandlers,
};
