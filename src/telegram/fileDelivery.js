const { Markup } = require("telegraf");
const crypto = require("crypto");
const { getClient } = require("../search/telegramIndexer");
const TelegramResource = require("../db/models/TelegramResource");
const orchestrationService = require("../search/search.service");
const userService = require("../services/user.service");
const SavedResource = require("../db/models/SavedResource");
const CachedSearch = require("../db/models/CachedSearch");
const QuerySession = require("../db/models/QuerySession");
const DownloadHistory = require("../db/models/DownloadHistory");
const ResourceReport = require("../db/models/ResourceReport");

const templates = require("./templates");

async function recordSuccessfulDelivery(userId, resource, action = "download") {
  try {
    if (!resource || !resource._id) return;

    if (resource.groupId) {
      await TelegramResource.updateMany(
        { groupId: resource.groupId },
        { $inc: { downloadCount: 1 } }
      ).catch(() => {});
    } else {
      await TelegramResource.findByIdAndUpdate(resource._id, {
        $inc: { downloadCount: 1 }
      }).catch(() => {});
    }

    const user = await userService.findByTelegramId(userId);
    if (!user) return;

    await DownloadHistory.create({
      userId: user._id,
      telegramId: Number(userId),
      resourceId: resource._id,
      fileId: resource.fileId || "unknown",
      resourceTitle: resource.fileName || resource.caption || "Untitled Resource",
      fileType: resource.fileType || "unknown",
      channelUsername: resource.channelUsername || null,
      action
    });
  } catch (err) {
    console.error("[DELIVERY] Error recording download history:", err.message);
  }
}

async function markResourceUnavailable(resourceId, groupId = null) {
  try {
    if (groupId) {
      await TelegramResource.updateMany({ groupId }, { $set: { isAvailable: false } });
      await CachedSearch.updateMany(
        { "resources.groupId": groupId },
        { $pull: { resources: { groupId } } }
      );
    } else {
      await TelegramResource.updateOne({ _id: resourceId }, { $set: { isAvailable: false } });
      await CachedSearch.updateMany(
        { "resources._id": resourceId },
        { $pull: { resources: { _id: resourceId } } }
      );
    }
  } catch (err) {
    console.error("Error marking resource unavailable:", err);
  }
}



function applyResultFilter(results, filter = "all", user = null) {
  if (!results || !Array.isArray(results)) return [];
  if (!filter || filter === "all") return results;

  return results.filter((item) => {
    const fileType = (item.fileType || "").toLowerCase();
    const fileName = (item.fileName || "").toLowerCase();
    const caption = (item.caption || "").toLowerCase();
    const combined = `${fileName} ${caption}`;

    if (filter === "exam") {
      const isExamText =
        combined.includes("exam") ||
        combined.includes("mid") ||
        combined.includes("final") ||
        combined.includes("test") ||
        combined.includes("quiz");
      return (
        fileType === "image" ||
        Boolean(item._isGrouped) ||
        Boolean(item.groupId) ||
        Boolean(item.isExam) ||
        isExamText
      );
    }
    if (filter === "ppt") {
      return (
        fileType === "ppt" ||
        fileType === "pptx" ||
        combined.includes(".ppt") ||
        combined.includes(".pptx") ||
        combined.includes("slide") ||
        combined.includes("presentation")
      );
    }
    if (filter === "pdf") {
      return fileType === "pdf" || combined.includes(".pdf");
    }
    if (filter === "uni") {
      if (!user || !user.university) return false;
      const uni = user.university.toLowerCase();
      const channel = (item.channelUsername || "").toLowerCase();
      return combined.includes(uni) || channel.includes(uni);
    }
    return true;
  });
}

async function sendPaginatedResults(
  ctx,
  results,
  query,
  queryHash,
  page = 1,
  activeFilter = "all",
  user = null
) {
  if (!results || results.length === 0) {
    const { getZeroResultSuggestions } = require("../search/typoCorrector");
    const rawSuggestions = getZeroResultSuggestions(query, 3);
    const suggestionItems = [];

    for (const sug of rawSuggestions) {
      const hash = crypto
        .createHash("md5")
        .update(sug)
        .digest("hex")
        .substring(0, 8);
      await QuerySession.findOneAndUpdate(
        { queryHash: hash },
        { queryHash: hash, query: sug },
        { upsert: true }
      );
      suggestionItems.push({ query: sug, hash });
    }

    const { text, keyboard } = templates.renderNoResults(query, suggestionItems);
    const replyMarkup =
      keyboard.length > 0 ? Markup.inlineKeyboard(keyboard).reply_markup : undefined;

    if (ctx.updateType === "callback_query") {
      return await ctx
        .editMessageText(text, { parse_mode: "HTML", reply_markup: replyMarkup })
        .catch(() => {});
    }
    return await ctx.reply(text, { parse_mode: "HTML", reply_markup: replyMarkup });
  }

  await QuerySession.findOneAndUpdate(
    { queryHash },
    { queryHash, query },
    { upsert: true }
  );

  const filteredResults = applyResultFilter(results, activeFilter, user);

  const ITEMS_PER_PAGE = 10;
  const totalItems = filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentBatch = filteredResults.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const messageText = templates.renderListTemplate(
    query,
    totalItems,
    currentPage,
    totalPages,
    currentBatch,
    activeFilter,
    user
  );

  const keyboard = [];

  // 1-Tap Filter Pills row
  const filterPills = templates.renderFilterPills(queryHash, activeFilter);
  keyboard.push(...filterPills);

  // Number selection buttons for current batch
  if (currentBatch.length > 0) {
    const numberButtons = templates.renderNumberButtons(
      queryHash,
      currentPage,
      currentBatch.length,
      activeFilter
    );
    keyboard.push(...numberButtons);
  }

  // Pagination navigation (if multiple pages)
  if (totalPages > 1) {
    const navButtons = templates.renderNavButtons(
      queryHash,
      currentPage,
      totalPages,
      activeFilter
    );
    keyboard.push(navButtons);
  }

  const buttons = Markup.inlineKeyboard(keyboard);

  if (ctx.updateType === "callback_query") {
    await ctx
      .editMessageText(messageText, {
        parse_mode: "HTML",
        reply_markup: buttons.reply_markup,
      })
      .catch(() => {});
  } else {
    await ctx.reply(messageText, {
      parse_mode: "HTML",
      reply_markup: buttons.reply_markup,
    });
  }
}

