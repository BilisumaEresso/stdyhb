const { Markup } = require("telegraf");
const User = require("../../db/models/User");
const { isAdminUser } = require("./admin");

// Store pending broadcasts in memory
const pendingBroadcasts = new Map();

const AUDIENCE_OPTIONS = [
  { id: "all", label: "👥 All Students", query: () => ({}) },
  {
    id: "active",
    label: "⚡ Active (30d)",
    query: () => ({
      lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),
  },
  {
    id: "aastu",
    label: "🏛️ AASTU",
    query: () => ({ university: { $regex: /^AASTU/i } }),
  },
  {
    id: "aau",
    label: "🏛️ AAU",
    query: () => ({ university: { $regex: /^AAU/i } }),
  },
  {
    id: "astu",
    label: "🏛️ ASTU",
    query: () => ({ university: { $regex: /^ASTU/i } }),
  },
];

async function getAudienceCount(audienceId) {
  const audience =
    AUDIENCE_OPTIONS.find((a) => a.id === audienceId) || AUDIENCE_OPTIONS[0];
  return await User.countDocuments(audience.query());
}

/**
 * Extract button lines from text and return { text, buttons }
 * Format: BUTTON: Label | https://url
 */
function parseButtons(content) {
  const lines = (content || "").split("\n");
  const buttons = [];
  const textLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("BUTTON:")) {
      const parts = trimmed.substring("BUTTON:".length).trim().split("|");
      if (parts.length === 2) {
        const label = parts[0].trim();
        const url = parts[1].trim();
        if (label && url.startsWith("http")) {
          buttons.push(Markup.button.url(label, url));
        }
      }
    } else {
      textLines.push(line);
    }
  }

  return {
    text: textLines.join("\n").trim(),
    buttons,
  };
}

/**
 * Adjust entity offsets when a command prefix like "/broadcast " is stripped
 */
function adjustEntities(entities, prefixLength) {
  if (!entities || !Array.isArray(entities) || entities.length === 0) return undefined;
  const adjusted = [];
  for (const ent of entities) {
    if (ent.offset < prefixLength) continue;
    adjusted.push({
      ...ent,
      offset: ent.offset - prefixLength,
    });
  }
  return adjusted.length > 0 ? adjusted : undefined;
}

/**
 * Format the interactive broadcast preview with audience targeting pills
 */
