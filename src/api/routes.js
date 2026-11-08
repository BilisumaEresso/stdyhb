const express = require("express");
const router = express.Router();
const TelegramResource = require("../db/models/TelegramResource");
const searchService = require("../search/search.service");
const { getClient } = require("../search/telegramIndexer");
const { generateDisplayTitle } = require("../utils/titleGenerator");

// ─── Lightweight CORS & JSON Middleware ──────────────────────────────────────
router.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Range");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length, Content-Disposition");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── GET /api/stats ──────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const [totalResources, totalExams] = await Promise.all([
      TelegramResource.countDocuments({ isAvailable: true }),
      TelegramResource.countDocuments({ isAvailable: true, isExam: true })
    ]);

    res.json({
      success: true,
      data: {
        totalResources,
        totalExams,
        universities: ["ASTU", "AAU", "AASTU", "Jimma", "Hawassa", "Bahir Dar", "Haramaya"]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/trending ───────────────────────────────────────────────────────
router.get("/trending", async (req, res) => {
  try {
    const [topDownloaded, recentExams] = await Promise.all([
      TelegramResource.find({ isAvailable: true })
        .sort({ downloadCount: -1 })
        .limit(10)
        .lean(),
      TelegramResource.find({ isAvailable: true, isExam: true })
        .sort({ indexedAt: -1 })
        .limit(10)
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        topDownloaded: topDownloaded.map(r => ({ ...r, title: r.cleanTitle || generateDisplayTitle(r) })),
        recentExams: recentExams.map(r => ({ ...r, title: r.cleanTitle || generateDisplayTitle(r) }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/search ─────────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  try {
    const {
      q = "",
      university = "",
      fileType = "",
      isExam = "",
      page = 1,
      limit = 20
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));

    if (q.trim()) {
      let results = await searchService.searchResources(q.trim(), null);

      if (university) {
        results = results.filter(r => (r.university || "").toLowerCase().includes(university.toLowerCase()));
      }
      if (fileType) {
        results = results.filter(r => (r.fileType || "").toLowerCase() === fileType.toLowerCase());
      }
      if (isExam === "true") {
        results = results.filter(r => r.isExam || r.fileType === "image" || Boolean(r.groupId));
      }

      const total = results.length;
      const startIdx = (pageNum - 1) * limitNum;
      const paginated = results.slice(startIdx, startIdx + limitNum);

      return res.json({
        success: true,
        data: paginated,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    }

    const filter = {
      isAvailable: true,
      $or: [{ groupId: null }, { groupIndex: 0 }, { groupIndex: { $exists: false } }]
    };
    if (university) {
      filter.university = new RegExp(university, "i");
    }
    if (fileType) {
      filter.fileType = fileType.toLowerCase();
    }
    if (isExam === "true") {
      filter.isExam = true;
    }

    const [total, items] = await Promise.all([
      TelegramResource.countDocuments(filter),
      TelegramResource.find(filter)
        .sort({ downloadCount: -1, indexedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean()
    ]);

    const formattedItems = items.map(r => ({
      ...r,
      title: r.cleanTitle || generateDisplayTitle(r)
    }));

    res.json({
      success: true,
      data: formattedItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error("[API SEARCH ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/resources/:id ──────────────────────────────────────────────────
router.get("/resources/:id", async (req, res) => {
  try {
    const resource = await TelegramResource.findById(req.params.id).lean();
    if (!resource) {
      return res.status(404).json({ success: false, error: "Resource not found" });
    }

    let groupItems = [];
    if (resource.groupId) {
      groupItems = await TelegramResource.find({
        groupId: resource.groupId,
        isAvailable: true
      })
        .sort({ groupIndex: 1 })
        .lean();
    }

    res.json({
      success: true,
      data: {
        ...resource,
        title: resource.cleanTitle || generateDisplayTitle(resource),
        groupItems: groupItems.map(g => ({
          ...g,
          title: g.cleanTitle || generateDisplayTitle(g)
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/resources/:id/similar ──────────────────────────────────────────
router.get("/resources/:id/similar", async (req, res) => {
  try {
    const resource = await TelegramResource.findById(req.params.id).lean();
    if (!resource) {
      return res.status(404).json({ success: false, error: "Resource not found" });
    }

    const orConditions = [];
    if (resource.courseCode && resource.courseCode.trim()) {
      orConditions.push({ courseCode: new RegExp(resource.courseCode.trim(), "i") });
    }
    if (resource.tags && resource.tags.length > 0) {
      orConditions.push({ tags: { $in: resource.tags } });
    }
    if (resource.university && resource.university.trim()) {
      orConditions.push({ university: new RegExp(resource.university.trim(), "i") });
    }
    if (resource.fileType) {
      orConditions.push({ fileType: resource.fileType });
    }

    const query = {
      _id: { $ne: resource._id },
      isAvailable: true,
      $or: orConditions.length > 0 ? orConditions : [{ isAvailable: true }]
    };

    if (resource.groupId) {
      query.groupId = { $ne: resource.groupId };
    }

    const similar = await TelegramResource.find(query)
      .sort({ downloadCount: -1, indexedAt: -1 })
      .limit(6)
      .lean();

    const formatted = similar.map(r => ({
      ...r,
      title: r.cleanTitle || generateDisplayTitle(r)
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (err) {
    console.error("[SIMILAR ERROR]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/files/stream/:id & /download/:id ────────────────────────────────
async function streamTelegramFile(req, res, isDownload = false) {
  let resource;
  try {
    resource = await TelegramResource.findById(req.params.id);
    if (!resource) {
      return res.status(404).json({ success: false, error: "Resource not found" });
    }

    const botFallbackUrl = `https://t.me/studyhub_resource_bot?start=get_${resource._id}`;
    const wantsJson =
      isDownload ||
      req.headers["sec-fetch-dest"] === "empty" ||
      (req.headers.accept && req.headers.accept.includes("application/json")) ||
      req.query.format === "json";

    const tg = await getClient();
    if (!tg) {
      if (wantsJson) {
        return res.status(503).json({
          success: false,
          error: "Telegram client unavailable. Please receive directly in Telegram.",
          fallbackBotUrl: botFallbackUrl,
          resourceId: resource._id,
          fileName: resource.fileName || "Resource"
        });
      }
      return res.redirect(botFallbackUrl);
    }

    let message = null;
    const archiveChatId = process.env.ARCHIVE_CHAT_ID ? parseInt(process.env.ARCHIVE_CHAT_ID) : null;

    // 1. Try Archive message first if present
    if (resource.archiveMessageId && archiveChatId) {
      try {
        const msgs = await tg.getMessages(archiveChatId, { ids: [resource.archiveMessageId] });
        if (msgs && msgs[0] && (msgs[0].media || msgs[0].document || msgs[0].photo)) {
          message = msgs[0];
        }
      } catch (archErr) {
        console.warn(`[API] Archive fetch failed for ${resource._id}:`, archErr.message);
      }
    }

    // 2. If not found in archive, try channel
    if (!message && resource.channelUsername) {
      try {
        const peer = `@${resource.channelUsername}`;
        const entity = await tg.getEntity(peer);
        const msgs = await tg.getMessages(entity, { ids: [resource.messageId] });
        if (msgs && msgs[0] && (msgs[0].media || msgs[0].document || msgs[0].photo)) {
          message = msgs[0];
        }
      } catch (chanErr) {
        console.warn(`[API] Channel fetch failed for ${resource._id}:`, chanErr.message);
      }
    }

    // 3. Fallback: If Telegram media cannot be read via MTProto
    if (!message || (!message.media && !message.document && !message.photo)) {
      console.warn(`[API] Media not directly readable for ${resource._id}`);
      if (wantsJson) {
        return res.status(504).json({
          success: false,
          error: "Direct file stream unavailable. Please use Telegram Bot delivery for instant access.",
          fallbackBotUrl: botFallbackUrl,
          resourceId: resource._id,
          fileName: resource.fileName || "Resource"
        });
      }
      return res.redirect(botFallbackUrl);
    }

    const doc = message.document || message.media?.document;
    const isPhoto = Boolean(message.photo || (message.media && message.media.photo));

    let mimeType = "application/octet-stream";
    if (doc) {
      mimeType = doc.mimeType || (resource.fileType === "pdf" ? "application/pdf" : "application/octet-stream");
    } else if (isPhoto) {
      mimeType = "image/jpeg";
    }

    const fileExtension = resource.fileType === "pdf" ? "pdf" : resource.fileType === "ppt" ? "pptx" : isPhoto ? "jpg" : "bin";
    const rawFileName = resource.fileName || `studyhub_${resource._id}.${fileExtension}`;
    const safeFileName = rawFileName.replace(/[^\w\.\-\s]/gi, "_");

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("X-Bot-Fallback-Url", botFallbackUrl);

    if (isDownload) {
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeFileName)}"`);
    } else {
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(safeFileName)}"`);
    }

    // If file is large (> 8MB), attempt streaming via iterDownload to avoid RAM buffer bloat
    if (doc && resource.fileSize && resource.fileSize > 8 * 1024 * 1024) {
      res.setHeader("Content-Length", resource.fileSize);
      try {
        let streamed = false;
        for await (const chunk of tg.iterDownload({ file: message.media, requestSize: 512 * 1024 })) {
          if (res.writableEnded || res.closed) break;
          res.write(chunk);
          streamed = true;
        }
        if (!res.writableEnded) {
          res.end();
        }
        // Asynchronously record download count
        TelegramResource.findByIdAndUpdate(resource._id, { $inc: { downloadCount: 1 } }).catch(() => {});
        return;
      } catch (iterErr) {
        console.warn(`[STREAM] iterDownload chunk error for ${resource._id}:`, iterErr.message);
        if (res.headersSent) {
          return res.end();
        }
      }
    }

    // Standard download media buffer for smaller files or fallback
    const buffer = await tg.downloadMedia(message);
    if (!buffer || buffer.length === 0) {
      if (wantsJson) {
        return res.status(504).json({
          success: false,
          error: "Empty media buffer received from Telegram.",
          fallbackBotUrl: botFallbackUrl,
          resourceId: resource._id,
          fileName: resource.fileName || "Resource"
        });
      }
      return res.redirect(botFallbackUrl);
    }

    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);

    // Asynchronously record download count
    TelegramResource.findByIdAndUpdate(resource._id, { $inc: { downloadCount: 1 } }).catch(() => {});
  } catch (err) {
    console.error("[STREAM ERROR]", err.message);
    const botUrl = resource ? `https://t.me/studyhub_resource_bot?start=get_${resource._id}` : "https://t.me/studyhub_resource_bot";
    const wantsJson =
      isDownload ||
      req.headers["sec-fetch-dest"] === "empty" ||
      (req.headers.accept && req.headers.accept.includes("application/json")) ||
      req.query.format === "json";

    if (!res.headersSent) {
      if (wantsJson) {
        return res.status(504).json({
          success: false,
          error: "Direct stream failed or timed out. Use Telegram Bot for guaranteed high-speed delivery.",
          fallbackBotUrl: botUrl,
          resourceId: resource?._id
        });
      }
      return res.redirect(botUrl);
    }
  }
}

router.get("/files/stream/:id", (req, res) => streamTelegramFile(req, res, false));
router.get("/files/download/:id", (req, res) => streamTelegramFile(req, res, true));

module.exports = router;