function formatChannelUrl(url, channelUsername, messageId) {
  if (channelUsername && messageId) {
    return `https://t.me/${channelUsername}/${messageId}`;
  }
  if (channelUsername) {
    return `https://t.me/${channelUsername}`;
  }
  if (url) {
    const match = url.match(/domain=([^&]+)(?:&post=(\d+))?/);
    if (match) {
      const ch = match[1];
      const msg = match[2];
      return msg ? `https://t.me/${ch}/${msg}` : `https://t.me/${ch}`;
    }
    if (url.startsWith("https://t.me/")) return url;
  }
  return null;
}

async function renderDetailCardHandler(
  ctx,
  results,
  queryHash,
  page,
  resultIndex,
  activeFilter = "all",
  user = null
) {
  const session = await QuerySession.findOne({ queryHash });
  const query = session ? session.query : "";
  const filteredResults = applyResultFilter(results, activeFilter, user);

  const ITEMS_PER_PAGE = 10;
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const currentBatch = filteredResults.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const resource = currentBatch[resultIndex];

  if (!resource) return await ctx.answerCbQuery("Result not found", { show_alert: true });

  let cardText = "";
  let buttons = [];

  if (resource._telegramResource) {
    cardText = templates.renderDetailCard(resource, user);

    const isGroup = resource._isGrouped || false;
    let buttonText = isGroup ? `📥 Get all ${resource.groupSize} images` : `📥 Get file`;
    let actionPrefix = isGroup ? "grp" : "get";

    buttons.push([
      Markup.button.callback(buttonText, `${actionPrefix}_${resource._id.toString()}`),
      Markup.button.callback("💾 Save", `save_${resource._id.toString()}`),
      Markup.button.callback(
        "⚠️ Report",
        `rep_${queryHash}_${page}_${resultIndex}_${activeFilter}`
      ),
    ]);

    const channelUrl = formatChannelUrl(null, resource.channelUsername, resource.messageId);
    if (channelUrl) {
      buttons.push([Markup.button.url("🔗 View in Channel", channelUrl)]);
    }
  } else {
    let title = resource.title || "GitHub Repository";
    cardText += `💻 <b>${templates.escapeHTML(title)}</b>\n📌 Source: GitHub\n`;
    if (resource.description) {
      let desc = resource.description.replace(/\n/g, ' ').substring(0, 120);
      cardText += `\n📝 <i>${templates.escapeHTML(desc)}...</i>`;
    }
    buttons.push([Markup.button.url("🔗 View on GitHub", resource.url)]);
    buttons.push([Markup.button.callback("💾 Save", `save_web_${resource.url}`)]);
  }

  buttons.push([Markup.button.callback("◀ Back to list", `back_${queryHash}_${page}_${activeFilter}`)]);

  await ctx.editMessageText(cardText, { parse_mode: "HTML", reply_markup: Markup.inlineKeyboard(buttons).reply_markup }).catch(() => {});
}

async function sendPaginatedSaves(ctx, results, page = 1) {
  if (!results || results.length === 0) {
    return await ctx.reply(`😕 You haven't saved any resources yet!`);
  }

  const ITEMS_PER_PAGE = 10;
  const totalItems = results.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentBatch = results.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  let messageText = `📚 <b>Your Saved Resources</b> (${totalItems} total)\n\n`;
  messageText += `<code>──────────────────────</code>\n`;

  const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

  currentBatch.forEach((saved, idx) => {
    const numEmoji = numberEmojis[idx] || `${idx + 1}.`;

    let typeEmoji = "📎";
    if (saved.source === "telegram") {
      typeEmoji = { pdf: "📄", ppt: "📊", image: "🖼️", doc: "📝", notes: "📓" }[saved.type] || "📎";
    } else {
      typeEmoji = "💻";
    }

    let title = saved.title || "Unnamed Resource";
    if (title.length > 55) title = title.substring(0, 54) + "…";

    messageText += `${numEmoji}  ${templates.escapeHTML(title)} ${typeEmoji}\n`;
  });

  messageText += `<code>──────────────────────</code>`;

  const keyboard = templates.renderNumberButtons("saves", currentPage, currentBatch.length);
  keyboard.push(templates.renderNavButtons("saves", currentPage, totalPages));

  const buttons = Markup.inlineKeyboard(keyboard);

  if (ctx.updateType === 'callback_query') {
    await ctx.editMessageText(messageText, { parse_mode: "HTML", reply_markup: buttons.reply_markup }).catch(() => {});
  } else {
    await ctx.reply(messageText, { parse_mode: "HTML", reply_markup: buttons.reply_markup });
  }
}

