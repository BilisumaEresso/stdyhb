const { Markup } = require("telegraf");
const crypto = require("crypto");
const { getClient } = require("../search/telegramIndexer");
const TelegramResource = require("../db/models/TelegramResource");
const orchestrationService = require("../search/search.service");
const userService = require("../services/user.service");
const SavedResource = require("../db/models/SavedResource");
const CachedSearch = require("../db/models/CachedSearch");
const QuerySession = require("../db/models/QuerySession");

const templates = require("./templates");

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



async function sendPaginatedResults(ctx, results, query, queryHash, page = 1) {
  if (!results || results.length === 0) {
    const text = templates.renderNoResults(query);
    return await ctx.reply(text, { parse_mode: "HTML" });
  }

  await QuerySession.findOneAndUpdate(
    { queryHash },
    { queryHash, query },
    { upsert: true }
  );

  const ITEMS_PER_PAGE = 10;
  const totalItems = results.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const currentPage = Math.max(1, Math.min(page, totalPages));

  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentBatch = results.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const messageText = templates.renderListTemplate(query, totalItems, currentPage, totalPages, currentBatch);

  const keyboard = [];

  const numberButtons = templates.renderNumberButtons(queryHash, currentPage, currentBatch.length);
  keyboard.push(...numberButtons);

  const navButtons = templates.renderNavButtons(queryHash, currentPage, totalPages);
  keyboard.push(navButtons);

  const buttons = Markup.inlineKeyboard(keyboard);

  if (ctx.updateType === 'callback_query') {
    await ctx.editMessageText(messageText, { parse_mode: "HTML", reply_markup: buttons.reply_markup }).catch(() => {});
  } else {
    await ctx.reply(messageText, { parse_mode: "HTML", reply_markup: buttons.reply_markup });
  }
}

