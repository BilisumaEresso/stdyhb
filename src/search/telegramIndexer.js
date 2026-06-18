require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const mongoose = require("mongoose");
const TelegramResource = require("../db/models/TelegramResource");
const TelegramChannel = require("../db/models/TelegramChannel");
const { notifyAdmin } = require("../services/notify.service");

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
    { connectionRetries: 3 }
  );

  await client.connect();
  console.log("✅ GramJS client connected");
  return client;
}

function normalizeForwarded(fwd) {
   if (Array.isArray(fwd) && Array.isArray(fwd[0])) return fwd[0];
   if (fwd && fwd.updates && Array.isArray(fwd.updates)) {
       return fwd.updates.filter(u => u.className === 'UpdateNewMessage' || u.className === 'UpdateNewChannelMessage').map(u => u.message);
   }
   return fwd;
} 

// ─── tag / metadata extraction ────────────────────────────────────────────────
const EXAM_KEYWORDS = [
  "exam", "final", "mid", "midterm", "quiz", "test", "past", "previous", "solved", "assignment",
];

const COURSE_KEYWORDS = [
  "dbms", "database", "oop", "data structure", "networking", "calculus", "physics", "chemistry",
  "compiler", "operating system", "algorithms", "linear algebra", "statistics", "thermodynamics",
  "circuit", "mechanics", "programming", "software engineering",
  "fluid mechanics", "structural analysis", "control systems", "digital electronics", "signal processing",
  "electromagnetic", "material science", "engineering drawing", "hydraulics",
  "java", "python", "c++", "web development", "mobile development", "artificial intelligence",
  "machine learning", "computer graphics", "software testing", "human computer interaction",
  "computer architecture", "discrete mathematics", "numerical methods", "computer networks",
  "anatomy", "physiology", "pharmacology", "pathology", "biochemistry", "microbiology",
  "nursing", "public health", "epidemiology",
  "accounting", "economics", "marketing", "finance", "management", "business law",
  "entrepreneurship", "microeconomics", "macroeconomics", "auditing",
  "constitutional law", "criminal law", "civil law", "contract", "tort", "jurisprudence",
  "family law", "commercial law",
  "biology", "organic chemistry", "inorganic chemistry", "geology", "environmental science",
  "differential equations", "complex analysis", "probability", "real analysis", "abstract algebra", "graph theory",
  "applied mathematics", "communicative english", "logic", "civics", "introduction to computing",
  "general physics", "general chemistry"
];

function extractTags(caption = "", fileName = "", channelUsername = "") {
  const cleanFileName = fileName.replace(/[_\-\.]/g, " ");
  const combinedText = `${caption} ${cleanFileName} ${channelUsername}`.toLowerCase();
  const rawTags = [];

  [...EXAM_KEYWORDS, ...COURSE_KEYWORDS].forEach((k) => {
    if (combinedText.includes(k)) rawTags.push(k.replace(/\s+/g, "_"));
  });

  return [...new Set(rawTags)].filter(t => t.length >= 2);
}

function isExam(text = "", fileName = "") {
  const combined = `${text} ${fileName}`.toLowerCase();
  return EXAM_KEYWORDS.some((k) => combined.includes(k));
}

function extractYear(text = "") {
  const m = text.match(/\b(20[1-2][0-9]|2030)\b/);
  return m ? parseInt(m[0]) : null;
}

function extractCourseCode(text = "") {
  const m1 = text.match(/\b([A-Za-z]{2,5})[\s\-]?(\d{2,4})\b/);
  if (m1) return `${m1[1].toUpperCase()}${m1[2]}`;

  const m2 = text.match(/\b(DBMS|OOP|DSA|HCI|OS|AI|ML)\b/i);
  return m2 ? m2[0].toUpperCase() : "";
}

function extractSemester(text = "") {
  const m = text.match(/\b(semester\s*[1-8]|sem\s*[1-8]|[1-4](st|nd|rd|th)\s*year|first\s*year|second\s*year|third\s*year|fourth\s*year|fifth\s*year)\b/i);
  return m ? m[0].trim() : "";
}

function extractUniversity(text = "") {
  const lower = text.toLowerCase();
  const unis = {
    "astu": "ASTU", "aau": "AAU", "addis ababa": "AAU", "ju": "JU", "jimma": "Jimma",
    "gondar": "Gondar", "haramaya": "Haramaya", "bahir dar": "Bahir Dar", "bdu": "Bahir Dar",
    "mekelle": "Mekelle", "mu": "Mekelle", "hawassa": "Hawassa"
  };

  for (const [key, val] of Object.entries(unis)) {
    if (key.length <= 4) {
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(lower)) return val;
    } else {
      if (lower.includes(key)) return val;
    }
  }
  return "";
}

