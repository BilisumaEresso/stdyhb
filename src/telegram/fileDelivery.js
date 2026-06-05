const TelegramResource = require("../db/models/TelegramResource");
const DownloadHistory = require("../db/models/DownloadHistory");
const User = require("../db/models/User");
const { Markup } = require("telegraf");

/**
 * Track download/preview action
 */
async function trackDownload(telegramId, resource, action = "download", searchQuery = null) {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return;

    await DownloadHistory.create({
      userId: user._id,
      telegramId,
      resourceId: resource._id,
      fileId: resource.fileId,
      resourceTitle: resource.fileName || "Unnamed",
      fileType: resource.fileType,
      channelUsername: resource.channelUsername,
      searchQuery,
      action,
      downloadedAt: new Date(),
    });

    // Increment download count on resource
    await TelegramResource.updateOne(
      { _id: resource._id },
      { $inc: { downloadCount: 1 } }
    );
  } catch (error) {
    console.error("Error tracking download:", error.message);
  }
}

/**
 * Escape special Markdown characters
 */
function escapeMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&")
    .substring(0, 1000); // Limit length
}

/**
 * Format resource result for display with inline buttons
 */
function formatResourceResult(resource, index) {
  const typeEmoji =
    {
      pdf: "📄",
      ppt: "📊",
      image: "🖼️",
      video: "🎥",
      doc: "📝",
    }[resource.fileType] || "📎";

  let text = `${index}. ${typeEmoji} *${escapeMarkdown(resource.title)}*\n`;

  if (resource.channelUsername) {
    text += `   📌 Channel: @${resource.channelUsername}\n`;
  }

  if (resource.isExam) {
    text += `   🎓 Exam Material\n`;
  }

  if (resource.groupId && resource.fileType === "image") {
    text += `   📸 Image Set\n`;
  }

  if (resource.caption) {
    const caption = escapeMarkdown(resource.caption.substring(0, 60));
    text += `   📝 "${caption}..."\n`;
  }

  text += `   Score: ${resource.score || 0}`;

  return text;
}

/**
 * Create inline buttons for resource
 */
function getResourceButtons(resourceId, fileType, groupId) {
  const buttons = [
    [
      Markup.button.callback("📥 Download", `download_${resourceId}`),
      Markup.button.callback("👀 Preview", `preview_${resourceId}`),
    ],
    [Markup.button.callback("🔁 More like this", `more_${resourceId}`)],
  ];

  return Markup.inlineKeyboard(buttons);
}

/**
 * Send document file (PDF, PPT, DOC) with validation and fallback
 */
async function sendResourceFile(ctx, resource) {
  try {
    // Validate fileId exists
    if (!resource.fileId) {
      console.warn(`⚠️ Missing fileId for resource: ${resource._id}`);
      return await ctx.reply("❌ File unavailable. The resource has no file ID.");
    }

    console.log(`📤 Sending ${resource.fileType}: ${resource.fileName}`);
    console.log(`   fileId: ${resource.fileId.substring(0, 30)}...`);
    console.log(`   messageId: ${resource.messageId}`);
    console.log(`   fileType: ${resource.fileType}`);

    const caption =
      `📥 ${resource.title || resource.fileName}\n\n${resource.caption || ""}`.substring(0, 1024);

    if (resource.fileType === "pdf" || resource.fileType === "doc") {
      await ctx.replyWithDocument(resource.fileId, {
        caption,
        parse_mode: "Markdown",
      });
    } else if (resource.fileType === "ppt") {
      await ctx.replyWithDocument(resource.fileId, {
        caption,
        parse_mode: "Markdown",
      });
    } else {
      await ctx.reply(`❌ Unsupported file type: ${resource.fileType}`);
      return;
    }

    console.log(`✅ File sent successfully`);
  } catch (error) {
    console.error(`❌ Error sending file: ${error.message}`);
    
    // Fallback: Try forwarding original message if file send fails
    if (resource.messageId && resource.chatId) {
      try {
        console.log(`📤 Attempting fallback: forwarding original message...`);
        console.log(`   from chatId: ${resource.chatId}, messageId: ${resource.messageId}`);
        
        await ctx.telegram.forwardMessage(
          ctx.chat.id,
          resource.chatId,
          resource.messageId
        );
        
        console.log(`✅ Message forwarded as fallback`);
        await ctx.answerCbQuery("✅ Sending file...", true);
        return;
      } catch (fallbackError) {
        console.error(`❌ Fallback forward failed: ${fallbackError.message}`);
      }
    }
    
    await ctx.reply(
      "❌ Failed to send file. The resource may have been deleted or is no longer available.",
    );
  }
}

/**
 * Send media group (grouped images for exam sets) with validation and fallback
 */
