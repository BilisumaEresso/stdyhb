const TelegramChannel = require("../../db/models/TelegramChannel");
const ChannelRecommendation = require("../../db/models/ChannelRecommendation");
const { indexChannel } = require("../../search/telegramIndexer");

/**
 * Middleware to restrict commands to ADMIN_ID from .env
 */
const isAdmin = async (ctx, next) => {
  const adminIds = process.env.ADMIN_ID ? process.env.ADMIN_ID.split(",") : [];
  const userId = ctx.from?.id?.toString();

  if (!adminIds.includes(userId)) {
    return ctx.reply("❌ Admin only. You are not authorized to use this command.");
  }
  return next();
};

/**
 * /addchannel <username> [university] [department] [type] [priority]
 */
const addChannelCommand = async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    return ctx.reply("⚠️ Usage: /addchannel <username> [university] [department] [type] [priority]\nExample: /addchannel ethioacadamic AA AAU general 1");
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
        totalIndexed: 0
      },
      { upsert: true, new: true }
    );
    await ctx.reply(`✅ Channel @${username} added successfully and queued for full scan.`);
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
      { new: true }
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
    const channels = await TelegramChannel.find({}).sort({ active: -1, username: 1 });
    
    if (channels.length === 0) {
      return ctx.reply("No channels found in database.");
    }

    let responseText = "📊 <b>Telegram Channels</b>\n\n";
    let index = 1;

    for (const channel of channels) {
      const statusEmoji = channel.active ? "✅" : "❌";
      const lastScan = channel.lastScannedAt ? channel.lastScannedAt.toISOString().split('T')[0] : "Never";
      const line = `${index}. @${channel.username} | ${statusEmoji} | Indexed: ${channel.totalIndexed} | Scan: ${lastScan}\n`;
      
      // Prevent exceeding Telegram's 4096 character limit
      if ((responseText.length + line.length) > 4000) {
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
      return ctx.reply(`⚠️ Channel @${username} not found in database. Add it first with /addchannel.`);
    }

    const statusMsg = await ctx.reply(`⏳ Forcing scan on @${username}... This might take a while depending on channel size.`);

    indexChannel(username).then(async (results) => {
      let report = `✅ <b>Force Scan Complete: @${username}</b>\n\n`;
      report += `📑 Total Parsed: ${results.indexed + results.skipped}\n`;
      report += `🆕 New/Updated: ${results.indexed}\n`;
      report += `⏭️ Skipped: ${results.skipped}\n`;

      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, report, { parse_mode: "HTML" }).catch(() => {});
    }).catch(async (error) => {
      console.error("[Admin] Error forcing scan:", error);
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `❌ Failed to force scan @${username}. Error: ${error.message}`).catch(() => {});
    });

    return;
  } catch (error) {
    console.error("[Admin] Error forcing scan:", error);
    await ctx.reply(`❌ Failed to force scan @${username}. Error: ${error.message}`);
  }
};

const registerAdminActionHandlers = (bot) => {
  bot.action(/approve_rec_(.+)/, async (ctx) => {
    try {
      const recId = ctx.match[1];
      const rec = await ChannelRecommendation.findById(recId).populate('recommendedBy');
      if (!rec || rec.status !== "pending") {
        return await ctx.answerCbQuery("Recommendation already processed or not found.", { show_alert: true });
      }

      rec.status = "approved";
      await rec.save();

      await TelegramChannel.findOneAndUpdate(
        { username: rec.channelUsername },
        {
          username: rec.channelUsername,
          university: rec.university === "All Universities" ? "" : rec.university,
          department: "",
          type: "general",
          priority: 1,
          active: true,
          lastScannedAt: null,
          totalIndexed: 0
        },
        { upsert: true, new: true }
      );

      await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n✅ <b>APPROVED</b>", { parse_mode: "HTML" }).catch(()=>{});
      
      if (rec.recommendedBy && rec.recommendedBy.telegramId) {
        await bot.telegram.sendMessage(
          rec.recommendedBy.telegramId, 
          `✅ Thanks! Your recommendation for @${rec.channelUsername} has been approved and added to StudyHub!`
        ).catch(()=>{});
      }

      await ctx.answerCbQuery("Approved!");
    } catch (err) {
      console.error("Error approving rec:", err);
      await ctx.answerCbQuery("Error processing approval", { show_alert: true });
    }
  });

  bot.action(/reject_rec_(.+)/, async (ctx) => {
    try {
      const recId = ctx.match[1];
      const rec = await ChannelRecommendation.findById(recId).populate('recommendedBy');
      if (!rec || rec.status !== "pending") {
        return await ctx.answerCbQuery("Recommendation already processed or not found.", { show_alert: true });
      }

      rec.status = "rejected";
      await rec.save();

      await ctx.editMessageText(ctx.callbackQuery.message.text + "\n\n❌ <b>REJECTED</b>", { parse_mode: "HTML" }).catch(()=>{});

      if (rec.recommendedBy && rec.recommendedBy.telegramId) {
        await bot.telegram.sendMessage(
          rec.recommendedBy.telegramId, 
          `Thanks for the suggestion! We reviewed @${rec.channelUsername} but it didn't meet our criteria right now.`
        ).catch(()=>{});
      }

      await ctx.answerCbQuery("Rejected!");
    } catch (err) {
      console.error("Error rejecting rec:", err);
      await ctx.answerCbQuery("Error processing rejection", { show_alert: true });
    }
  });
};

module.exports = {
  isAdmin,
  addChannelCommand,
  removeChannelCommand,
  listChannelsCommand,
  forceScanCommand,
  registerAdminActionHandlers
};