async function renderSavedDetailCard(ctx, results, page, resultIndex) {
  const ITEMS_PER_PAGE = 10;
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const currentBatch = results.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const saved = currentBatch[resultIndex];

  if (!saved) return await ctx.answerCbQuery("Result not found", { show_alert: true });

  let cardText = `<code>──────────────────────</code>\n`;
  let buttons = [];

  if (saved.source === "telegram" && saved.telegramResourceId) {
    const typeEmoji = { pdf: "📄", ppt: "📊", image: "🖼️", doc: "📝", notes: "📓" }[saved.type] || "📎";
    cardText += `${typeEmoji} <b>${templates.escapeHTML(saved.title)}</b>\n`;
    cardText += `\n📝 <i>Saved Resource</i>\n`;

    buttons.push([Markup.button.callback("📥 Get file", `get_${saved.telegramResourceId.toString()}`)]);

    const channelUrl = formatChannelUrl(saved.url, saved.channelUsername, null);
    if (channelUrl) {
      buttons.push([Markup.button.url("🔗 View in Channel", channelUrl)]);
    }
  } else {
    cardText += `💻 <b>${templates.escapeHTML(saved.title)}</b>\n📌 Source: ${saved.source}\n`;
    buttons.push([Markup.button.url("🔗 View on GitHub", saved.url)]);
  }

  cardText += `<code>──────────────────────</code>`;

  buttons.push([Markup.button.callback("❌ Remove Save", `unsave_${saved._id.toString()}`)]);
  buttons.push([Markup.button.callback("◀ Back to list", `pg_saves_${page}`)]);

  await ctx.editMessageText(cardText, { parse_mode: "HTML", reply_markup: Markup.inlineKeyboard(buttons).reply_markup }).catch(() => {});
}

// ---------------- DELIVERY ENGINE -------------------

const pendingDeliveries = new Map();
const pendingGroups = new Map();
const activeUserRequests = new Set();
const recentRelayMessages = new Map();

async function getPendingDeliveryDebugInfo() {
  return {
    pendingDeliveries: pendingDeliveries.size,
    pendingGroups: pendingGroups.size,
    activeUserRequests: activeUserRequests.size
  };
}

function normalizeForwarded(fwd) {
   if (Array.isArray(fwd) && Array.isArray(fwd[0])) return fwd[0];
   if (fwd && fwd.updates && Array.isArray(fwd.updates)) {
       return fwd.updates.filter(u => u.className === 'UpdateNewMessage' || u.className === 'UpdateNewChannelMessage').map(u => u.message);
   }
   return fwd;
}

function startChatAction(ctx, userId, actionType = 'upload_document') {
  ctx.telegram.sendChatAction(userId, actionType).catch(() => {});
  return setInterval(() => {
    ctx.telegram.sendChatAction(userId, actionType).catch(() => {});
  }, 4500);
}

async function autoArchiveSingle(tg, resource, archiveChatId) {
  try {
    if (!tg || !archiveChatId || resource.archiveMessageId) return;
    const fwd = normalizeForwarded(
      await tg.forwardMessages(archiveChatId, {
        messages: [resource.messageId],
        fromPeer: resource.channelUsername
          ? `@${resource.channelUsername}`
          : parseInt(resource.chatId),
      })
    );
    const newArchId = fwd && fwd[0] && fwd[0].id;
    if (newArchId) {
      await TelegramResource.findByIdAndUpdate(resource._id, {
        archiveMessageId: newArchId,
      });
      console.log(
        `[AUTO-ARCHIVE] Successfully backed up ${resource._id} to archive (msgId: ${newArchId})`
      );
    }
  } catch (e) {
    // Non-blocking background auto-archive
  }
}

async function autoArchiveGroup(tg, images, resource, archiveChatId) {
  try {
    if (!tg || !archiveChatId) return;
    const unarchived = images.filter((img) => !img.archiveMessageId);
    if (unarchived.length === 0) return;

    const msgIds = unarchived.map((img) => img.messageId);
    const fwd = normalizeForwarded(
      await tg.forwardMessages(archiveChatId, {
        messages: msgIds,
        fromPeer: resource.channelUsername
          ? `@${resource.channelUsername}`
          : parseInt(resource.chatId),
      })
    );

    if (fwd && fwd.length === unarchived.length) {
      for (let i = 0; i < unarchived.length; i++) {
        if (fwd[i] && fwd[i].id) {
          await TelegramResource.findByIdAndUpdate(unarchived[i]._id, {
            archiveMessageId: fwd[i].id,
          });
        }
      }
      console.log(
        `[AUTO-ARCHIVE] Group ${resource.groupId} backed up ${fwd.length} images to archive`
      );
    }
  } catch (e) {
    // Non-blocking background auto-archive
  }
}