async function sendImageGroup(ctx, groupId) {
  try {
    console.log(`📸 Sending image group: ${groupId}`);

    const images = await TelegramResource.find({
      groupId,
      fileType: "image",
    }).sort({ createdAt: 1 });

    if (images.length === 0) {
      await ctx.reply("❌ Image group not found");
      return;
    }

    // Validate all images have fileIds
    const validImages = images.filter(img => {
      if (!img.fileId) {
        console.warn(`⚠️ Image missing fileId: ${img._id}`);
        return false;
      }
      return true;
    });

    if (validImages.length === 0) {
      await ctx.reply("❌ All images in group are unavailable.");
      return;
    }

    // Track first image in group
    if (validImages.length > 0) {
      await trackDownload(ctx.from.id, validImages[0], "view_set");
    }

    const media = validImages.map((img, idx) => ({
      type: "photo",
      media: img.fileId,
      caption:
        idx === 0
          ? `📸 Exam Set (${validImages.length} pages)\n${img.caption || ""}`
          : img.caption,
    }));

    await ctx.replyWithMediaGroup(media);

    console.log(`✅ Image group sent (${validImages.length} images)`);
  } catch (error) {
    console.error(`❌ Error sending image group: ${error.message}`);
    await ctx.reply("❌ Failed to send image set.");
  }
}

/**
 * Send video file with validation and fallback
 */
async function sendVideo(ctx, resource) {
  try {
    // Validate fileId exists
    if (!resource.fileId) {
      console.warn(`⚠️ Missing fileId for video resource: ${resource._id}`);
      return await ctx.reply("❌ Video unavailable. The resource has no file ID.");
    }

    console.log(`🎥 Sending video: ${resource.fileName}`);
    console.log(`   fileId: ${resource.fileId.substring(0, 30)}...`);
    console.log(`   messageId: ${resource.messageId}`);

    const caption =
      `🎥 ${resource.title || resource.fileName}\n\n${resource.caption || ""}`.substring(0, 1024);

    await ctx.replyWithVideo(resource.fileId, {
      caption,
      parse_mode: "Markdown",
    });

    console.log(`✅ Video sent successfully`);
  } catch (error) {
    console.error(`❌ Error sending video: ${error.message}`);
    
    // Fallback: Try forwarding original message
    if (resource.messageId && resource.chatId) {
      try {
        console.log(`📤 Attempting fallback: forwarding video message...`);
        
        await ctx.telegram.forwardMessage(
          ctx.chat.id,
          resource.chatId,
          resource.messageId
        );
        
        console.log(`✅ Video message forwarded as fallback`);
        await ctx.answerCbQuery("✅ Sending video...", true);
        return;
      } catch (fallbackError) {
        console.error(`❌ Fallback forward failed: ${fallbackError.message}`);
      }
    }
    
    await ctx.reply("❌ Failed to send video.");
  }
}

/**
 * Generate "More like this" query
 */
function generateMoreLikeThisQuery(resource) {
  const queries = [];

  // Use title/caption and tags
  if (resource.title) {
    queries.push(resource.title.split(/\s+/).slice(0, 3).join(" "));
  }

  if (resource.tags && resource.tags.length > 0) {
    queries.push(resource.tags[0]);
  }

  if (resource.caption) {
    queries.push(resource.caption.split(/\s+/).slice(0, 2).join(" "));
  }

  return queries[0] || "exam";
}

/**
 * Handle download button callback
 */
async function handleDownload(ctx, resourceId) {
  try {
    console.log(`\n📥 Download requested for: ${resourceId}`);

    const resource = await TelegramResource.findOne({ fileId: resourceId });

    if (!resource) {
      console.warn(`⚠️ Resource not found for fileId: ${resourceId}`);
      return await ctx.reply("❌ Resource not found");
    }

    // Validate resource has required fields
    console.log(`   Found resource: ${resource.fileName}`);
    console.log(`   fileId: ${resource.fileId?.substring(0, 30)}...`);
    console.log(`   fileType: ${resource.fileType}`);
    console.log(`   messageId: ${resource.messageId}`);
    console.log(`   chatId: ${resource.chatId}`);

    if (!resource.fileId) {
      console.error(`❌ Resource missing fileId: ${resource._id}`);
      return await ctx.reply("❌ File unavailable - no file ID stored.");
    }

    // Track download
    await trackDownload(ctx.from.id, resource, "download");

    if (resource.fileType === "image" && resource.groupId) {
      await sendImageGroup(ctx, resource.groupId);
    } else if (resource.fileType === "video") {
      await sendVideo(ctx, resource);
    } else {
      await sendResourceFile(ctx, resource);
    }

    await ctx.answerCbQuery("✅ Sending file...");
  } catch (error) {
    console.error("❌ Error handling download:", error);
    await ctx.answerCbQuery("❌ Error downloading");
  }
}

/**
 * Handle preview button callback
 */
