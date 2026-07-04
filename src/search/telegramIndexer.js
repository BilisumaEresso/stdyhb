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
let isIndexing = false;

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

function normalizeForwarded(fwd) {
  if (Array.isArray(fwd) && Array.isArray(fwd[0])) return fwd[0];
  if (fwd && fwd.updates && Array.isArray(fwd.updates)) {
    return fwd.updates
      .filter(
        (u) =>
          u.className === "UpdateNewMessage" ||
          u.className === "UpdateNewChannelMessage",
      )
      .map((u) => u.message);
  }
  return fwd;
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
  "fluid mechanics",
  "structural analysis",
  "control systems",
  "digital electronics",
  "signal processing",
  "electromagnetic",
  "material science",
  "engineering drawing",
  "hydraulics",
  "java",
  "python",
  "c++",
  "web development",
  "mobile development",
  "artificial intelligence",
  "machine learning",
  "computer graphics",
  "software testing",
  "human computer interaction",
  "computer architecture",
  "discrete mathematics",
  "numerical methods",
  "computer networks",
  "anatomy",
  "physiology",
  "pharmacology",
  "pathology",
  "biochemistry",
  "microbiology",
  "nursing",
  "public health",
  "epidemiology",
  "accounting",
  "economics",
  "marketing",
  "finance",
  "management",
  "business law",
  "entrepreneurship",
  "microeconomics",
  "macroeconomics",
  "auditing",
  "constitutional law",
  "criminal law",
  "civil law",
  "contract",
  "tort",
  "jurisprudence",
  "family law",
  "commercial law",
  "biology",
  "organic chemistry",
  "inorganic chemistry",
  "geology",
  "environmental science",
  "differential equations",
  "complex analysis",
  "probability",
  "real analysis",
  "abstract algebra",
  "graph theory",
  "applied mathematics",
  "communicative english",
  "logic",
  "civics",
  "introduction to computing",
  "general physics",
  "general chemistry",
];

function extractTags(caption = "", fileName = "", channelUsername = "") {
  const cleanFileName = fileName.replace(/[_\-\.]/g, " ");
  const combinedText =
    `${caption} ${cleanFileName} ${channelUsername}`.toLowerCase();
  const rawTags = [];

  [...EXAM_KEYWORDS, ...COURSE_KEYWORDS].forEach((k) => {
    if (combinedText.includes(k)) rawTags.push(k.replace(/\s+/g, "_"));
  });

  return [...new Set(rawTags)].filter((t) => t.length >= 2);
}

function isExam(text = "", fileName = "") {
  const combined = `${text} ${fileName}`.toLowerCase();
  if (EXAM_KEYWORDS.some((k) => combined.includes(k))) return true;
  // Ethiopian exam sets often have only a year in the caption — treat as exam
  if (/\b(201[5-9]|202[0-9])\b/.test(combined)) return true;
  return false;
}

function extractYear(text = "") {
  const m = text.match(/\b(20[1-2][0-9]|2030)\b/);
  return m ? parseInt(m[0]) : null;
}

function extractCourseCode(text = "") {
  const m1 = text.match(/\b([A-Za-z]{2,5})[\s\-]?(\d{2,4})\b/);
  if (m1) {
    const num = parseInt(m1[2], 10);
    const looksLikeYear = m1[2].length === 4 && num >= 2010 && num <= 2039;
    if (!looksLikeYear) return `${m1[1].toUpperCase()}${m1[2]}`;
  }
  const m2 = text.match(/\b(DBMS|OOP|DSA|HCI|OS|AI|ML)\b/i);
  return m2 ? m2[0].toUpperCase() : "";
}

function extractSemester(text = "") {
  const m = text.match(
    /\b(semester\s*[1-8]|sem\s*[1-8]|[1-4](st|nd|rd|th)\s*year|first\s*year|second\s*year|third\s*year|fourth\s*year|fifth\s*year)\b/i,
  );
  return m ? m[0].trim() : "";
}