async function handleDownload(ctx, resourceId) {
  const userId = ctx.from.id;
  const requestKey = `${userId}_${resourceId}`;

  if (activeUserRequests.has(requestKey)) {
    if (ctx.callbackQuery) {
      return await ctx.answerCbQuery("⏳ Already sending your file, please wait...", { show_alert: true });
    }
    return await ctx.reply("⏳ Already sending your file, please wait...");
  }
  activeUserRequests.add(requestKey);
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery("📥 Fetching file...").catch(() => {});
  }

  try {
    const resource = await TelegramResource.findById(resourceId);
    if (!resource) {
      activeUserRequests.delete(requestKey);
      if (ctx.callbackQuery && ctx.editMessageText) {
        return await ctx.editMessageText(templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
      }
      return await ctx.reply(templates.renderError(), { parse_mode: "HTML" });
    }

    const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
    if (ctx.chat.id === relayGroupId) {
      activeUserRequests.delete(requestKey);
      if (ctx.callbackQuery) {
        return await ctx.answerCbQuery("❌ Test in the bot's private chat.", { show_alert: true });
      }
      return await ctx.reply("❌ Test in the bot's private chat.");
    }

    const actionInterval = startChatAction(ctx, userId, resource.fileType === 'image' ? 'upload_photo' : 'upload_document');
    const statusMsg = await ctx.reply("⏳ <i>Securely retrieving your file...</i>", { parse_mode: "HTML" });


    let forwardedMessages;
    let usedArchive = false;
    let tg = null;
    const archiveChatId = process.env.ARCHIVE_CHAT_ID ? parseInt(process.env.ARCHIVE_CHAT_ID) : null;

    try {
      tg = await getClient();

      // 1. Try Archive FIRST if available (archive has zero forwarding restrictions!)
      if (resource.archiveMessageId && archiveChatId) {
        try {
          forwardedMessages = normalizeForwarded(await tg.forwardMessages(relayGroupId, {
            messages: [resource.archiveMessageId],
            fromPeer: archiveChatId
          }));
          usedArchive = true;
          console.log(`[DELIVERY] Retrieved from archive (msgId: ${resource.archiveMessageId})`);
        } catch (archErr) {
          console.warn(`[DELIVERY] Archive forward failed: ${archErr.message}. Trying original channel...`);
        }
      }

      // 2. If not in archive or archive forward failed, try original channel
      if (!forwardedMessages || forwardedMessages.length === 0) {
        forwardedMessages = normalizeForwarded(
          await tg.forwardMessages(relayGroupId, {
            messages: [resource.messageId],
            fromPeer: resource.channelUsername
              ? `@${resource.channelUsername}`
              : parseInt(resource.chatId),
          })
        );

        if (archiveChatId && !resource.archiveMessageId) {
          autoArchiveSingle(tg, resource, archiveChatId).catch(() => {});
        }
      }
    } catch (gramError) {
      console.warn(`[DELIVERY] Primary forward failed: ${gramError.message}`);
      // 3. Fallback to archive if not yet tried
      if (!usedArchive && resource.archiveMessageId && archiveChatId && tg) {
        try {
          forwardedMessages = normalizeForwarded(await tg.forwardMessages(relayGroupId, {
            messages: [resource.archiveMessageId],
            fromPeer: archiveChatId
          }));
          usedArchive = true;
        } catch (archiveErr) {
          console.warn('[ARCHIVE FALLBACK FAIL]', archiveErr.message);
        }
      }

      if (!forwardedMessages || forwardedMessages.length === 0) {
        clearInterval(actionInterval);
        activeUserRequests.delete(requestKey);
        await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
        return;
      }
    }

    if (!forwardedMessages || forwardedMessages.length === 0 || !forwardedMessages[0].id) {
       clearInterval(actionInterval);
       activeUserRequests.delete(requestKey);
       await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
       return;
    }

    const newMsgId = forwardedMessages[0].id;

    if (recentRelayMessages.has(newMsgId)) {
        clearInterval(actionInterval);
        await ctx.telegram.sendMessage(userId, templates.renderFileDelivered(resource.channelUsername || "Private Channel"), { parse_mode: "HTML" });
        await ctx.telegram.copyMessage(userId, relayGroupId, newMsgId, { caption: "" }).catch(() => {});
        await ctx.telegram.deleteMessage(userId, statusMsg.message_id).catch(() => {});
        await ctx.telegram.deleteMessage(relayGroupId, newMsgId).catch(() => {});
        activeUserRequests.delete(requestKey);
        recordSuccessfulDelivery(userId, resource, "download");
    } else {
        const timeout = setTimeout(async () => {
          if (pendingDeliveries.has(newMsgId)) {
            clearInterval(pendingDeliveries.get(newMsgId).actionInterval);
            pendingDeliveries.delete(newMsgId);
            activeUserRequests.delete(requestKey);
            await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
          }
        }, 30000);

        pendingDeliveries.set(newMsgId, {
          userId,
          statusMsgId: statusMsg.message_id,
          resourceId,
          requestKey,
          timeout,
          actionInterval,
          resource
        });
    }

  } catch (err) {
    activeUserRequests.delete(requestKey);
    await ctx.reply(templates.renderError(), { parse_mode: "HTML" });
  }
}

