const TelegramResource = require("../db/models/TelegramResource");

/**
 * Auto-detect tags from caption and file name
 */
function extractTags(caption, fileName) {
  const tags = [];
  const combined = `${caption || ""} ${fileName || ""}`.toLowerCase();

  // Exam indicators
  if (
    combined.includes("exam") ||
    combined.includes("final") ||
    combined.includes("mid")
  ) {
    tags.push("exam");
  }

  if (combined.includes("final")) {
    tags.push("final_exam");
  }

  if (combined.includes("mid")) {
    tags.push("mid_exam");
  }

  // Study material
  if (
    combined.includes("notes") ||
    combined.includes("lecture") ||
    combined.includes("slide")
  ) {
    tags.push("notes");
  }

  if (combined.includes("solution") || combined.includes("solved")) {
    tags.push("solution");
  }

  if (combined.includes("assignment") || combined.includes("assignment")) {
    tags.push("assignment");
  }

  if (combined.includes("tutorial")) {
    tags.push("tutorial");
  }

  if (combined.includes("guide") || combined.includes("handbook")) {
    tags.push("guide");
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Determine if content is exam-related
 */
function isExamContent(caption, fileName) {
  const combined = `${caption || ""} ${fileName || ""}`.toLowerCase();
  return (
    combined.includes("exam") ||
    combined.includes("final") ||
    combined.includes("mid") ||
    combined.includes("past paper") ||
    combined.includes("solution")
  );
}

/**
 * Detect file type from MIME type or file name
 */
function detectFileType(mimeType, fileName) {
  const mime = (mimeType || "").toLowerCase();
  const name = (fileName || "").toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    name.includes(".ppt") ||
    name.includes(".pptx")
  ) {
    return "ppt";
  }

  if (mime.includes("image") || name.match(/\.(jpg|jpeg|png|gif)$/)) {
    return "image";
  }

  if (mime.includes("video") || name.match(/\.(mp4|avi|mov)$/)) {
    return "video";
  }

  if (
    mime.includes("word") ||
    mime.includes("document") ||
    name.includes(".doc") ||
    name.includes(".docx")
  ) {
    return "doc";
  }

  return "other";
}

/**
 * Store document in MongoDB (async, non-blocking)
 */
async function storeResource(resourceData) {
  try {
    // Check if already exists (by fileId)
    const existing = await TelegramResource.findOne({
      fileId: resourceData.fileId,
    });

    if (existing) {
      console.log(
        `  ⏭️  Skipping duplicate: ${resourceData.fileName || resourceData.fileId}`,
      );
      return null;
    }

    // Create and save new resource
    const resource = new TelegramResource(resourceData);
    await resource.save();

    console.log(`  ✅ Indexed: ${resourceData.fileName || resourceData.title}`);
    return resource;
  } catch (error) {
    console.error(`  ❌ Error storing resource: ${error.message}`);
    // Don't throw - continue processing other messages
    return null;
  }
}

/**
 * Handle document messages (PDF, PPT, etc.)
 */
async function handleDocument(ctx) {
  try {
    const { document, caption } = ctx.message;

    if (!document) return;

    const fileName = document.file_name || "unnamed_document";
    const fileType = detectFileType(document.mime_type, fileName);
    const tags = extractTags(caption, fileName);
    const isExam = isExamContent(caption, fileName);

    const resourceData = {
      messageId: ctx.message.message_id.toString(),
      chatId: ctx.message.chat.id.toString(),
      channelUsername: ctx.message.chat.username || null,
      fileId: document.file_id,
      fileName,
      mimeType: document.mime_type,
      fileType,
      caption: caption || "",
      title: caption || fileName,
      tags,
      isExam,
      createdAt: new Date(ctx.message.date * 1000),
    };

    // Store asynchronously (don't wait)
    storeResource(resourceData).catch((err) => {
      console.error("Background storage error:", err);
    });
  } catch (error) {
    console.error("Error handling document:", error);
  }
}

/**
 * Handle photo/image messages (single or grouped)
 */
async function handlePhoto(ctx) {
  try {
    const { photo, caption, media_group_id } = ctx.message;

    if (!photo || photo.length === 0) return;

    // Get highest resolution photo
    const largestPhoto = photo[photo.length - 1];
    const fileType = "image";
    const tags = extractTags(caption, "");
    const isExam = isExamContent(caption, "");

    // Use media_group_id for grouping multiple photos (exam sets)
    const groupId = media_group_id || ctx.message.message_id.toString();

    const resourceData = {
      messageId: ctx.message.message_id.toString(),
      chatId: ctx.message.chat.id.toString(),
      channelUsername: ctx.message.chat.username || null,
      fileId: largestPhoto.file_id,
      fileName: `photo_${largestPhoto.file_id.substring(0, 10)}.jpg`,
      mimeType: "image/jpeg",
      fileType,
      groupId, // Group multiple photos together
      caption: caption || "",
      title: caption || "exam_image",
      tags,
      isExam,
      createdAt: new Date(ctx.message.date * 1000),
    };

    // Store asynchronously
    storeResource(resourceData).catch((err) => {
      console.error("Background storage error:", err);
    });
  } catch (error) {
    console.error("Error handling photo:", error);
  }
}

/**
 * Handle video messages (optional, for lectures)
 */
async function handleVideo(ctx) {
  try {
    const { video, caption } = ctx.message;

    if (!video) return;

    const fileName = video.file_name || "video_lecture";
    const tags = extractTags(caption, fileName);

    const resourceData = {
      messageId: ctx.message.message_id.toString(),
      chatId: ctx.message.chat.id.toString(),
      channelUsername: ctx.message.chat.username || null,
      fileId: video.file_id,
      fileName,
      mimeType: video.mime_type,
      fileType: "video",
      caption: caption || "",
      title: caption || fileName,
      tags,
      isExam: false,
      createdAt: new Date(ctx.message.date * 1000),
    };

    // Store asynchronously
    storeResource(resourceData).catch((err) => {
      console.error("Background storage error:", err);
    });
  } catch (error) {
    console.error("Error handling video:", error);
  }
}

/**
 * Initialize channel indexer
 * Attach handlers to bot instance
 */
function initializeIndexer(bot) {
  console.log("📡 Initializing Telegram channel indexer...");

  // Listen for documents (PDF, PPT, etc.)
  bot.on("document", async (ctx) => {
    console.log(`📄 New document in ${ctx.message.chat.title || "chat"}`);
    await handleDocument(ctx);
  });

  // Listen for photos (single or grouped)
  bot.on("photo", async (ctx) => {
    console.log(`🖼️  New photo in ${ctx.message.chat.title || "chat"}`);
    await handlePhoto(ctx);
  });

  // Listen for videos (optional)
  bot.on("video", async (ctx) => {
    console.log(`🎥 New video in ${ctx.message.chat.title || "chat"}`);
    await handleVideo(ctx);
  });

  console.log("✅ Channel indexer initialized");
}

/**
 * Search indexed Telegram resources
 */
async function searchResources(query, filters = {}) {
  try {
    const searchQuery = {
      $text: { $search: query },
      ...filters,
    };

    const results = await TelegramResource.find(searchQuery)
      .sort({ score: { $meta: "textScore" }, createdAt: -1 })
      .limit(10);

    return results;
  } catch (error) {
    console.error("Error searching resources:", error);
    return [];
  }
}

/**
 * Get indexed statistics
 */
async function getIndexingStats() {
  try {
    const total = await TelegramResource.countDocuments();
    const exams = await TelegramResource.countDocuments({ isExam: true });
    const pdfs = await TelegramResource.countDocuments({ fileType: "pdf" });
    const channels = await TelegramResource.distinct("channelUsername");

    return {
      totalResources: total,
      exams,
      pdfs,
      channels: channels.filter(Boolean).length,
      byType: await TelegramResource.aggregate([
        { $group: { _id: "$fileType", count: { $sum: 1 } } },
      ]),
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return null;
  }
}

module.exports = {
  initializeIndexer,
  searchResources,
  getIndexingStats,
  storeResource,
  extractTags,
  detectFileType,
};
