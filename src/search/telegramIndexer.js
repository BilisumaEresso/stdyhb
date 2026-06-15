require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram");
const TelegramResource = require("../db/models/TelegramResource");
const TelegramChannel = require("../db/models/TelegramChannel");

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
let client = null;

// ─── client management ────────────────────────────────────────────────────────

async function getClient() {
  if (client?.connected) return client;

  client = new TelegramClient(
    new StringSession(process.env.TELEGRAM_SESSION),
    apiId,
    apiHash,
    { connectionRetries: 3 },
  );

  await client.connect();
  console.log("✅ GramJS client connected");
  return client;
}

// ─── tag / metadata extraction ────────────────────────────────────────────────

const EXAM_KEYWORDS = [
  "exam",
  "final",
  "mid",
  "midterm",
  "quiz",
  "test",
  "past",
  "previous",
  "solved",
  "assignment",
];

const COURSE_KEYWORDS = [
  "dbms",
  "database",
  "oop",
  "data structure",
  "networking",
  "calculus",
  "physics",
  "chemistry",
  "compiler",
  "operating system",
  "algorithms",
  "linear algebra",
  "statistics",
  "thermodynamics",
  "circuit",
  "mechanics",
  "programming",
  "software engineering",
];

function extractTags(text = "") {
  const lower = text.toLowerCase();
  const tags = [];
  [...EXAM_KEYWORDS, ...COURSE_KEYWORDS].forEach((k) => {
    if (lower.includes(k)) tags.push(k);
  });
  return [...new Set(tags)];
}

function isExam(text = "", fileName = "") {
  const combined = `${text} ${fileName}`.toLowerCase();
  return EXAM_KEYWORDS.some((k) => combined.includes(k));
}

function extractYear(text = "") {
  const m = text.match(/20(1[5-9]|2[0-9])/);
  return m ? parseInt(m[0]) : null;
}

function extractCourseCode(text = "") {
  const m = text.match(/\b([A-Z]{2,5}\s?\d{2,3}|DBMS|OOP|DSA|OS|HCI)\b/i);
  return m ? m[0].toUpperCase() : "";
}

function getFileType(fileName = "") {
  const ext = fileName.split(".").pop().toLowerCase();
  const map = { pdf: "pdf", ppt: "ppt", pptx: "ppt", doc: "doc", docx: "doc" };
  return map[ext] || "other";
}

// ─── process one message ──────────────────────────────────────────────────────

async function processMessage(msg, channelUsername) {
  // We only care about messages with files or photos
  const hasDoc = !!msg.document;
  const hasPhoto = !!msg.photo;
  if (!hasDoc && !hasPhoto) return null;

  let fileId, fileUniqueId, fileName, fileType, fileSize;

  if (hasDoc) {
    // For documents: use the media property which contains proper file_id
    const media = msg.media?.document;
    if (!media) {
      console.warn(`⚠️ Document without media: msg ${msg.id}`);
      return null;
    }
    
    // Extract file_id from document - this is the proper Telegram file_id
    fileId = media.id?.toString();
    fileUniqueId = media.accessHash?.toString();
    fileName =
      media.attributes?.find(
        (a) => a.className === "DocumentAttributeFilename",
      )?.fileName || "";
    fileSize = media.size || 0;
    fileType = getFileType(fileName);

    if (fileType === "other") return null; // skip zips, exes, etc.
  } else {
    // Photo — take the largest size
    const media = msg.media?.photo;
    if (!media) {
      console.warn(`⚠️ Photo without media: msg ${msg.id}`);
      return null;
    }
    
    const sizes = media.sizes || [];
    const large = sizes[sizes.length - 1];
    fileId = media.id?.toString();
    fileUniqueId = media.accessHash?.toString();
    fileName = "";
    fileSize = large?.size || 0;
    fileType = "image";
  }

  if (!fileId) {
    console.warn(`⚠️ No fileId extracted for msg ${msg.id}`);
    return null;
  }

  const caption = msg.message || "";
  const text = `${caption} ${fileName}`;
  const tags = extractTags(text);
  const exam = isExam(text, fileName);

  // Skip untagged images — too much noise
  if (fileType === "image" && tags.length === 0 && !exam) return null;

  const resource = {
    fileId,
    fileUniqueId,
    messageId: msg.id,
    chatId: msg.peerId?.channelId?.toString() || "",
    channelUsername,
    fileName,
    caption,
    fileType,
    fileSize,
    tags,
    isExam: exam,
    courseCode: extractCourseCode(text),
    year: extractYear(text),
    messageDate: msg.date ? new Date(msg.date * 1000) : null,
    relevanceScore: tags.length + (exam ? 5 : 0),
  };

  try {
    const existing = await TelegramResource.findOne({ channelUsername, messageId: msg.id });
    
    if (!existing) {
      // It's a brand new resource! Forward it to the Archive Channel!
      let archiveMessageId = null;
      if (process.env.ARCHIVE_CHAT_ID) {
        const archiveChatId = parseInt(process.env.ARCHIVE_CHAT_ID);
        try {
          const tg = await getClient();
          const forwarded = await tg.forwardMessages(archiveChatId, {
            messages: [msg.id],
            fromPeer: `@${channelUsername}`
          });
          
          let newMsgId = forwarded && forwarded[0] ? forwarded[0].id : null;
          if (!newMsgId) {
            const history = await tg.getMessages(archiveChatId, { limit: 1 });
            if (history && history.length > 0) newMsgId = history[0].id;
          }
          archiveMessageId = newMsgId;
          
          // Small delay to prevent flood limits when archiving many files
          await new Promise(r => setTimeout(r, 200));
        } catch (archiveErr) {
          console.error(`⚠️ Failed to archive msg ${msg.id}:`, archiveErr.message);
        }
      }
      
      resource.archiveMessageId = archiveMessageId;
      await TelegramResource.create(resource);
      return resource;
    } else {
      // Just update existing
      await TelegramResource.updateOne({ _id: existing._id }, { $set: resource });
      return resource;
    }
  } catch (err) {
    if (err.code === 11000) return null; // duplicate key error safety net
    throw err;
  }
}