async function sendGroupToUser(ctx, userId, relayGroupId, msgIds, resource = null) {
  try {
    const rawTitle = resource
      ? resource.fileName || resource.caption || "Exam Paper"
      : "Exam Paper";
    let cleanTitle = rawTitle.replace(/\s+/g, " ").trim();
    if (cleanTitle.length > 50) cleanTitle = cleanTitle.substring(0, 49) + "…";
    const channelInfo =
      resource && resource.channelUsername
        ? `\n📡 Source: @${templates.escapeHTML(resource.channelUsername)}`
        : "";

    // Extract photo fileIds from recentRelayMessages
    const fileIds = [];
    for (const id of msgIds) {
      const data = recentRelayMessages.get(id);
      if (data && data.fileId) {
        fileIds.push(data.fileId);
      }
    }

    // If all fileIds were captured as photos, deliver as native Media Group albums!
    if (fileIds.length === msgIds.length && fileIds.length > 1) {
      const CHUNK_SIZE = 10; // Telegram sendMediaGroup max items
      for (let i = 0; i < fileIds.length; i += CHUNK_SIZE) {
        const chunk = fileIds.slice(i, i + CHUNK_SIZE);
        const startPage = i + 1;
        const endPage = i + chunk.length;
        const isMultiChunk = fileIds.length > CHUNK_SIZE;

        const caption = isMultiChunk
          ? `🎓 <b>${templates.escapeHTML(cleanTitle)}</b> (Part ${Math.floor(i / CHUNK_SIZE) + 1} · Pages ${startPage}-${endPage})${channelInfo}`
          : `🎓 <b>${templates.escapeHTML(cleanTitle)}</b> (${fileIds.length} pages)${channelInfo}`;

        const mediaGroup = chunk.map((fileId, idx) => ({
          type: "photo",
          media: fileId,
          caption: idx === 0 ? caption : undefined,
          parse_mode: "HTML",
        }));

        await ctx.telegram.sendMediaGroup(userId, mediaGroup);
        if (i + CHUNK_SIZE < fileIds.length) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      return;
    } else if (fileIds.length === 1 && msgIds.length === 1) {
      const caption = `🎓 <b>${templates.escapeHTML(cleanTitle)}</b>${channelInfo}`;
      await ctx.telegram.sendPhoto(userId, fileIds[0], {
        caption,
        parse_mode: "HTML",
      });
      return;
    }
  } catch (albumErr) {
    console.warn(
      "[DELIVERY] sendMediaGroup failed, falling back to sequential copy:",
      albumErr.message
    );
  }

  // Fallback: sequential copyMessage
  for (const id of msgIds) {
    await ctx.telegram
      .copyMessage(userId, relayGroupId, id, { caption: "" })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function handleGroupDownload(ctx, resourceId) {
  const userId = ctx.from.id;
  const requestKey = `${userId}_${resourceId}`;

  if (activeUserRequests.has(requestKey)) {
    if (ctx.callbackQuery) {
      return await ctx.answerCbQuery("⏳ Already sending your file, please wait...", { show_alert: true });
    }
    return await ctx.reply("⏳ Already sending your file, please wait...");
  }
  activeUserRequests.add(requestKey);
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery("📥 Fetching image set...").catch(() => {});
  }

  try {
    const resource = await TelegramResource.findById(resourceId);
    if (!resource) {
      activeUserRequests.delete(requestKey);
      if (ctx.callbackQuery && ctx.editMessageText) {
        return await ctx.editMessageText(templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
      }
      return await ctx.reply(templates.renderError(), { parse_mode: "HTML" });
    }

    const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
    if (ctx.chat.id === relayGroupId) {
      activeUserRequests.delete(requestKey);
      if (ctx.callbackQuery) {
        return await ctx.answerCbQuery("❌ Test in the bot's private chat.", { show_alert: true });
      }
      return await ctx.reply("❌ Test in the bot's private chat.");
    }

    if (!resource.groupId) {
      activeUserRequests.delete(requestKey);
      return await handleDownload(ctx, resourceId);
    }

    const images = await TelegramResource.find({ groupId: resource.groupId }).sort({ messageDate: 1 });
    if (images.length === 0) {
      activeUserRequests.delete(requestKey);
      return await ctx.reply(templates.renderError(), { parse_mode: "HTML" });
    }

    const actionInterval = startChatAction(ctx, userId, 'upload_photo');
    const statusMsg = await ctx.reply(`⏳ <i>Retrieving ${images.length} images...</i>`, { parse_mode: "HTML" });


    const messageIds = images.map(img => img.messageId);
    let forwardedMessages;
    let usedArchive = false;
    let tg = null;
    const archiveChatId = process.env.ARCHIVE_CHAT_ID ? parseInt(process.env.ARCHIVE_CHAT_ID) : null;

    try {
      tg = await getClient();
      const archiveIds = images.map(img => img.archiveMessageId).filter(Boolean);

      // 1. If images are in the archive, try ARCHIVE first! (Archive has NO forward restrictions!)
      if (archiveChatId && archiveIds.length === images.length) {
        try {
          forwardedMessages = normalizeForwarded(await tg.forwardMessages(relayGroupId, {
            messages: archiveIds,
            fromPeer: archiveChatId
          }));
          usedArchive = true;
          console.log(`[DELIVERY] Retrieved full image set (${archiveIds.length} imgs) from archive`);
        } catch (archErr) {
          console.warn(`[DELIVERY] Archive group forward failed: ${archErr.message}. Trying original channel...`);
        }
      }

      // 2. If not in archive or archive forward failed, try original channel
      if (!forwardedMessages || forwardedMessages.length === 0) {
        forwardedMessages = normalizeForwarded(
          await tg.forwardMessages(relayGroupId, {
            messages: messageIds,
            fromPeer: resource.channelUsername
              ? `@${resource.channelUsername}`
              : parseInt(resource.chatId),
          })
        );

        if (archiveChatId && images.some((img) => !img.archiveMessageId)) {
          autoArchiveGroup(tg, images, resource, archiveChatId).catch(() => {});
        }
      }
    } catch (gramError) {
      console.warn(`[DELIVERY] Primary group forward failed: ${gramError.message}`);
      // 3. Fallback to archive if not yet used
      const archiveIds = images.map(img => img.archiveMessageId).filter(Boolean);
      if (!usedArchive && archiveIds.length > 0 && archiveChatId && tg) {
        try {
          forwardedMessages = normalizeForwarded(await tg.forwardMessages(relayGroupId, {
            messages: archiveIds,
            fromPeer: archiveChatId
          }));
          usedArchive = true;
          console.log(`[DELIVERY] Fallback archive delivered ${archiveIds.length} of ${images.length} imgs`);
        } catch (err) {
          console.warn('[ARCHIVE FALLBACK FAIL]', err.message);
        }
      }

      if (!forwardedMessages || forwardedMessages.length === 0) {
        clearInterval(actionInterval);
        activeUserRequests.delete(requestKey);
        await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
        return;
      }
    }

    if (!forwardedMessages || forwardedMessages.length === 0) {
        clearInterval(actionInterval);
        activeUserRequests.delete(requestKey);
        await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
        return;
    }

    const newMsgIds = forwardedMessages.map(m => m && m.id).filter(id => id);
    if (newMsgIds.length === 0) {
         clearInterval(actionInterval);
         activeUserRequests.delete(requestKey);
         await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
         return;
    }

    const expectedMsgIds = new Set(newMsgIds);
    const arrived = [];
    for (const id of newMsgIds) {
        if (recentRelayMessages.has(id)) {
            arrived.push(id);
        }
    }

    if (arrived.length === expectedMsgIds.size) {
        clearInterval(actionInterval);
        await ctx.telegram.sendMessage(userId, templates.renderFileDelivered(resource.channelUsername || "Private Channel"), { parse_mode: "HTML" });
        await sendGroupToUser(ctx, userId, relayGroupId, arrived, resource);
        await ctx.telegram.deleteMessage(userId, statusMsg.message_id).catch(() => {});
        for (const id of arrived) {
             await ctx.telegram.deleteMessage(relayGroupId, id).catch(() => {});
        }
        activeUserRequests.delete(requestKey);
        recordSuccessfulDelivery(userId, resource, "view_set");
    } else {
        const timeout = setTimeout(async () => {
            if (pendingGroups.has(requestKey)) {
                const pg = pendingGroups.get(requestKey);
                clearInterval(pg.actionInterval);
                pendingGroups.delete(requestKey);
                activeUserRequests.delete(requestKey);

                if (pg.arrived.length > 0) {
                    await ctx.telegram.sendMessage(userId, templates.renderFileDelivered(resource.channelUsername || "Private Channel"), { parse_mode: "HTML" });
                    await sendGroupToUser(ctx, userId, relayGroupId, pg.arrived, resource);
                    await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, `⚠️ Sent ${pg.arrived.length} of ${pg.expectedMsgIds.size} images.`).catch(() => {});
                    for (const id of pg.arrived) {
                         await ctx.telegram.deleteMessage(relayGroupId, id).catch(() => {});
                    }
                    recordSuccessfulDelivery(userId, resource, "view_set");
                } else {
                    await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
                }
            }
        }, 30000);

        pendingGroups.set(requestKey, {
            userId,
            statusMsgId: statusMsg.message_id,
            expectedMsgIds,
            arrived,
            requestKey,
            timeout,
            actionInterval,
            resource
        });
    }

  } catch (err) {
    activeUserRequests.delete(requestKey);
    await ctx.reply(templates.renderError(), { parse_mode: "HTML" });
  }
}

// ---------------- HANDLER REGISTRATION -------------------

function registerFileDeliveryHandlers(bot) {
  bot.action(/get_(.+)/, async (ctx) => {
    const resourceId = ctx.match[1];
    await handleDownload(ctx, resourceId);
  });

  bot.action(/grp_(.+)/, async (ctx) => {
    const resourceId = ctx.match[1];
    await handleGroupDownload(ctx, resourceId);
  });

  bot.action(/flt_([a-f0-9]+)_(\d+)_([a-z]+)/, async (ctx) => {
    const queryHash = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    const filter = ctx.match[3];

    const session = await QuerySession.findOne({ queryHash });
    const query = session ? session.query : null;
    if (!query) {
      return await ctx.answerCbQuery("❌ Session expired. Please search again.", { show_alert: true });
    }

    const user = await userService.findByTelegramId(ctx.from.id);

    if (filter === "uni" && (!user || !user.university)) {
      return await ctx.answerCbQuery(
        "ℹ️ Set your university in /profile to use the campus filter!",
        { show_alert: true }
      );
    }

    await ctx.answerCbQuery();
    const results = await orchestrationService.searchResources(query, user);
    await sendPaginatedResults(ctx, results, query, queryHash, page, filter, user);
  });

  bot.action(/pg_([a-f0-9]+|saves)_(\d+)(?:_([a-z]+))?/, async (ctx) => {
    const queryHash = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    const activeFilter = ctx.match[3] || "all";

    await ctx.answerCbQuery();

    if (queryHash === "saves") {
      const user = await userService.findByTelegramId(ctx.from.id);
      const saves = await SavedResource.find({ userId: user._id }).sort({ savedAt: -1 });
      return await sendPaginatedSaves(ctx, saves, page);
    }

    const session = await QuerySession.findOne({ queryHash });
    const query = session ? session.query : null;
    if (!query) return await ctx.answerCbQuery("❌ Session expired. Please search again.", { show_alert: true });

    const user = await userService.findByTelegramId(ctx.from.id);
    const results = await orchestrationService.searchResources(query, user);
    await sendPaginatedResults(ctx, results, query, queryHash, page, activeFilter, user);
  });

  bot.action(/num_([a-f0-9]+|saves)_(\d+)_(\d+)(?:_([a-z]+))?/, async (ctx) => {
    const queryHash = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    const resultIndex = parseInt(ctx.match[3], 10);
    const activeFilter = ctx.match[4] || "all";

    await ctx.answerCbQuery();

    if (queryHash === "saves") {
      const user = await userService.findByTelegramId(ctx.from.id);
      const saves = await SavedResource.find({ userId: user._id }).sort({ savedAt: -1 });
      return await renderSavedDetailCard(ctx, saves, page, resultIndex);
    }

    const session = await QuerySession.findOne({ queryHash });
    const query = session ? session.query : null;
    if (!query) return await ctx.answerCbQuery("❌ Session expired. Please search again.", { show_alert: true });

    const user = await userService.findByTelegramId(ctx.from.id);
    const results = await orchestrationService.searchResources(query, user);
    await renderDetailCardHandler(ctx, results, queryHash, page, resultIndex, activeFilter, user);
  });

  bot.action(/back_([a-f0-9]+|saves)_(\d+)(?:_([a-z]+))?/, async (ctx) => {
    const queryHash = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    const activeFilter = ctx.match[3] || "all";

    await ctx.answerCbQuery();

    if (queryHash === "saves") {
      const user = await userService.findByTelegramId(ctx.from.id);
      const saves = await SavedResource.find({ userId: user._id }).sort({ savedAt: -1 });
      return await sendPaginatedSaves(ctx, saves, page);
    }

    const session = await QuerySession.findOne({ queryHash });
    const query = session ? session.query : null;
    if (!query) return await ctx.answerCbQuery("❌ Session expired. Please search again.", { show_alert: true });

    const user = await userService.findByTelegramId(ctx.from.id);
    const results = await orchestrationService.searchResources(query, user);
    await sendPaginatedResults(ctx, results, query, queryHash, page, activeFilter, user);
  });

  bot.action(/save_web_(.+)/, async (ctx) => {
    await ctx.answerCbQuery("Coming soon for web resources!", { show_alert: true });
  });

  bot.action(/save_([a-f0-9]{24})/, async (ctx) => {
    const resourceId = ctx.match[1];
    const user = await userService.findByTelegramId(ctx.from.id);
    if (!user) return await ctx.answerCbQuery("User not found.", { show_alert: true });

    try {
      const existing = await SavedResource.findOne({ userId: user._id, telegramResourceId: resourceId });
      if (existing) return await ctx.answerCbQuery("Already saved!", { show_alert: true });

      const resource = await TelegramResource.findById(resourceId);
      if (!resource) return await ctx.answerCbQuery("Resource not found.", { show_alert: true });

      const newSave = new SavedResource({
        userId: user._id,
        telegramResourceId: resource._id,
        title: resource.fileName || resource.caption || "Unnamed Telegram File",
        url: `tg://resolve?domain=${resource.channelUsername}&post=${resource.messageId}`,
        source: "telegram",
        type: resource.fileType
      });
      await newSave.save();
      await ctx.answerCbQuery("✅ Resource saved!", { show_alert: false });
    } catch (e) {
      console.error("Error on saving resource: ", e)
      await ctx.answerCbQuery("❌ Error saving resource.", { show_alert: true });
    }
  });

  bot.action(/unsave_([a-f0-9]{24})/, async (ctx) => {
    const saveId = ctx.match[1];
    await ctx.answerCbQuery("🗑️ Removed from saves.", { show_alert: false });
    await SavedResource.findByIdAndDelete(saveId);
    await ctx.editMessageText(
      "🗑️ <i>Resource removed from your saves.</i>",
      {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback("◀ Back to Saves", "pg_saves_1")],
        ]).reply_markup,
      }
    ).catch(() => {});
  });

  bot.action("noop", async (ctx) => {
    await ctx.answerCbQuery();
  });

  bot.action(/rep_([a-f0-9]+)_(\d+)_(\d+)(?:_([a-z]+))?/, async (ctx) => {
    const queryHash = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    const resultIndex = parseInt(ctx.match[3], 10);
    const activeFilter = ctx.match[4] || "all";

    await ctx.answerCbQuery();

    const session = await QuerySession.findOne({ queryHash });
    const query = session ? session.query : null;
    if (!query) {
      return await ctx.answerCbQuery(
        "❌ Session expired. Please search again.",
        { show_alert: true }
      );
    }

    const user = await userService.findByTelegramId(ctx.from.id);
    const results = await orchestrationService.searchResources(query, user);
    const filteredResults = applyResultFilter(results, activeFilter, user);

    const ITEMS_PER_PAGE = 10;
    const startIdx = (page - 1) * ITEMS_PER_PAGE;
    const currentBatch = filteredResults.slice(
      startIdx,
      startIdx + ITEMS_PER_PAGE
    );
    const resource = currentBatch[resultIndex];

    if (!resource) {
      return await ctx.answerCbQuery("Result not found.", { show_alert: true });
    }

    const prompt = templates.renderReportPrompt(
      resource,
      queryHash,
      page,
      resultIndex,
      activeFilter
    );
    await ctx
      .editMessageText(prompt.text, {
        parse_mode: "HTML",
        reply_markup: Markup.inlineKeyboard(prompt.keyboard).reply_markup,
      })
      .catch(() => {});
  });

  bot.action(/repsub_([a-f0-9]{24})_([a-z_]+)/, async (ctx) => {
    const resourceId = ctx.match[1];
    const reason = ctx.match[2];

    const user = await userService.findByTelegramId(ctx.from.id);
    if (!user) {
      return await ctx.answerCbQuery("User not found.", { show_alert: true });
    }

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 3600000);
      const existing = await ResourceReport.findOne({
        userId: user._id,
        resourceId,
        reportedAt: { $gt: oneDayAgo },
      });

      if (existing) {
        return await ctx.answerCbQuery(
          "ℹ️ You have already reported this file. Our team is investigating!",
          { show_alert: true }
        );
      }

      const resource = await TelegramResource.findById(resourceId);
      await ResourceReport.create({
        userId: user._id,
        telegramId: Number(ctx.from.id),
        resourceId,
        reason,
        resourceTitle: resource
          ? resource.fileName || resource.caption || "Untitled Resource"
          : "Untitled Resource",
        channelUsername: resource ? resource.channelUsername : null,
        status: "pending",
      });

      if (resource) {
        await TelegramResource.findByIdAndUpdate(resourceId, {
          $inc: { reportCount: 1 },
        }).catch(() => {});
      }

      await ctx.answerCbQuery(
        "✅ Report submitted! Thank you for helping keep StudyHub clean.",
        { show_alert: true }
      );

      const submitted = templates.renderReportSubmitted("noop");
      await ctx
        .editMessageText(submitted.text, {
          parse_mode: "HTML",
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback("🗑️ Dismiss", "dismiss_report_msg")],
          ]).reply_markup,
        })
        .catch(() => {});
    } catch (err) {
      console.error("Error submitting resource report:", err);
      await ctx.answerCbQuery("❌ Error submitting report.", {
        show_alert: true,
      });
    }
  });

  bot.action("dismiss_report_msg", async (ctx) => {
    await ctx.deleteMessage().catch(() => {});
  });

  bot.on('message', async (ctx, next) => {
    const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
    if (ctx.chat.id === relayGroupId) {
      const msgId = ctx.message.message_id;
      const photo = ctx.message.photo;
      const fileId =
        photo && photo.length > 0 ? photo[photo.length - 1].file_id : null;
      recentRelayMessages.set(msgId, { timestamp: Date.now(), fileId });

      for (const [id, data] of recentRelayMessages.entries()) {
        if (Date.now() - data.timestamp > 60000) recentRelayMessages.delete(id);
      }

      if (pendingDeliveries.has(msgId)) {
        const pending = pendingDeliveries.get(msgId);
        clearTimeout(pending.timeout);
        clearInterval(pending.actionInterval);
        pendingDeliveries.delete(msgId);
        activeUserRequests.delete(pending.requestKey);

        await ctx.telegram.sendMessage(pending.userId, templates.renderFileDelivered(pending.resource.channelUsername || "Private Channel"), { parse_mode: "HTML" });
        await ctx.telegram.copyMessage(pending.userId, relayGroupId, msgId, { caption: "" }).catch(() => {});
        await ctx.telegram.deleteMessage(pending.userId, pending.statusMsgId).catch(() => {});
        await ctx.telegram.deleteMessage(relayGroupId, msgId).catch(() => {});
        recordSuccessfulDelivery(pending.userId, pending.resource, "download");
      }

      for (const [key, groupPending] of pendingGroups.entries()) {
        if (groupPending.expectedMsgIds.has(msgId)) {
          if (!groupPending.arrived.includes(msgId)) {
              groupPending.arrived.push(msgId);
          }
          if (groupPending.arrived.length === groupPending.expectedMsgIds.size) {
            clearTimeout(groupPending.timeout);
            clearInterval(groupPending.actionInterval);
            pendingGroups.delete(key);
            activeUserRequests.delete(groupPending.requestKey);

            await ctx.telegram.sendMessage(groupPending.userId, templates.renderFileDelivered(groupPending.resource.channelUsername || "Private Channel"), { parse_mode: "HTML" });
            await sendGroupToUser(ctx, groupPending.userId, relayGroupId, groupPending.arrived, groupPending.resource);
            await ctx.telegram.deleteMessage(groupPending.userId, groupPending.statusMsgId).catch(() => {});
            for (const id of groupPending.arrived) {
                 await ctx.telegram.deleteMessage(relayGroupId, id).catch(() => {});
            }
            recordSuccessfulDelivery(groupPending.userId, groupPending.resource, "view_set");
          }
        }
      }
    }

    if (ctx.message.text === '/get_chat_id') {
      await ctx.reply(`This chat ID is: \`${ctx.chat.id}\``, { parse_mode: "Markdown" });
    }
    if (ctx.message.forward_from_chat && ctx.message.forward_from_chat.type === 'channel') {
      const forwardedChatId = ctx.message.forward_from_chat.id;
    }

    return next();
  });

  bot.on('channel_post', async (ctx, next) => {
    if (ctx.channelPost && ctx.channelPost.text === '/get_archive_id') {
      await ctx.telegram.sendMessage(ctx.chat.id, `This Archive Chat ID is: \`${ctx.chat.id}\``, { parse_mode: "Markdown" }).catch(() => {});
    }
    return next();
  });
}

module.exports = {
  sendPaginatedResults,
  sendPaginatedSaves,
  registerFileDeliveryHandlers,
  getPendingDeliveryDebugInfo,
  handleDownload,
  handleGroupDownload,
};