function renderBroadcastPreview(broadcast, broadcastId) {
  const cleanText = broadcast.content || broadcast.caption || "";
  const buttons = broadcast.buttons || [];
  const audience =
    AUDIENCE_OPTIONS.find((a) => a.id === broadcast.targetAudience) ||
    AUDIENCE_OPTIONS[0];
  const count = broadcast.audienceCount || 0;

  const typeIcon = {
    text: "📝 TEXT",
    photo: "🖼️ PHOTO",
    video: "🎥 VIDEO",
    animation: "🎞️ GIF",
    document: "📁 DOCUMENT",
    audio: "🎵 AUDIO",
    voice: "🎙️ VOICE",
  }[broadcast.type] || "📄 MESSAGE";

  let text = `📤 <b>Broadcast Preview</b>\n\n`;
  text += `🎯 <b>Audience:</b> ${audience.label} (<b>${count.toLocaleString()}</b> students)\n`;
  text += `📁 <b>Type:</b> ${typeIcon}\n`;
  if (broadcast.isReply) {
    text += `🔗 <i>Delivering replied message with 100% native formatting & media.</i>\n`;
  }
  text += `\n─────────────────────\n`;
  text += cleanText
    ? (cleanText.length > 500 ? cleanText.substring(0, 497) + "..." : cleanText)
    : "<i>(Media message without caption)</i>";
  text += `\n─────────────────────\n`;

  if (buttons.length > 0) {
    text += `\n<i>[+ ${buttons.length} attached URL button(s)]</i>`;
  }

  text += `\n\n<b>Ready to send to ${count.toLocaleString()} student${count !== 1 ? "s" : ""}?</b>`;

  const rows = [
    // Audience selection row 1: All & Active
    [
      Markup.button.callback(
        broadcast.targetAudience === "all" ? "• 👥 All •" : "👥 All",
        `bc_aud_${broadcastId}_all`,
      ),
      Markup.button.callback(
        broadcast.targetAudience === "active"
          ? "• ⚡ Active (30d) •"
          : "⚡ Active",
        `bc_aud_${broadcastId}_active`,
      ),
    ],
    // Audience selection row 2: Universities
    [
      Markup.button.callback(
        broadcast.targetAudience === "aastu" ? "• 🏛️ AASTU •" : "🏛️ AASTU",
        `bc_aud_${broadcastId}_aastu`,
      ),
      Markup.button.callback(
        broadcast.targetAudience === "aau" ? "• 🏛️ AAU •" : "🏛️ AAU",
        `bc_aud_${broadcastId}_aau`,
      ),
      Markup.button.callback(
        broadcast.targetAudience === "astu" ? "• 🏛️ ASTU •" : "🏛️ ASTU",
        `bc_aud_${broadcastId}_astu`,
      ),
    ],
    // Confirm / Cancel
    [
      Markup.button.callback("🚀 Confirm & Send", `bc_confirm_${broadcastId}`),
      Markup.button.callback("❌ Cancel", `bc_cancel_${broadcastId}`),
    ],
  ];

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

/**
 * Main broadcast command handler
 */
async function broadcastCommand(ctx) {
  try {
    const replyMsg = ctx.message?.reply_to_message;
    const isReply = Boolean(replyMsg);
    const targetMsg = isReply ? replyMsg : ctx.message;

    // Check command parameters for buttons: e.g. /broadcast BUTTON: Join | https://t.me/...
    const commandText = (ctx.message?.text || ctx.message?.caption || "").trim();
    const commandParams = commandText.replace(/^\/broadcast\b/, "").trim();
    const { buttons: commandButtons } = parseButtons(commandParams);

    let broadcastType = "text";
    let fileId = null;
    let content = "";
    let caption = "";
    let entities = undefined;
    let captionEntities = undefined;
    let sourceMsgId = isReply ? replyMsg.message_id : null;
    let allButtons = [...commandButtons];

    if (targetMsg.photo && targetMsg.photo.length > 0) {
      broadcastType = "photo";
      fileId = targetMsg.photo[targetMsg.photo.length - 1].file_id;
      const rawCaption = targetMsg.caption || "";
      if (!isReply && rawCaption.startsWith("/broadcast")) {
        const stripped = rawCaption.replace(/^\/broadcast\b/, "").trim();
        const parsed = parseButtons(stripped);
        caption = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        captionEntities = adjustEntities(targetMsg.caption_entities, rawCaption.indexOf(stripped));
      } else {
        const parsed = parseButtons(rawCaption);
        caption = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        captionEntities = targetMsg.caption_entities;
      }
    } else if (targetMsg.video) {
      broadcastType = "video";
      fileId = targetMsg.video.file_id;
      const rawCaption = targetMsg.caption || "";
      if (!isReply && rawCaption.startsWith("/broadcast")) {
        const stripped = rawCaption.replace(/^\/broadcast\b/, "").trim();
        const parsed = parseButtons(stripped);
        caption = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        captionEntities = adjustEntities(targetMsg.caption_entities, rawCaption.indexOf(stripped));
      } else {
        const parsed = parseButtons(rawCaption);
        caption = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        captionEntities = targetMsg.caption_entities;
      }
    } else if (targetMsg.document) {
      broadcastType = "document";
      fileId = targetMsg.document.file_id;
      const rawCaption = targetMsg.caption || "";
      if (!isReply && rawCaption.startsWith("/broadcast")) {
        const stripped = rawCaption.replace(/^\/broadcast\b/, "").trim();
        const parsed = parseButtons(stripped);
        caption = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        captionEntities = adjustEntities(targetMsg.caption_entities, rawCaption.indexOf(stripped));
      } else {
        const parsed = parseButtons(rawCaption);
        caption = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        captionEntities = targetMsg.caption_entities;
      }
    } else if (targetMsg.animation) {
      broadcastType = "animation";
      fileId = targetMsg.animation.file_id;
      const rawCaption = targetMsg.caption || "";
      if (!isReply && rawCaption.startsWith("/broadcast")) {
        const stripped = rawCaption.replace(/^\/broadcast\b/, "").trim();
        const parsed = parseButtons(stripped);
        caption = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        captionEntities = adjustEntities(targetMsg.caption_entities, rawCaption.indexOf(stripped));
      } else {
        const parsed = parseButtons(rawCaption);
        caption = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        captionEntities = targetMsg.caption_entities;
      }
    } else if (targetMsg.audio) {
      broadcastType = "audio";
      fileId = targetMsg.audio.file_id;
      const rawCaption = targetMsg.caption || "";
      caption = rawCaption;
      captionEntities = targetMsg.caption_entities;
    } else if (targetMsg.voice) {
      broadcastType = "voice";
      fileId = targetMsg.voice.file_id;
      const rawCaption = targetMsg.caption || "";
      caption = rawCaption;
      captionEntities = targetMsg.caption_entities;
    } else if (targetMsg.text) {
      broadcastType = "text";
      if (!isReply) {
        const rawText = targetMsg.text || "";
        const stripped = rawText.replace(/^\/broadcast\b/, "").trim();
        const parsed = parseButtons(stripped);
        content = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        const offset = rawText.indexOf(stripped);
        entities = adjustEntities(targetMsg.entities, offset >= 0 ? offset : 0);
      } else {
        const parsed = parseButtons(targetMsg.text);
        content = parsed.text;
        allButtons = [...allButtons, ...parsed.buttons];
        entities = targetMsg.entities;
      }
    }

    if (!content && !fileId && !sourceMsgId) {
      return ctx.reply(
        "📢 <b>StudyHub Multi-Format Broadcast</b>\n\n" +
        "You can broadcast in 3 easy ways:\n\n" +
        "1️⃣ <b>Reply-to-Broadcast (Recommended):</b>\n" +
        "• Send or forward ANY post (photo, video, PDF document, GIF, audio, or formatted text with links).\n" +
        "• Reply to it with <code>/broadcast</code>.\n" +
        "• <i>Optional buttons:</i> <code>/broadcast BUTTON: Visit Site | https://example.com</code>\n\n" +
        "2️⃣ <b>Direct Media with Caption:</b>\n" +
        "• Send a photo, video, or PDF with caption:\n" +
        "  <code>/broadcast Exam schedules updated!</code>\n\n" +
        "3️⃣ <b>Direct Text:</b>\n" +
        "• Send: <code>/broadcast Your announcement here</code>\n" +
        "  <code>BUTTON: Join | https://t.me/channel</code>",
        { parse_mode: "HTML" }
      );
    }

    const broadcastId = Date.now().toString(36);
    const totalUsers = await getAudienceCount("all");

    const broadcast = {
      type: broadcastType,
      content,
      fileId,
      caption: caption || content,
      entities,
      captionEntities,
      buttons: allButtons,
      targetAudience: "all",
      audienceCount: totalUsers,
      adminChatId: ctx.chat.id,
      adminMsgId: null,
      sourceMsgId,
      isReply,
      startTime: Date.now(),
    };

    pendingBroadcasts.set(broadcastId, broadcast);

    const preview = renderBroadcastPreview(broadcast, broadcastId);
    const previewMsg = await ctx.reply(preview.text, {
      parse_mode: "HTML",
      ...preview.keyboard,
    });

    broadcast.adminMsgId = previewMsg.message_id;
  } catch (error) {
    console.error("[Broadcast] Error in broadcastCommand:", error);
    await ctx
      .reply("❌ An error occurred while preparing the broadcast.")
      .catch(() => {});
  }
}

/**
 * Register action handlers for broadcast audience selection, confirm, cancel, and progress
 */
function registerBroadcastHandlers(bot) {
  // Audience switch
  bot.action(
    /^bc_aud_(.+)_(all|active|aastu|aau|astu)$/,
    async (ctx) => {
    if (!isAdminUser(ctx.from?.id)) {
      return ctx.answerCbQuery("⛔ Admin only", { show_alert: true });
    }

    const broadcastId = ctx.match[1];
    const targetAudience = ctx.match[2];
    const broadcast = pendingBroadcasts.get(broadcastId);

    if (!broadcast) {
      return ctx.answerCbQuery("❌ Broadcast session expired or not found.");
    }

    broadcast.targetAudience = targetAudience;
    broadcast.audienceCount = await getAudienceCount(targetAudience);

    const preview = renderBroadcastPreview(broadcast, broadcastId);

    await ctx
      .editMessageText(preview.text, {
        parse_mode: "HTML",
        ...preview.keyboard,
      })
      .catch(() => {});

    const audience =
      AUDIENCE_OPTIONS.find((a) => a.id === targetAudience) ||
      AUDIENCE_OPTIONS[0];
    await ctx.answerCbQuery(
      `Audience set to: ${audience.label} (${broadcast.audienceCount} users)`,
    );
  });

  // Confirm broadcast
  bot.action(/^bc_confirm_(.+)$/, async (ctx) => {
    if (!isAdminUser(ctx.from?.id)) {
      return ctx.answerCbQuery("⛔ Admin only", { show_alert: true });
    }
    const broadcastId = ctx.match[1];
    const broadcast = pendingBroadcasts.get(broadcastId);

    if (!broadcast) {
      return ctx.answerCbQuery("❌ Broadcast not found or expired.");
    }

    await ctx.answerCbQuery();

    try {
      const audience =
        AUDIENCE_OPTIONS.find((a) => a.id === broadcast.targetAudience) ||
        AUDIENCE_OPTIONS[0];

      await ctx
        .editMessageText(
          `📤 <b>Broadcasting to ${audience.label}...</b>\n\nStarting delivery...`,
          { parse_mode: "HTML" },
        )
        .catch(() => {});

      const users = await User.find(audience.query(), "telegramId");
      let delivered = 0;
      let blocked = 0;
      let failed = 0;
      const startTime = Date.now();

      console.log(
        `[Broadcast] Starting broadcast to ${users.length} users in ${audience.label} (ID: ${broadcastId})`,
      );

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        try {
          const buttonMarkup = broadcast.buttons.length
            ? Markup.inlineKeyboard(broadcast.buttons.map((btn) => [btn]))
                .reply_markup
            : undefined;

          if (broadcast.sourceMsgId) {
            await ctx.telegram.copyMessage(
              user.telegramId,
              broadcast.adminChatId,
              broadcast.sourceMsgId,
              { reply_markup: buttonMarkup },
            );
          } else if (broadcast.type === "photo") {
            await ctx.telegram.sendPhoto(user.telegramId, broadcast.fileId, {
              caption: broadcast.caption,
              caption_entities: broadcast.captionEntities,
              parse_mode: broadcast.captionEntities ? undefined : "HTML",
              reply_markup: buttonMarkup,
            });
          } else if (broadcast.type === "video") {
            await ctx.telegram.sendVideo(user.telegramId, broadcast.fileId, {
              caption: broadcast.caption,
              caption_entities: broadcast.captionEntities,
              parse_mode: broadcast.captionEntities ? undefined : "HTML",
              reply_markup: buttonMarkup,
            });
          } else if (broadcast.type === "document") {
            await ctx.telegram.sendDocument(user.telegramId, broadcast.fileId, {
              caption: broadcast.caption,
              caption_entities: broadcast.captionEntities,
              parse_mode: broadcast.captionEntities ? undefined : "HTML",
              reply_markup: buttonMarkup,
            });
          } else if (broadcast.type === "animation") {
            await ctx.telegram.sendAnimation(user.telegramId, broadcast.fileId, {
              caption: broadcast.caption,
              caption_entities: broadcast.captionEntities,
              parse_mode: broadcast.captionEntities ? undefined : "HTML",
              reply_markup: buttonMarkup,
            });
          } else if (broadcast.type === "audio") {
            await ctx.telegram.sendAudio(user.telegramId, broadcast.fileId, {
              caption: broadcast.caption,
              caption_entities: broadcast.captionEntities,
              parse_mode: broadcast.captionEntities ? undefined : "HTML",
              reply_markup: buttonMarkup,
            });
          } else if (broadcast.type === "voice") {
            await ctx.telegram.sendVoice(user.telegramId, broadcast.fileId, {
              caption: broadcast.caption,
              caption_entities: broadcast.captionEntities,
              parse_mode: broadcast.captionEntities ? undefined : "HTML",
              reply_markup: buttonMarkup,
            });
          } else {
            await ctx.telegram.sendMessage(user.telegramId, broadcast.content, {
              entities: broadcast.entities,
              parse_mode: broadcast.entities ? undefined : "HTML",
              reply_markup: buttonMarkup,
            });
          }
          delivered++;
        } catch (err) {
          const errMsg = err.message || "";
          if (
            errMsg.includes("blocked") ||
            errMsg.includes("deactivated") ||
            err.response?.error_code === 403
          ) {
            blocked++;
          } else {
            failed++;
          }
        }

        // Live progress update every 20 sends
        if ((i + 1) % 20 === 0 && i + 1 < users.length) {
          await ctx
            .editMessageText(
              `📤 <b>Broadcasting to ${audience.label}...</b>\n\n` +
                `✅ <b>Delivered:</b> ${delivered}\n` +
                `🚫 <b>Blocked:</b> ${blocked}\n` +
                `❌ <b>Failed:</b> ${failed}\n\n` +
                `<i>Progress: ${i + 1} / ${users.length}</i>`,
              { parse_mode: "HTML" },
            )
            .catch(() => {});
        }

        // Safe pacing delay
        await new Promise((r) => setTimeout(r, 40));
      }

      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      const finalText =
        `✅ <b>Broadcast Completed!</b>\n\n` +
        `🎯 <b>Audience:</b> ${audience.label}\n` +
        `📬 <b>Delivered:</b> ${delivered.toLocaleString()}\n` +
        `🚫 <b>Blocked/Inactive:</b> ${blocked}\n` +
        `❌ <b>Other Failures:</b> ${failed}\n` +
        `⏱ <b>Elapsed Time:</b> ${elapsedSec}s\n` +
        `<i>Total target users: ${users.length.toLocaleString()}</i>`;

      await ctx
        .editMessageText(finalText, { parse_mode: "HTML" })
        .catch(() => {});

      console.log(
        `[Broadcast] Complete (ID: ${broadcastId}) — ${delivered} delivered, ${blocked} blocked, ${failed} failed in ${elapsedSec}s`,
      );
    } catch (error) {
      console.error("[Broadcast] Error during broadcast:", error);
      await ctx
        .editMessageText("❌ Broadcast failed. Check logs for details.", {
          parse_mode: "HTML",
        })
        .catch(() => {});
    } finally {
      pendingBroadcasts.delete(broadcastId);
    }
  });

  // Cancel broadcast
  bot.action(/^bc_cancel_(.+)$/, async (ctx) => {
    if (!isAdminUser(ctx.from?.id)) {
      return ctx.answerCbQuery("⛔ Admin only", { show_alert: true });
    }
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
      pendingBroadcasts.delete(broadcastId);
    }
  });
}

module.exports = {
  broadcastCommand,
  registerBroadcastHandlers,
  renderBroadcastPreview,
  getAudienceCount,
  AUDIENCE_OPTIONS,
  pendingBroadcasts,
};
