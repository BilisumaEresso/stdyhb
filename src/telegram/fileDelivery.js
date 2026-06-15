const { Markup } = require("telegraf");

/**
 * Escape HTML characters
 */
function escapeHTML(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .substring(0, 1000);
}

/**
 * Format and send search results as individual cards
 */
async function sendSearchResultsWithButtons(ctx, results) {
  if (!results || results.length === 0) {
    return await ctx.reply("❌ No results found. Try a different search term.");
  }

  await ctx.reply(`✅ <b>Found ${results.length} results.</b> Displaying top matches:\n👇👇👇`, { parse_mode: "HTML" });

  for (let i = 0; i < Math.min(results.length, 10); i++) {
    const resource = results[i];

    if (resource._telegramResource) {
      let cardText = "";
      const typeEmoji =
        {
          pdf: "📄",
          ppt: "📊",
          image: "🖼️",
          video: "🎥",
          doc: "📝",
        }[resource.fileType] || "📎";

      const isGroup = resource._isGrouped;
      let title = resource.title || resource.fileName;
      if (!title && resource.caption) {
        title = resource.caption.substring(0, 30) + "...";
      } else if (!title) {
        title = "Unnamed Resource";
      }
      
      if (isGroup) {
         cardText += `🖼️ <b>${escapeHTML(title)}</b>\n`;
      } else {
         cardText += `${typeEmoji} <b>${escapeHTML(title)}</b>\n`;
      }

      if (resource.isExam) {
        cardText += `🎓 <b>Exam Material</b>\n`;
      }

      if (resource.tags && resource.tags.length > 0) {
        cardText += `🏷️ ${escapeHTML(resource.tags.join(", "))}\n`;
      }

      if (resource.channelUsername) {
        cardText += `📌 Channel: @${escapeHTML(resource.channelUsername)}\n`;
      }

      if (resource.caption) {
        let cleanCaption = resource.caption.replace(/\n/g, ' ');
        let desc = Array.from(cleanCaption).slice(0, 100).join('');
        if (cleanCaption.length > desc.length) desc += '...';
        cardText += `\n📝 <i>${escapeHTML(desc)}</i>\n`;
      }
      
      const resourceIdStr = resource._id.toString();
      
      let buttonText = isGroup ? `📥 Get all ${resource.groupSize} images` : `📥 Get file`;

      const buttons = Markup.inlineKeyboard([
        [Markup.button.callback(buttonText, `get_${resourceIdStr}`)]
      ]);

      await ctx.reply(cardText, { parse_mode: "HTML", reply_markup: buttons.reply_markup });
    } else {
      // Github fallback handling
      const title = resource.title || "GitHub Repository";
      let desc = "";
      if (resource.description) {
        let cleanDesc = resource.description.replace(/\n/g, ' ');
        let truncDesc = Array.from(cleanDesc).slice(0, 100).join('');
        if (cleanDesc.length > truncDesc.length) truncDesc += '...';
        desc = `\n📝 <i>${escapeHTML(truncDesc)}</i>`;
      }
      
      let cardText = `🐙 <b>${escapeHTML(title)}</b>\n📌 Source: GitHub${desc}`;
      
      const buttons = Markup.inlineKeyboard([
        [Markup.button.url("🔗 View on GitHub", resource.url)]
      ]);
      await ctx.reply(cardText, { parse_mode: "HTML", reply_markup: buttons.reply_markup });
    }
    
    // Add small delay to avoid hitting rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  await ctx.reply(`🏁 <b>End of search results</b>`, { parse_mode: "HTML" });
}

const { getClient } = require("../../src/search/telegramIndexer");
const TelegramResource = require("../db/models/TelegramResource");

// Simple mutex queue to prevent race conditions during relay delivery
let deliveryQueue = Promise.resolve();

function runInQueue(fn) {
  return new Promise((resolve, reject) => {
    deliveryQueue = deliveryQueue.then(async () => {
      try {
        resolve(await fn());
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Handle Single File Download
 */
async function handleDownload(ctx, resourceId) {
  try {
    console.log(`\n[DELIVERY] Attempting to deliver single file: ${resourceId}`);
    const resource = await TelegramResource.findById(resourceId);
    if (!resource) {
      console.log(`[DELIVERY FAIL] Resource not found in DB`);
      return await ctx.answerCbQuery("❌ Resource not found.", { show_alert: true });
    }

    if (!process.env.RELAY_GROUP_ID) {
      console.log(`[DELIVERY FAIL] RELAY_GROUP_ID not configured`);
      return await ctx.reply("❌ Bot configuration error: RELAY_GROUP_ID not set.");
    }

    const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
    
    // Prevent copying the message to the Relay Group if the user is testing inside the Relay Group
    const destinationChatId = ctx.chat.id;
    if (destinationChatId === relayGroupId) {
      return await ctx.answerCbQuery("❌ You cannot test delivery inside the Relay Group itself! Test in the bot's private chat.", { show_alert: true });
    }

    await ctx.answerCbQuery("📥 Fetching file...");
    const statusMsg = await ctx.reply("⏳ <i>Securely retrieving your file...</i>", { parse_mode: "HTML" });

    await runInQueue(async () => {
      // 1. GramJS forwards message from source channel to Relay Group
      const tg = await getClient();
      let forwardedMessages;
      let usedArchive = false;

      try {
        forwardedMessages = await tg.forwardMessages(relayGroupId, {
          messages: [resource.messageId],
          fromPeer: resource.channelUsername ? `@${resource.channelUsername}` : parseInt(resource.chatId)
        });
      } catch (gramError) {
        console.error(`[DELIVERY WARN] GramJS Forward Error:`, gramError.message);
        
        // Archive Fallback
        if (resource.archiveMessageId && process.env.ARCHIVE_CHAT_ID) {
          console.log(`[DELIVERY] Falling back to Archive Channel for msg ${resource.archiveMessageId}`);
          try {
            const archiveChatId = parseInt(process.env.ARCHIVE_CHAT_ID);
            forwardedMessages = await tg.forwardMessages(relayGroupId, {
              messages: [resource.archiveMessageId],
              fromPeer: archiveChatId
            });
            usedArchive = true;
          } catch (archiveErr) {
            console.error(`[DELIVERY FAIL] Archive Fallback Error:`, archiveErr.message);
          }
        }

        if (!usedArchive) {
          await TelegramResource.updateOne({ _id: resourceId }, { $set: { isAvailable: false } });
          await ctx.telegram.deleteMessage(destinationChatId, statusMsg.message_id).catch(() => {});
          throw new Error("This resource is no longer available in the source channel or archive.");
        }
      }

      if (!forwardedMessages || forwardedMessages.length === 0) {
        console.log(`[DELIVERY FAIL] GramJS returned empty messages array`);
        if (!usedArchive) await TelegramResource.updateOne({ _id: resourceId }, { $set: { isAvailable: false } });
        await ctx.telegram.deleteMessage(destinationChatId, statusMsg.message_id).catch(() => {});
        throw new Error("This resource is no longer available.");
      }

      // Safe fallback to fetch the message ID if forwardMessages doesn't return it
      let newMsgId = forwardedMessages[0].id;
      if (!newMsgId) {
        console.log(`[DELIVERY WARN] forwardedMessages[0].id is undefined. Fetching last message from Relay Group...`);
        const history = await tg.getMessages(relayGroupId, { limit: 1 });
        if (history && history.length > 0) {
          newMsgId = history[0].id;
        }
      }

      if (!newMsgId) {
         throw new Error("Could not extract message ID from Relay Group.");
      }

      // 2. Telegraf copies the message from the Relay Group to the User
      await ctx.telegram.copyMessage(destinationChatId, relayGroupId, newMsgId);
      console.log(`[DELIVERY SUCCESS] Delivered message ${newMsgId} to ${destinationChatId}`);
    });

    // Delete the loading message
    await ctx.telegram.deleteMessage(destinationChatId, statusMsg.message_id).catch(() => {});

  } catch (error) {
    console.error("[DELIVERY FAIL] Unexpected Error:", error);
    await ctx.reply(`❌ Delivery failed. Unexpected error: ${error.message}`);
  }
}

/**
 * Handle Grouped Images Download
 */
async function handleGroupDownload(ctx, resourceId) {
  try {
    console.log(`\n[DELIVERY] Attempting to deliver image group: ${resourceId}`);
    const resource = await TelegramResource.findById(resourceId);
    if (!resource) {
      console.log(`[DELIVERY FAIL] Resource not found in DB`);
      return await ctx.answerCbQuery("❌ Resource not found.", { show_alert: true });
    }

    if (!process.env.RELAY_GROUP_ID) {
      console.log(`[DELIVERY FAIL] RELAY_GROUP_ID not configured`);
      return await ctx.reply("❌ Bot configuration error: RELAY_GROUP_ID not set.");
    }

    const relayGroupId = parseInt(process.env.RELAY_GROUP_ID);
    
    // Prevent copying the message to the Relay Group if the user is testing inside the Relay Group
    const destinationChatId = ctx.chat.id;
    if (destinationChatId === relayGroupId) {
      return await ctx.answerCbQuery("❌ You cannot test delivery inside the Relay Group itself! Test in the bot's private chat.", { show_alert: true });
    }

    // Fetch all images belonging to this group
    const images = await TelegramResource.find({ groupId: resource.groupId }).sort({ messageDate: 1 });
    
    if (images.length === 0) {
      console.log(`[DELIVERY FAIL] No images found for groupId: ${resource.groupId}`);
      return await ctx.reply("❌ Group images not found.");
    }

    await ctx.answerCbQuery("📥 Fetching image set...");
    const statusMsg = await ctx.reply(`⏳ <i>Retrieving ${images.length} images...</i>`, { parse_mode: "HTML" });

    await runInQueue(async () => {
      const messageIds = images.map(img => img.messageId);

      // 1. GramJS forwards all messages to Relay Group in one batch
      const tg = await getClient();
      let forwardedMessages;
      let usedArchive = false;

      try {
        forwardedMessages = await tg.forwardMessages(relayGroupId, {
          messages: messageIds,
          fromPeer: resource.channelUsername ? `@${resource.channelUsername}` : parseInt(resource.chatId)
        });
      } catch (gramError) {
        console.error(`[DELIVERY WARN] GramJS Forward Error (Group):`, gramError.message);
        
        // Archive Fallback
        const archiveIds = images.map(img => img.archiveMessageId).filter(id => id);
        if (archiveIds.length === images.length && process.env.ARCHIVE_CHAT_ID) {
           console.log(`[DELIVERY] Falling back to Archive Channel for group`);
           try {
             const archiveChatId = parseInt(process.env.ARCHIVE_CHAT_ID);
             forwardedMessages = await tg.forwardMessages(relayGroupId, {
               messages: archiveIds,
               fromPeer: archiveChatId
             });
             usedArchive = true;
           } catch (archiveErr) {
             console.error(`[DELIVERY FAIL] Archive Group Fallback Error:`, archiveErr.message);
           }
        }

        if (!usedArchive) {
          await TelegramResource.updateMany({ groupId: resource.groupId }, { $set: { isAvailable: false } });
          await ctx.telegram.deleteMessage(destinationChatId, statusMsg.message_id).catch(() => {});
          throw new Error("These images are no longer available in the source channel or archive.");
        }
      }

      if (!forwardedMessages || forwardedMessages.length === 0) {
        console.log(`[DELIVERY FAIL] GramJS returned empty array for group`);
        if (!usedArchive) await TelegramResource.updateMany({ groupId: resource.groupId }, { $set: { isAvailable: false } });
        await ctx.telegram.deleteMessage(destinationChatId, statusMsg.message_id).catch(() => {});
        throw new Error("These images are no longer available.");
      }

      // Safe fallback for group messages
      let msgIdsToCopy = forwardedMessages.map(m => m && m.id).filter(id => id);
      if (msgIdsToCopy.length === 0) {
         console.log(`[DELIVERY WARN] forwardedMessages missing IDs for group. Fetching last ${messageIds.length} messages...`);
         const history = await tg.getMessages(relayGroupId, { limit: messageIds.length });
         // Re-reverse history since getMessages returns newest first
         msgIdsToCopy = history.map(m => m.id).reverse();
      }

      // 2. Telegraf copies all messages to the User
      let successCount = 0;
      for (const newMsgId of msgIdsToCopy) {
        try {
          await ctx.telegram.copyMessage(destinationChatId, relayGroupId, newMsgId);
          successCount++;
          await new Promise(r => setTimeout(r, 200)); // Sleep to prevent flood
        } catch (copyErr) {
          console.error(`[DELIVERY WARN] Failed to copy a message in group:`, copyErr.message);
        }
      }
      
      console.log(`[DELIVERY SUCCESS] Delivered ${successCount}/${messageIds.length} images to ${destinationChatId}`);
    });

    // Delete the loading message
    await ctx.telegram.deleteMessage(destinationChatId, statusMsg.message_id).catch(() => {});

  } catch (error) {
    console.error("[DELIVERY FAIL] Unexpected Group Error:", error);
    await ctx.reply(`❌ Delivery failed for image set. Error: ${error.message}`);
  }
}

/**
 * Register file delivery handlers with bot
 */
function registerFileDeliveryHandlers(bot) {
  console.log("📦 Registering file delivery handlers...");

  bot.action(/get_(.+)/, async (ctx) => {
    const resourceId = ctx.match[1];
    
    // Check if it's a grouped resource by checking the button text (we can't easily pass two params, so we fetch it)
    const resource = await TelegramResource.findById(resourceId);
    if (resource && resource.groupId && resource.fileType === "image") {
       await handleGroupDownload(ctx, resourceId);
    } else {
       await handleDownload(ctx, resourceId);
    }
  });

  bot.on('message', async (ctx, next) => {
    // Small debug listener to capture Relay Group ID if needed
    if (ctx.message.text === '/get_chat_id') {
      console.log(`[Chat ID Debug] ID: ${ctx.chat.id}`);
      await ctx.reply(`This chat ID is: \`${ctx.chat.id}\``, { parse_mode: "Markdown" });
    }
    
    // Debug listener to capture Archive Channel ID from forwarded messages
    if (ctx.message.forward_from_chat && ctx.message.forward_from_chat.type === 'channel') {
      const forwardedChatId = ctx.message.forward_from_chat.id;
      console.log(`[Archive Chat ID Debug] Forwarded from ID: ${forwardedChatId}`);
      await ctx.reply(`The ID of that forwarded channel is: \`${forwardedChatId}\``, { parse_mode: "Markdown" });
    }
    
    return next();
  });

  bot.on('channel_post', async (ctx, next) => {
    // Debug listener for Archive Channel ID
    if (ctx.channelPost && ctx.channelPost.text === '/get_archive_id') {
      console.log(`[Archive Chat ID Debug] ID: ${ctx.chat.id}`);
      await ctx.telegram.sendMessage(ctx.chat.id, `This Archive Chat ID is: \`${ctx.chat.id}\``, { parse_mode: "Markdown" }).catch(() => {});
    }
    return next();
  });

  console.log("✅ File delivery handlers registered");
}

module.exports = {
  sendSearchResultsWithButtons,
  registerFileDeliveryHandlers,
};