async function renderDetailCardHandler(ctx, results, queryHash, page, resultIndex) {
  const session = await QuerySession.findOne({ queryHash });
  const query = session ? session.query : "";
  const ITEMS_PER_PAGE = 10;
  const startIdx = (page - 1) * ITEMS_PER_PAGE;
  const currentBatch = results.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const resource = currentBatch[resultIndex];

  if (!resource) return await ctx.answerCbQuery("Result not found", { show_alert: true });

  let cardText = "";
  let buttons = [];

  if (resource._telegramResource) {
    cardText = templates.renderDetailCard(resource);

    const isGroup = resource._isGrouped || false;
    let buttonText = isGroup ? `📥 Get all ${resource.groupSize} images` : `📥 Get file`;
    let actionPrefix = isGroup ? "grp" : "get";

    buttons.push([
      Markup.button.callback(buttonText, `${actionPrefix}_${resource._id.toString()}`),
      Markup.button.callback("💾 Save", `save_${resource._id.toString()}`)
    ]);
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

  buttons.push([Markup.button.callback("◀ Back to list", `back_${queryHash}_${page}`)]);

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

async function handleDownload(ctx, resourceId) {
  const userId = ctx.from.id;
  const requestKey = `${userId}_${resourceId}`;

  if (activeUserRequests.has(requestKey)) {
    return await ctx.answerCbQuery("⏳ Already sending your file, please wait...", { show_alert: true });
  }
  activeUserRequests.add(requestKey);
  await ctx.answerCbQuery("📥 Fetching file...");

  try {
    const resource = await TelegramResource.findById(resourceId);
    if (!resource) {
      activeUserRequests.delete(requestKey);
      return await ctx.editMessageText(templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
    }

    const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
    if (ctx.chat.id === relayGroupId) {
      activeUserRequests.delete(requestKey);
      return await ctx.answerCbQuery("❌ Test in the bot's private chat.", { show_alert: true });
    }

    const actionInterval = startChatAction(ctx, userId, resource.fileType === 'image' ? 'upload_photo' : 'upload_document');
    const statusMsg = await ctx.reply("⏳ <i>Securely retrieving your file...</i>", { parse_mode: "HTML" });

    const tg = await getClient();
    let forwardedMessages;
    let usedArchive = false;

    try {
      forwardedMessages = normalizeForwarded(await tg.forwardMessages(relayGroupId, {
        messages: [resource.messageId],
        fromPeer: resource.channelUsername ? `@${resource.channelUsername}` : parseInt(resource.chatId)
      }));
    } catch (gramError) {
      if (resource.archiveMessageId && process.env.ARCHIVE_CHAT_ID) {
        try {
          const archiveChatId = parseInt(process.env.ARCHIVE_CHAT_ID);
          forwardedMessages = normalizeForwarded(await tg.forwardMessages(relayGroupId, {
            messages: [resource.archiveMessageId],
            fromPeer: archiveChatId
          }));
          usedArchive = true;
        } catch (err) {
          console.warn('[ARCHIVE FALLBACK FAIL]', err.message);
        }
      }

      if (!usedArchive) {
        clearInterval(actionInterval);
        await markResourceUnavailable(resourceId);
        activeUserRequests.delete(requestKey);
        await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
        return;
      }
    }

    if (!forwardedMessages || forwardedMessages.length === 0 || !forwardedMessages[0].id) {
       clearInterval(actionInterval);
       if (!usedArchive) await markResourceUnavailable(resourceId);
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

async function sendGroupToUser(ctx, userId, relayGroupId, msgIds) {
    for (const id of msgIds) {
        await ctx.telegram.copyMessage(userId, relayGroupId, id, { caption: "" }).catch(() => {});
        await new Promise(r => setTimeout(r, 150));
    }
}

async function handleGroupDownload(ctx, resourceId) {
  const userId = ctx.from.id;
  const requestKey = `${userId}_${resourceId}`;

  if (activeUserRequests.has(requestKey)) {
    return await ctx.answerCbQuery("⏳ Already sending your file, please wait...", { show_alert: true });
  }
  activeUserRequests.add(requestKey);
  await ctx.answerCbQuery("📥 Fetching image set...");

  try {
    const resource = await TelegramResource.findById(resourceId);
    if (!resource) {
      activeUserRequests.delete(requestKey);
      return await ctx.editMessageText(templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
    }

    const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
    if (ctx.chat.id === relayGroupId) {
      activeUserRequests.delete(requestKey);
      return await ctx.answerCbQuery("❌ Test in the bot's private chat.", { show_alert: true });
    }

    const images = await TelegramResource.find({ groupId: resource.groupId }).sort({ messageDate: 1 });
    if (images.length === 0) {
      activeUserRequests.delete(requestKey);
      return await ctx.reply(templates.renderError(), { parse_mode: "HTML" });
    }

    const actionInterval = startChatAction(ctx, userId, 'upload_photo');
    const statusMsg = await ctx.reply(`⏳ <i>Retrieving ${images.length} images...</i>`, { parse_mode: "HTML" });

    const tg = await getClient();
    const messageIds = images.map(img => img.messageId);
    let forwardedMessages;
    let usedArchive = false;

    try {
      forwardedMessages = normalizeForwarded(await tg.forwardMessages(relayGroupId, {
        messages: messageIds,
        fromPeer: resource.channelUsername ? `@${resource.channelUsername}` : parseInt(resource.chatId)
      }));
    } catch (gramError) {
      const archiveIds = images[0].archiveMessageIds || images.map(img => img.archiveMessageId).filter(id => id);
      if (archiveIds.length === images.length && process.env.ARCHIVE_CHAT_ID) {
        try {
          const archiveChatId = parseInt(process.env.ARCHIVE_CHAT_ID);
          forwardedMessages = normalizeForwarded(await tg.forwardMessages(relayGroupId, {
            messages: archiveIds,
            fromPeer: archiveChatId
          }));
          usedArchive = true;
        } catch (err) {
          console.warn('[ARCHIVE FALLBACK FAIL]', err.message);
        }
      }

      if (!usedArchive) {
        clearInterval(actionInterval);
        await markResourceUnavailable(null, resource.groupId);
        activeUserRequests.delete(requestKey);
        await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, templates.renderError(), { parse_mode: "HTML" }).catch(() => {});
        return;
      }
    }

    if (!forwardedMessages || forwardedMessages.length === 0) {
        clearInterval(actionInterval);
        if (!usedArchive) await markResourceUnavailable(null, resource.groupId);
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
        await sendGroupToUser(ctx, userId, relayGroupId, arrived);
        await ctx.telegram.deleteMessage(userId, statusMsg.message_id).catch(() => {});
        for (const id of arrived) {
             await ctx.telegram.deleteMessage(relayGroupId, id).catch(() => {});
        }
        activeUserRequests.delete(requestKey);
    } else {
        const timeout = setTimeout(async () => {
            if (pendingGroups.has(requestKey)) {
                const pg = pendingGroups.get(requestKey);
                clearInterval(pg.actionInterval);
                pendingGroups.delete(requestKey);
                activeUserRequests.delete(requestKey);

                if (pg.arrived.length > 0) {
                    await ctx.telegram.sendMessage(userId, templates.renderFileDelivered(resource.channelUsername || "Private Channel"), { parse_mode: "HTML" });
                    await sendGroupToUser(ctx, userId, relayGroupId, pg.arrived);
                    await ctx.telegram.editMessageText(userId, statusMsg.message_id, null, `⚠️ Sent ${pg.arrived.length} of ${pg.expectedMsgIds.size} images.`).catch(() => {});
                    for (const id of pg.arrived) {
                         await ctx.telegram.deleteMessage(relayGroupId, id).catch(() => {});
                    }
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

  bot.action(/pg_([a-f0-9]+|saves)_(\d+)/, async (ctx) => {
    const queryHash = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);

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
    await sendPaginatedResults(ctx, results, query, queryHash, page);
  });

  bot.action(/num_([a-f0-9]+|saves)_(\d+)_(\d+)/, async (ctx) => {
    const queryHash = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    const resultIndex = parseInt(ctx.match[3], 10);

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
    await renderDetailCardHandler(ctx, results, queryHash, page, resultIndex);
  });

  bot.action(/back_([a-f0-9]+|saves)_(\d+)/, async (ctx) => {
    const queryHash = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);

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
    await sendPaginatedResults(ctx, results, query, queryHash, page);
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
      await ctx.answerCbQuery("❌ Error saving resource.", { show_alert: true });
    }
  });

  bot.action(/unsave_([a-f0-9]{24})/, async (ctx) => {
    const saveId = ctx.match[1];
    await ctx.answerCbQuery("🗑️ Removed from saves.", { show_alert: false });
    await SavedResource.findByIdAndDelete(saveId);
  });

  bot.action("noop", async (ctx) => {
    await ctx.answerCbQuery();
  });

  bot.on('message', async (ctx, next) => {
    const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
    if (ctx.chat.id === relayGroupId) {
      const msgId = ctx.message.message_id;
      recentRelayMessages.set(msgId, { timestamp: Date.now() });

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
            await sendGroupToUser(ctx, groupPending.userId, relayGroupId, groupPending.arrived);
            await ctx.telegram.deleteMessage(groupPending.userId, groupPending.statusMsgId).catch(() => {});
            for (const id of groupPending.arrived) {
                 await ctx.telegram.deleteMessage(relayGroupId, id).catch(() => {});
            }
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
};