function getFileType(fileName = "") {
  const ext = fileName.split(".").pop().toLowerCase();
  const map = { pdf: "pdf", ppt: "ppt", pptx: "ppt", doc: "doc", docx: "doc" };
  return map[ext] || "other";
}

// ─── process message group ────────────────────────────────────────────────────
async function processMessageGroup(msgs, channelUsername) {
  let bIndexed = 0;
  let bSkipped = 0;

  if (!msgs || msgs.length === 0) return { bIndexed, bSkipped };

  const resources = [];
  for (const msg of msgs) {
    const hasDoc = !!msg.document;
    const hasPhoto = !!msg.photo;
    if (!hasDoc && !hasPhoto) {
      bSkipped++;
      continue;
    }

    let fileId, fileUniqueId, fileName = "", fileType, fileSize;

    if (hasDoc) {
      const media = msg.media?.document;
      if (!media) { bSkipped++; continue; }

      fileId = media.id?.toString();
      fileUniqueId = media.accessHash?.toString();
      fileName = media.attributes?.find(a => a.className === "DocumentAttributeFilename")?.fileName || "";
      fileSize = media.size || 0;
      fileType = getFileType(fileName);
      if (fileType === "other") { bSkipped++; continue; }
    } else {
      const media = msg.media?.photo;
      if (!media) { bSkipped++; continue; }

      const sizes = media.sizes || [];
      const large = sizes[sizes.length - 1];
      fileId = media.id?.toString();
      fileUniqueId = media.accessHash?.toString();
      fileSize = large?.size || 0;
      fileType = "image";
    }

    if (!fileId) { bSkipped++; continue; }

    const caption = msg.message || "";
    const textToAnalyze = `${caption} ${fileName} ${channelUsername}`;

    const tags = extractTags(caption, fileName, channelUsername);
    const exam = isExam(caption, fileName);

    if (fileType === "image" && tags.length === 0 && !exam) { bSkipped++; continue; }

    resources.push({
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
      courseCode: extractCourseCode(textToAnalyze),
      year: extractYear(textToAnalyze),
      university: extractUniversity(textToAnalyze),
      semester: extractSemester(textToAnalyze),
      messageDate: msg.date ? new Date(msg.date * 1000) : null,
      relevanceScore: tags.length + (exam ? 5 : 0),
      _rawMsgId: msg.id
    });
  }

  if (resources.length === 0) return { bIndexed, bSkipped };

  // Apply group logic
  const gIdStr = msgs[0].groupedId ? msgs[0].groupedId.toString() : null;
  for (let i = 0; i < resources.length; i++) {
    if (gIdStr) {
      resources[i].groupId = gIdStr;
      resources[i].groupIndex = i + 1;
      resources[i].groupTotal = resources.length;
    }
  }

  // Split into existing vs new
  const msgIds = resources.map(r => r.messageId);
  const existingDocs = await TelegramResource.find({ channelUsername, messageId: { $in: msgIds } });
  const existingMap = new Map(existingDocs.map(d => [d.messageId, d]));

  const newResources = [];
  const existingResources = [];

  for (const r of resources) {
    if (existingMap.has(r.messageId)) existingResources.push(r);
    else newResources.push(r);
  }

  // Archive NEW resources using GramJS forwardMessages
  if (newResources.length > 0) {
    if (process.env.ARCHIVE_CHAT_ID) {
      const tg = await getClient();
      const archiveChatId = parseInt(process.env.ARCHIVE_CHAT_ID);
      const isGroup = newResources.length > 1 && newResources[0].groupId;
      const peer = channelUsername ? `@${channelUsername}` : parseInt(newResources[0].chatId);

      try {
        if (isGroup) {
          const msgIds = newResources.map(r => r._rawMsgId);
          const result = await tg.forwardMessages(archiveChatId, {
            messages: msgIds,
            fromPeer: peer
          });
          
          const fwdMsgs = normalizeForwarded(result);
          const groupArchiveIds = fwdMsgs.map(m => m.id);

          for (let i = 0; i < newResources.length; i++) {
            newResources[i].archiveMessageIds = groupArchiveIds;
            newResources[i].archiveMessageId = groupArchiveIds[i] || groupArchiveIds[0];
          }
        } else {
          for (let i = 0; i < newResources.length; i++) {
             const r = newResources[i];
             try {
               const result = await tg.forwardMessages(archiveChatId, {
                 messages: [r._rawMsgId],
                 fromPeer: peer
               });
               const fwdMsgs = normalizeForwarded(result);
               r.archiveMessageId = fwdMsgs[0]?.id;
               await new Promise(resolve => setTimeout(resolve, 150));
             } catch (e) {
               console.warn(`⚠️ Failed to archive message ${r._rawMsgId} from @${channelUsername}:`, e.message);
             }
          }
        }
      } catch (e) {
        console.warn(`⚠️ Failed to archive group from @${channelUsername}:`, e.message);
      }
    }

    try {
      newResources.forEach(r => delete r._rawMsgId);
      await TelegramResource.insertMany(newResources, { ordered: false });
      bIndexed += newResources.length;
    } catch (err) {
      bIndexed += (err.insertedDocs ? err.insertedDocs.length : 0);
    }
  }

  // Update existing
  for (const r of existingResources) {
    const rId = r._rawMsgId;
    delete r._rawMsgId;
    await TelegramResource.updateOne({ channelUsername, messageId: rId }, { $set: r });
    bIndexed++;
  }

  return { bIndexed, bSkipped };
}