// ─── index one channel ────────────────────────────────────────────────────────

async function indexChannel(channelUsername) {
  const tg = await getClient();
  
  // Find max messageId for this channel to use incremental mode
  const maxResource = await TelegramResource.findOne({ channelUsername }).sort({ messageId: -1 });
  const minId = maxResource ? maxResource.messageId : 0;

  console.log(`\nIndexing @${channelUsername} (Incremental from msgId: ${minId})...`);

  let indexed = 0;
  let skipped = 0;
  let totalFetched = 0;
  const channelStartTime = Date.now();

  try {
    let batchIndexed = 0;
    let batchSkipped = 0;
    let batchFetched = 0;
    let batchStartTime = Date.now();

    for await (const msg of tg.iterMessages(`@${channelUsername}`, { minId: minId, reverse: true })) {
      const result = await processMessage(msg, channelUsername);
      result ? batchIndexed++ : batchSkipped++;
      batchFetched++;
      totalFetched++;

      if (batchFetched >= 100) {
        indexed += batchIndexed;
        skipped += batchSkipped;
        const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(2);
        console.log(`  [Batch] Fetched: ${batchFetched}, Indexed: ${batchIndexed}, Skipped: ${batchSkipped}, Time: ${batchTime}s`);
        
        // Reset batch
        batchIndexed = 0;
        batchSkipped = 0;
        batchFetched = 0;
        batchStartTime = Date.now();
        
        // Delay to avoid rate limiting
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Flush remaining batch
    if (batchFetched > 0) {
      indexed += batchIndexed;
      skipped += batchSkipped;
      const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(2);
      console.log(`  [Batch] Fetched: ${batchFetched}, Indexed: ${batchIndexed}, Skipped: ${batchSkipped}, Time: ${batchTime}s`);
    }

    const totalTime = ((Date.now() - channelStartTime) / 1000).toFixed(2);

    // Success: Reset failures and mark as ACTIVE
    await TelegramChannel.updateOne(
      { username: channelUsername },
      {
        $set: {
          lastScannedAt: new Date(),
          lastSuccessfulScan: new Date(),
          healthStatus: "ACTIVE",
          failureCount: 0,
          lastError: null,
        },
        $inc: { totalIndexed: indexed },
      }
    );

    console.log(`  ✅ @${channelUsername} COMPLETED: Fetched: ${totalFetched}, Indexed: ${indexed}, Skipped: ${skipped}, Total Time: ${totalTime}s`);
    return { indexed, skipped, error: null };
  } catch (err) {
    const errorMsg = err.message;
    console.error(`  ❌ @${channelUsername}: ${errorMsg}`);

    // Increment failure count
    const channel = await TelegramChannel.findOne({ username: channelUsername });
    if (channel) {
      const newFailureCount = (channel.failureCount || 0) + 1;
      let newStatus = "ACTIVE";

      if (newFailureCount >= 5) {
        newStatus = "DEAD";
        console.error(
          `  💀 @${channelUsername} DEAD (${newFailureCount} failures) - DISABLING`
        );
      } else if (newFailureCount >= 3) {
        newStatus = "DEGRADED";
        console.warn(
          `  ⚠️  @${channelUsername} DEGRADED (${newFailureCount} failures)`
        );
      }

      await TelegramChannel.updateOne(
        { username: channelUsername },
        {
          $set: {
            failureCount: newFailureCount,
            healthStatus: newStatus,
            lastError: errorMsg,
            lastScannedAt: new Date(),
            active: newStatus === "DEAD" ? false : true,
          },
        }
      );
    }

    return { indexed, skipped, error: errorMsg };
  }
}

// ─── index all active channels ────────────────────────────────────────────────

async function indexAllChannels() {
  const channels = await TelegramChannel.find({ active: true, healthStatus: "ACTIVE" }).sort({
    priority: -1,
  });

  console.log(`Starting indexer — ${channels.length} ACTIVE channels`);

  const results = [];
  for (const ch of channels) {
    await new Promise((r) => setTimeout(r, 1500));
    const r = await indexChannel(ch.username);
    results.push({ channel: ch.username, ...r });
  }

  const total = results.reduce((sum, r) => sum + r.indexed, 0);
  console.log(`\nDone. Total indexed: ${total}`);
  return results;
}

module.exports = {
  indexAllChannels,
  indexChannel,
  processMessage,
  extractTags,
  getClient,
};