async function handlePreview(ctx, resourceId) {
  try {
    console.log(`👀 Preview requested for: ${resourceId}`);

    const resource = await TelegramResource.findOne({ fileId: resourceId });

    if (!resource) {
      return await ctx.reply("❌ Resource not found");
    }

    // Track preview
    await trackDownload(ctx.from.id, resource, "preview");

    let previewText = `🔍 *Preview: ${escapeMarkdown(resource.title)}*\n\n`;
    previewText += `📌 Type: ${resource.fileType}\n`;
    previewText += `🎓 Exam: ${resource.isExam ? "Yes" : "No"}\n`;

    if (resource.tags && resource.tags.length > 0) {
      previewText += `🏷️  Tags: ${resource.tags.map(t => escapeMarkdown(t)).join(", ")}\n`;
    }

    if (resource.channelUsername) {
      previewText += `📢 Channel: @${resource.channelUsername}\n`;
    }

    if (resource.caption) {
      previewText += `\n📝 *Description:*\n${escapeMarkdown(resource.caption.substring(0, 200))}...`;
    }

    await ctx.reply(previewText, {
      parse_mode: "Markdown",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("📥 Download", `download_${resourceId}`)],
        [Markup.button.callback("🔁 More like this", `more_${resourceId}`)],
      ]).reply_markup,
    });

    await ctx.answerCbQuery();
  } catch (error) {
    console.error("Error handling preview:", error);
    await ctx.answerCbQuery("❌ Error loading preview");
  }
}

/**
 * Handle "more like this" callback
 */
async function handleMoreLikeThis(ctx, resourceId) {
  try {
    console.log(`🔁 More like this requested for: ${resourceId}`);

    // resourceId is actually the fileId, not MongoDB ObjectId
    const resource = await TelegramResource.findOne({ fileId: resourceId });

    if (!resource) {
      return await ctx.reply("❌ Resource not found");
    }

    const query = generateMoreLikeThisQuery(resource);
    console.log(`🔍 Searching similar: "${query}"`);

    // Trigger search command with new query
    ctx.message = { text: `/search ${query}` };
    ctx.update.message.text = `/search ${query}`;

    // Re-run search (will be handled by search command)
    await ctx.reply(`🔍 Searching for similar materials: *${query}*`, {
      parse_mode: "Markdown",
    });

    // Import search command and run it
    const searchCommand = require("./search");
    await searchCommand(ctx);

    await ctx.answerCbQuery("🔁 Finding similar materials...");
  } catch (error) {
    console.error("Error handling more like this:", error);
    await ctx.answerCbQuery("❌ Error searching");
  }
}

/**
 * Format and send search results with file delivery buttons
 */
async function sendSearchResultsWithButtons(ctx, results) {
  if (!results || results.length === 0) {
    return await ctx.reply("❌ No results found. Try a different search term.");
  }

  let message = `✅ Found ${results.length} results:\n\n`;

  // Build results message
  for (let i = 0; i < Math.min(results.length, 5); i++) {
    const result = results[i];

    if (result._telegramResource) {
      // Telegram resource - show with download button
      message += formatResourceResult(result, i + 1);
      message += "\n\n";
    }
  }

  // If we have Telegram resources, add individual buttons for each
  if (results.some((r) => r._telegramResource)) {
    // Send first result with full buttons
    const resource = results[0];

    if (resource._telegramResource) {
      const text = `✅ *Top Result:*\n\n${formatResourceResult(resource, 1)}\n\n*Download below:*`;

      return await ctx.reply(text, {
        parse_mode: "Markdown",
        ...getResourceButtons(
          resource.fileId,
          resource.fileType,
          resource.groupId,
        ),
      });
    }
  }

  // Fallback for web results
  message += "_Reply with a number to save or get more info_";
  return await ctx.reply(message, { parse_mode: "Markdown" });
}

/**
 * Register file delivery handlers with bot
 */
function registerFileDeliveryHandlers(bot) {
  console.log("📦 Registering file delivery handlers...");

  // Download callback
  bot.action(/download_(.+)/, async (ctx) => {
    const resourceId = ctx.match[1];
    await handleDownload(ctx, resourceId);
  });

  // Preview callback
  bot.action(/preview_(.+)/, async (ctx) => {
    const resourceId = ctx.match[1];
    await handlePreview(ctx, resourceId);
  });

  // More like this callback
  bot.action(/more_(.+)/, async (ctx) => {
    const resourceId = ctx.match[1];
    await handleMoreLikeThis(ctx, resourceId);
  });

  console.log("✅ File delivery handlers registered");
}

module.exports = {
  sendResourceFile,
  sendImageGroup,
  sendVideo,
  sendSearchResultsWithButtons,
  registerFileDeliveryHandlers,
  formatResourceResult,
  getResourceButtons,
};
