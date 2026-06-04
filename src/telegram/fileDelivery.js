const TelegramResource = require("../db/models/TelegramResource");
const { Markup } = require("telegraf");

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

  let text = `${index}. ${typeEmoji} *${resource.title}*\n`;

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
    const caption = resource.caption.substring(0, 60);
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
 * Send document file (PDF, PPT, DOC)
 */
async function sendResourceFile(ctx, resource) {
  try {
    console.log(`📤 Sending ${resource.fileType}: ${resource.fileName}`);

    const caption =
      `📥 ${resource.title}\n\n${resource.caption || ""}`.substring(0, 1024);

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
    }

    console.log(`✅ File sent successfully`);
  } catch (error) {
    console.error(`❌ Error sending file: ${error.message}`);
    await ctx.reply(
      "❌ Failed to send file. The resource may have been deleted or is no longer available.",
    );
  }
}

/**
 * Send media group (grouped images for exam sets)
 */
async function sendImageGroup(ctx, groupId) {
  try {
    console.log(`📸 Sending image group: ${groupId}`);

    // Find all images with same groupId
    const images = await TelegramResource.find({
      groupId,
      fileType: "image",
    }).sort({ createdAt: 1 });

    if (images.length === 0) {
      await ctx.reply("❌ Image group not found");
      return;
    }

    // Create media group payload
    const media = images.map((img, idx) => ({
      type: "photo",
      media: img.fileId,
      caption:
        idx === 0
          ? `📸 Exam Set (${images.length} pages)\n${img.caption || ""}`
          : img.caption,
    }));

    // Send as album
    await ctx.replyWithMediaGroup(media);

    console.log(`✅ Image group sent (${images.length} images)`);
  } catch (error) {
    console.error(`❌ Error sending image group: ${error.message}`);
    await ctx.reply("❌ Failed to send image set.");
  }
}

/**
 * Send video file
 */
async function sendVideo(ctx, resource) {
  try {
    console.log(`🎥 Sending video: ${resource.fileName}`);

    const caption =
      `🎥 ${resource.title}\n\n${resource.caption || ""}`.substring(0, 1024);

    await ctx.replyWithVideo(resource.fileId, {
      caption,
      parse_mode: "Markdown",
    });

    console.log(`✅ Video sent successfully`);
  } catch (error) {
    console.error(`❌ Error sending video: ${error.message}`);
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
    console.log(`📥 Download requested for: ${resourceId}`);

    const resource = await TelegramResource.findById(resourceId);

    if (!resource) {
      return await ctx.reply("❌ Resource not found");
    }

    if (resource.fileType === "image" && resource.groupId) {
      await sendImageGroup(ctx, resource.groupId);
    } else if (resource.fileType === "video") {
      await sendVideo(ctx, resource);
    } else {
      await sendResourceFile(ctx, resource);
    }

    await ctx.answerCbQuery("✅ Sending file...");
  } catch (error) {
    console.error("Error handling download:", error);
    await ctx.answerCbQuery("❌ Error downloading");
  }
}

/**
 * Handle preview button callback
 */
async function handlePreview(ctx, resourceId) {
  try {
    console.log(`👀 Preview requested for: ${resourceId}`);

    const resource = await TelegramResource.findById(resourceId);

    if (!resource) {
      return await ctx.reply("❌ Resource not found");
    }

    let previewText = `🔍 *Preview: ${resource.title}*\n\n`;
    previewText += `📌 Type: ${resource.fileType}\n`;
    previewText += `🎓 Exam: ${resource.isExam ? "Yes" : "No"}\n`;

    if (resource.tags && resource.tags.length > 0) {
      previewText += `🏷️  Tags: ${resource.tags.join(", ")}\n`;
    }

    if (resource.channelUsername) {
      previewText += `📢 Channel: @${resource.channelUsername}\n`;
    }

    if (resource.caption) {
      previewText += `\n📝 *Description:*\n${resource.caption.substring(0, 200)}...`;
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

    const resource = await TelegramResource.findById(resourceId);

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