function extractUniversity(text = "") {
  const lower = text.toLowerCase();
  const unis = {
    astu: "ASTU",
    aau: "AAU",
    "addis ababa": "AAU",
    ju: "JU",
    jimma: "Jimma",
    gondar: "Gondar",
    haramaya: "Haramaya",
    "bahir dar": "Bahir Dar",
    bdu: "Bahir Dar",
    mekelle: "Mekelle",
    mu: "Mekelle",
    hawassa: "Hawassa",
  };

  for (const [key, val] of Object.entries(unis)) {
    if (key.length <= 4) {
      const regex = new RegExp(`\\b${key}\\b`, "i");
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
  const groupCaption =
    msgs.find((m) => m.message && m.message.trim().length > 0)?.message || "";
  const resources = [];
  for (const msg of msgs) {
    const hasDoc = !!msg.document;
    const hasPhoto = !!msg.photo;
    if (!hasDoc && !hasPhoto) {
      bSkipped++;
      continue;
    }

    let fileId,
      fileUniqueId,
      fileName = "",
      fileType,
      fileSize;

    if (hasDoc) {
      const media = msg.media?.document;
      if (!media) {
        bSkipped++;
        continue;
      }

      fileId = media.id?.toString();
      fileUniqueId = media.accessHash?.toString();
      fileName =
        media.attributes?.find(
          (a) => a.className === "DocumentAttributeFilename",
        )?.fileName || "";
      fileSize = media.size || 0;
      fileType = getFileType(fileName);
      if (fileType === "other") {
        bSkipped++;
        continue;
      }
    } else {
      const media = msg.media?.photo;
      if (!media) {
        bSkipped++;
        continue;
      }

      const sizes = media.sizes || [];
      const large = sizes[sizes.length - 1];
      fileId = media.id?.toString();
      fileUniqueId = media.accessHash?.toString();
      fileSize = large?.size || 0;
      fileType = "image";
    }

    if (!fileId) {
      bSkipped++;
      continue;
    }

    const caption = msgs.length > 1 ? groupCaption : msg.message || "";
    const textToAnalyze = `${caption} ${fileName} ${channelUsername}`;

    let tags = extractTags(caption, fileName, channelUsername);
    let exam = isExam(caption, fileName);

    const isGrouped = msgs.length > 1;
    if (fileType === "image" && tags.length === 0 && !exam) {
      if (isGrouped) {
        // Grouped with no tags = almost certainly a multi-page exam set
        // Inject channel name as a searchable tag so it appears in channel searches
        tags = [channelUsername.toLowerCase().replace(/[^a-z0-9]/g, "")];
        exam = true;
      } else {
        // Solo image with nothing identifiable — skip
        bSkipped++;
        continue;
      }
    }

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
      _rawMsgId: msg.id,
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
  const msgIds = resources.map((r) => r.messageId);
  const existingDocs = await TelegramResource.find({
    channelUsername,
    messageId: { $in: msgIds },
  });
  const existingMap = new Map(existingDocs.map((d) => [d.messageId, d]));

  const newResources = [];
  const existingResources = [];

  for (const r of resources) {
    if (existingMap.has(r.messageId)) existingResources.push(r);
    else newResources.push(r);
  }

  // Save NEW resources to DB
  if (newResources.length > 0) {
    newResources.forEach((r) => {
      r._id = new mongoose.Types.ObjectId();
    });

    try {
      const docsToInsert = newResources.map((r) => {
        const copy = { ...r };
        delete copy._rawMsgId;
        return copy;
      });
      await TelegramResource.insertMany(docsToInsert, { ordered: false });
      bIndexed += newResources.length;
    } catch (err) {
      bIndexed += err.insertedDocs ? err.insertedDocs.length : 0;
    }
  }

  // Update existing
  for (const r of existingResources) {
    const rId = r._rawMsgId;
    delete r._rawMsgId;
    await TelegramResource.updateOne(
      { channelUsername, messageId: rId },
      { $set: r },
    );
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
  const maxResource = await TelegramResource.findOne({ channelUsername }).sort({
    messageId: -1,
  });
  const minId = maxResource ? maxResource.messageId : 0;

  console.log(
    `\nIndexing @${channelUsername} (Incremental from msgId: ${minId})...`,
  );

  let indexed = 0;
  let skipped = 0;
  let totalFetched = 0;
  const channelStartTime = Date.now();

  try {
    const tg = await getClient();
    let batchIndexed = 0;
    let batchSkipped = 0;
    let batchFetched = 0;
    let batchStartTime = Date.now();

    let currentGroup = [];
    let currentGroupId = null;
    let loggedFirstMsg = false;

    for await (const msg of tg.iterMessages(`@${channelUsername}`, {
      minId: minId,
      reverse: true,
    })) {
      if (!loggedFirstMsg) {
        loggedFirstMsg = true;
        if (minId === 0) {
          const seenDate = msg.date
            ? new Date(msg.date * 1000).toISOString()
            : "unknown date";
          console.log(
            `  🔎 First visible message for @${channelUsername}: ID ${msg.id}, dated ${seenDate}. If this isn't close to the channel's real founding date, GramJS likely can't see full history here (check "Chat history for new members" on that channel).`,
          );
        }
      }
      const gIdStr = msg.groupedId ? msg.groupedId.toString() : null;

      if (gIdStr) {
        if (currentGroupId === gIdStr) {
          currentGroup.push(msg);
        } else {
          if (currentGroup.length > 0) {
            const res = await processMessageGroup(
              currentGroup,
              channelUsername,
            );
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
        console.log(
          `  [Batch] Fetched: ${batchFetched}, Indexed: ${batchIndexed}, Skipped: ${batchSkipped}, Time: ${batchTime}s`,
        );

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
      console.log(
        `  [Batch] Fetched: ${batchFetched}, Indexed: ${batchIndexed}, Skipped: ${batchSkipped}, Time: ${batchTime}s`,
      );
    }

    const totalTime = ((Date.now() - channelStartTime) / 1000).toFixed(2);

    // Update channel: mark as fullyIndexed if this was a from-scratch scan (minId === 0)
    const updateObj = {
      lastScannedAt: new Date(),
      lastSuccessfulScan: new Date(),
      healthStatus: "ACTIVE",
      failureCount: 0,
      lastError: null,
    };
    if (minId === 0) {
      updateObj.fullyIndexed = true;
    }

    await TelegramChannel.updateOne(
      { username: channelUsername },
      {
        $set: updateObj,
        $inc: { totalIndexed: indexed },
      },
    );

    console.log(`  ✅ @${channelUsername} COMPLETED: Indexed: ${indexed}`);
    return { indexed, skipped, error: null };
  } catch (err) {
    const errorMsg = err.message;
    console.error(`  ❌ @${channelUsername}: ${errorMsg}`);

    const channel = await TelegramChannel.findOne({
      username: channelUsername,
    });
    if (channel) {
      const newFailureCount = (channel.failureCount || 0) + 1;
      let newStatus = "ACTIVE";

      if (newFailureCount >= 5) {
        newStatus = "DEAD";
        console.error(
          `  💀 @${channelUsername} DEAD (${newFailureCount} failures) - DISABLING`,
        );
        notifyAdmin("CHANNEL_DEAD", {
          channelUsername,
          failureCount: newFailureCount,
        });
      } else if (newFailureCount >= 3) {
        newStatus = "DEGRADED";
        console.warn(
          `  ⚠️  @${channelUsername} DEGRADED (${newFailureCount} failures)`,
        );
        notifyAdmin("CHANNEL_DEGRADED", {
          channelUsername,
          failureCount: newFailureCount,
        });
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
        },
      );
    }
    return { indexed, skipped, error: errorMsg };
  }
}

// ─── index one channel section (for full scans in batches) ────────────────────
async function indexChannelSection(channelUsername, limit = 500) {
  const maxResource = await TelegramResource.findOne({ channelUsername }).sort({
    messageId: -1,
  });
  const minId = maxResource ? maxResource.messageId : 0;

  console.log(
    `\nIndexing @${channelUsername} [Section] (from msgId: ${minId}, limit: ${limit})...`,
  );

  let indexed = 0;
  let skipped = 0;
  let totalFetched = 0;
  let reachedEnd = false;
  const channelStartTime = Date.now();

  try {
    const tg = await getClient();
    let batchIndexed = 0;
    let batchSkipped = 0;
    let batchFetched = 0;
    let batchStartTime = Date.now();

    let currentGroup = [];
    let currentGroupId = null;
    let loggedFirstMsg = false;

    for await (const msg of tg.iterMessages(`@${channelUsername}`, {
      minId: minId,
      reverse: true,
      limit: limit,
    })) {
      if (!loggedFirstMsg) {
        loggedFirstMsg = true;
        if (minId === 0) {
          const seenDate = msg.date
            ? new Date(msg.date * 1000).toISOString()
            : "unknown date";
          console.log(
            `  🔎 First visible message for @${channelUsername}: ID ${msg.id}, dated ${seenDate}`,
          );
        }
      }
      const gIdStr = msg.groupedId ? msg.groupedId.toString() : null;

      if (gIdStr) {
        if (currentGroupId === gIdStr) {
          currentGroup.push(msg);
        } else {
          if (currentGroup.length > 0) {
            const res = await processMessageGroup(
              currentGroup,
              channelUsername,
            );
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
        console.log(
          `  [Section-Batch] Fetched: ${batchFetched}, Indexed: ${batchIndexed}, Skipped: ${batchSkipped}, Time: ${batchTime}s`,
        );

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
      console.log(
        `  [Section-Batch] Fetched: ${batchFetched}, Indexed: ${batchIndexed}, Skipped: ${batchSkipped}, Time: ${batchTime}s`,
      );
    }

    // Check if we reached the end: if fetched < limit, we've caught up
    reachedEnd = totalFetched < limit;

    const totalTime = ((Date.now() - channelStartTime) / 1000).toFixed(2);

    // Update channel with progress
    const updateObj = {
      lastScannedAt: new Date(),
    };
    // Only set fullyIndexed if we reached the end (caught up to present)
    if (reachedEnd) {
      updateObj.fullyIndexed = true;
      console.log(`  ✅ @${channelUsername} reached end of history`);
    }

    await TelegramChannel.updateOne(
      { username: channelUsername },
      {
        $set: updateObj,
        $inc: { totalIndexed: indexed },
      },
    );

    console.log(
      `  ✅ @${channelUsername} [Section] COMPLETED: Indexed: ${indexed}, reachedEnd: ${reachedEnd}`,
    );
    return { indexed, skipped, reachedEnd, error: null };
  } catch (err) {
    const errorMsg = err.message;
    console.error(`  ❌ @${channelUsername} [Section]: ${errorMsg}`);

    const channel = await TelegramChannel.findOne({
      username: channelUsername,
    });
    if (channel) {
      const newFailureCount = (channel.failureCount || 0) + 1;
      let newStatus = "ACTIVE";

      if (newFailureCount >= 5) {
        newStatus = "DEAD";
        console.error(
          `  💀 @${channelUsername} DEAD (${newFailureCount} failures) - DISABLING`,
        );
        notifyAdmin("CHANNEL_DEAD", {
          channelUsername,
          failureCount: newFailureCount,
        });
      } else if (newFailureCount >= 3) {
        newStatus = "DEGRADED";
        console.warn(
          `  ⚠️  @${channelUsername} DEGRADED (${newFailureCount} failures)`,
        );
        notifyAdmin("CHANNEL_DEGRADED", {
          channelUsername,
          failureCount: newFailureCount,
        });
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
        },
      );
    }
    return { indexed, skipped, reachedEnd: false, error: errorMsg };
  }
}

async function indexAllChannels() {
  if (isIndexing) {
    console.warn(
      "⚠️ indexAllChannels() called while a scan is already in progress — skipping this run.",
    );
    return { skipped: true, reason: "already_running" };
  }
  isIndexing = true;

  try {
    const channels = await TelegramChannel.find({
      active: true,
      healthStatus: "ACTIVE",
    }).sort({ priority: -1 });
    console.log(`Starting indexer — ${channels.length} ACTIVE channels`);

    const results = [];
    for (const ch of channels) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const r = await indexChannel(ch.username);
        results.push({ channel: ch.username, ...r });
      } catch (err) {
        console.error(
          `[FATAL-UNHANDLED] Unexpected error in indexChannel for @${ch.username}:`,
          err,
        );
        results.push({
          channel: ch.username,
          indexed: 0,
          skipped: 0,
          error: err.message,
        });
      }
    }

    const total = results.reduce((sum, r) => sum + r.indexed, 0);
    console.log(`\nDone. Total indexed: ${total}`);
    return results;
  } finally {
    isIndexing = false;
  }
}

function isIndexingInProgress() {
  return isIndexing;
}

module.exports = {
  indexAllChannels,
  indexChannel,
  indexChannelSection,
  processMessage,
  processMessageGroup,
  extractTags,
  extractCourseCode,
  extractYear,
  extractUniversity,
  extractSemester,
  getClient,
  isIndexingInProgress,
};
