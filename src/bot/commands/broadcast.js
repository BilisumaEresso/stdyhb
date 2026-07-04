const { Markup } = require("telegraf");
const User = require("../../db/models/User");

// Store pending broadcasts in memory
const pendingBroadcasts = new Map();

/**
 * Extract button lines from text and return { text, buttons }
 * Format: BUTTON: Label | https://url
 */
function parseButtons(content) {
  const lines = content.split("\n");
  const buttons = [];
  const textLines = [];

  for (const line of lines) {
    if (line.startsWith("BUTTON:")) {
      const parts = line.substring("BUTTON:".length).trim().split("|");
      if (parts.length === 2) {
        const label = parts[0].trim();
        const url = parts[1].trim();
        buttons.push(Markup.button.url(label, url));
      }
    } else {
      textLines.push(line);
    }
  }

  return {
    text: textLines.join("\n"),
    buttons,
  };
}

/**
 * Main broadcast command handler
 */
async function broadcastCommand(ctx) {
  try {
    const text = ctx.message.text.replace("/broadcast", "").trim();
    const photo = ctx.message.photo;
    const video = ctx.message.video;

    let broadcastType = "text";
    let content = text;
    let fileId = null;
    let caption = null;

    // Determine broadcast type
    if (photo && photo.length > 0) {
      broadcastType = "photo";
      fileId = photo[photo.length - 1].file_id;
      caption = ctx.message.caption || text || "";
    } else if (video) {
      broadcastType = "video";
      fileId = video.file_id;
      caption = ctx.message.caption || text || "";
    }

    if (!content && !fileId) {
      return ctx.reply(
        "❌ No content provided. Use /broadcast <text> or attach a photo/video.",
      );
    }

    // Parse buttons from content
    const { text: cleanText, buttons } = parseButtons(content || caption);

    // Generate broadcast ID
    const broadcastId = Date.now().toString(36);

    // Store pending broadcast
    pendingBroadcasts.set(broadcastId, {
      type: broadcastType,
      content: cleanText,
      fileId,
      caption: caption || cleanText,
      buttons,
      adminChatId: ctx.chat.id,
      adminMsgId: null,
      startTime: Date.now(),
    });

    // Get user count
    const userCount = await User.countDocuments();

    // Send preview
    let previewText = `📤 <b>Preview</b>:\n\n${cleanText}`;
    if (buttons.length > 0) {
      previewText += `\n\n<i>[+ ${buttons.length} button(s)]</i>`;
    }
    previewText += `\n\n<b>Send to ${userCount} user${userCount !== 1 ? "s" : ""}?</b>`;

    const previewMsg = await ctx.reply(previewText, {
      parse_mode: "HTML",
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback(
            "✅ Confirm Broadcast",
            `bc_confirm_${broadcastId}`,
          ),
          Markup.button.callback("❌ Cancel", `bc_cancel_${broadcastId}`),
        ],
      ]).reply_markup,
    });

    // Store message ID for later editing
    const pending = pendingBroadcasts.get(broadcastId);
    pending.adminMsgId = previewMsg.message_id;
  } catch (error) {
    console.error("[Broadcast] Error in broadcastCommand:", error);
    await ctx
      .reply("❌ An error occurred while preparing the broadcast.")
      .catch(() => {});
  }
}

/**
 * Register action handlers for broadcast confirm/cancel/progress
 */
function registerBroadcastHandlers(bot) {
  // Confirm broadcast
  bot.action(/^bc_confirm_(.+)$/, async (ctx) => {
    const broadcastId = ctx.match[1];
    const broadcast = pendingBroadcasts.get(broadcastId);

    if (!broadcast) {
      return ctx.answerCbQuery("❌ Broadcast not found or expired.");
    }

    await ctx.answerCbQuery();

    try {
      // Edit preview to show "Starting broadcast..."
      await ctx
        .editMessageText(
          "📤 <b>Broadcasting...</b>\n\nStarting delivery to users...",
          { parse_mode: "HTML" },
        )
        .catch(() => {});

      // Fetch all users
      const users = await User.find({}, "telegramId");
      let delivered = 0;
      let failed = 0;

      console.log(
        `[Broadcast] Starting broadcast to ${users.length} users (ID: ${broadcastId})`,
      );

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          if (broadcast.type === "photo") {
            await ctx.telegram.sendPhoto(user.telegramId, broadcast.fileId, {
              caption: broadcast.caption,
              parse_mode: "HTML",
              reply_markup: broadcast.buttons.length
                ? Markup.inlineKeyboard(broadcast.buttons.map((btn) => [btn]))
                    .reply_markup
                : undefined,
            });
          } else if (broadcast.type === "video") {
            await ctx.telegram.sendVideo(user.telegramId, broadcast.fileId, {
              caption: broadcast.caption,
              parse_mode: "HTML",
              reply_markup: broadcast.buttons.length
                ? Markup.inlineKeyboard(broadcast.buttons.map((btn) => [btn]))
                    .reply_markup
                : undefined,
            });
          } else {
            // Text broadcast
            await ctx.telegram.sendMessage(user.telegramId, broadcast.content, {
              parse_mode: "HTML",
              reply_markup: broadcast.buttons.length
                ? Markup.inlineKeyboard(broadcast.buttons.map((btn) => [btn]))
                    .reply_markup
                : undefined,
            });
          }
          delivered++;
        } catch (err) {
          failed++;
          console.warn(
            `[Broadcast] Failed to send to user ${user.telegramId}: ${err.message}`,
          );
        }

        // Update progress every 20 sends
        if ((i + 1) % 20 === 0) {
          await ctx
            .editMessageText(
              `📤 <b>Broadcasting...</b>\n\n✅ ${delivered} sent | ❌ ${failed} failed\n<i>Progress: ${i + 1}/${users.length}</i>`,
              { parse_mode: "HTML" },
            )
            .catch(() => {});

          // 50ms delay between batches
          await new Promise((r) => setTimeout(r, 50));
        } else {
          // 50ms delay between individual sends
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      // Final summary
      const finalText = `📤 <b>Broadcast Complete!</b>\n\n✅ <b>Delivered:</b> ${delivered}\n❌ <b>Failed:</b> ${failed}\n<i>Total users: ${users.length}</i>`;
      await ctx
        .editMessageText(finalText, { parse_mode: "HTML" })
        .catch(() => {});

      console.log(
        `[Broadcast] Complete (ID: ${broadcastId}) — ${delivered} delivered, ${failed} failed`,
      );
    } catch (error) {
      console.error("[Broadcast] Error during broadcast:", error);
      await ctx
        .editMessageText("❌ Broadcast failed. Check logs for details.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    } finally {
      // Clean up
      pendingBroadcasts.delete(broadcastId);
    }
  });

  // Cancel broadcast
  bot.action(/^bc_cancel_(.+)$/, async (ctx) => {
    const broadcastId = ctx.match[1];
    const broadcast = pendingBroadcasts.get(broadcastId);

    if (!broadcast) {
      return ctx.answerCbQuery("❌ Broadcast not found or expired.");
    }

    await ctx.answerCbQuery();

    try {
      await ctx
        .editMessageText("❌ <b>Broadcast Cancelled.</b>", {
          parse_mode: "HTML",
        })
        .catch(() => {});

      console.log(`[Broadcast] Cancelled (ID: ${broadcastId})`);
    } catch (error) {
      console.error("[Broadcast] Error cancelling:", error);
    } finally {
      // Clean up
      pendingBroadcasts.delete(broadcastId);
    }
  });
}

module.exports = {
  broadcastCommand,
  registerBroadcastHandlers,
};