async function processMessage(msg, channelUsername) {
  const result = await processMessageGroup([msg], channelUsername);
  return result.bIndexed > 0;
}

// ─── index one channel ────────────────────────────────────────────────────────
async function indexChannel(channelUsername) {
  const tg = await getClient();

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

    let currentGroup = [];
    let currentGroupId = null;

    for await (const msg of tg.iterMessages(`@${channelUsername}`, { minId: minId, reverse: true })) {
      const gIdStr = msg.groupedId ? msg.groupedId.toString() : null;

      if (gIdStr) {
        if (currentGroupId === gIdStr) {
          currentGroup.push(msg);
        } else {
          if (currentGroup.length > 0) {
            const res = await processMessageGroup(currentGroup, channelUsername);
            batchIndexed += res.bIndexed;
            batchSkipped += res.bSkipped;
          }
          currentGroupId = gIdStr;
          currentGroup = [msg];
        }
      } else {
        if (currentGroup.length > 0) {
          const res = await processMessageGroup(currentGroup, channelUsername);
          batchIndexed += res.bIndexed;
          batchSkipped += res.bSkipped;
          currentGroup = [];
          currentGroupId = null;
        }
        const res = await processMessageGroup([msg], channelUsername);
        batchIndexed += res.bIndexed;
        batchSkipped += res.bSkipped;
      }

      batchFetched++;
      totalFetched++;

      if (batchFetched >= 100) {
        indexed += batchIndexed;
        skipped += batchSkipped;
        const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(2);
        console.log(`  [Batch] Fetched: ${batchFetched}, Indexed: ${batchIndexed}, Skipped: ${batchSkipped}, Time: ${batchTime}s`);

        batchIndexed = 0;
        batchSkipped = 0;
        batchFetched = 0;
        batchStartTime = Date.now();

        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (currentGroup.length > 0) {
      const res = await processMessageGroup(currentGroup, channelUsername);
      batchIndexed += res.bIndexed;
      batchSkipped += res.bSkipped;
    }

    if (batchFetched > 0) {
      indexed += batchIndexed;
      skipped += batchSkipped;
      const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(2);
      console.log(`  [Batch] Fetched: ${batchFetched}, Indexed: ${batchIndexed}, Skipped: ${batchSkipped}, Time: ${batchTime}s`);
    }

    const totalTime = ((Date.now() - channelStartTime) / 1000).toFixed(2);

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

    const channel = await TelegramChannel.findOne({ username: channelUsername });
    if (channel) {
      const newFailureCount = (channel.failureCount || 0) + 1;
      let newStatus = "ACTIVE";

      if (newFailureCount >= 5) {
        newStatus = "DEAD";
        console.error(`  💀 @${channelUsername} DEAD (${newFailureCount} failures) - DISABLING`);
        notifyAdmin("CHANNEL_DEAD", { channelUsername, failureCount: newFailureCount });
      } else if (newFailureCount >= 3) {
        newStatus = "DEGRADED";
        console.warn(`  ⚠️  @${channelUsername} DEGRADED (${newFailureCount} failures)`);
        notifyAdmin("CHANNEL_DEGRADED", { channelUsername, failureCount: newFailureCount });
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

async function indexAllChannels() {
  const channels = await TelegramChannel.find({ active: true, healthStatus: "ACTIVE" }).sort({ priority: -1 });
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
  processMessageGroup,
  extractTags,
  extractCourseCode,
  extractYear,
  extractUniversity,
  extractSemester,
  getClient,
};
