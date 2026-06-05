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
    await TelegramResource.updateOne(
      { fileUniqueId },
      { $set: resource },
      { upsert: true },
    );
    return resource;
  } catch (err) {
    if (err.code === 11000) return null; // already indexed
    throw err;
  }
}

// ─── index one channel ────────────────────────────────────────────────────────

async function indexChannel(channelUsername, limit = 200) {
  const tg = await getClient();
  console.log(`\nIndexing @${channelUsername} (last ${limit} messages)...`);

  let indexed = 0;
  let skipped = 0;

  try {
    const messages = await tg.getMessages(`@${channelUsername}`, {
      limit,
      filter: new Api.InputMessagesFilterDocument(),
    });

    for (const msg of messages) {
      const result = await processMessage(msg, channelUsername);
      result ? indexed++ : skipped++;
    }

    const photos = await tg.getMessages(`@${channelUsername}`, {
      limit: 100,
      filter: new Api.InputMessagesFilterPhotos(),
    });

    for (const msg of photos) {
      const result = await processMessage(msg, channelUsername);
      result ? indexed++ : skipped++;
    }

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

    console.log(`  ✅ @${channelUsername}: ${indexed} indexed, ${skipped} skipped`);
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
