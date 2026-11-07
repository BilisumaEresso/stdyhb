// Force IPv4 first to prevent IPv6 connect ETIMEDOUT on Render/cloud hosts
const dns = require("dns");
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const cron = require("node-cron");
const bot = require("./src/bot");
const { indexAllChannels, getClient } = require("./src/search/telegramIndexer");
const User = require("./src/db/models/User");
const TelegramResource = require("./src/db/models/TelegramResource");
const TelegramChannel = require("./src/db/models/TelegramChannel");
const SearchHistory = require("./src/db/models/SearchHistory");
const { notifyAdmin } = require("./src/services/notify.service");

async function bootstrap() {
  // Connect to MongoDB
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 20000,
      connectTimeoutMS: 8000,
    });
    console.log("✅ MongoDB connected");

    mongoose.connection.on('error', (err) => console.error('[MongoDB error]', err));
    mongoose.connection.on('disconnected', () => console.warn('[MongoDB] disconnected'));
  } catch (err) {
    console.error("❌ MongoDB error:", err);
  }

  // GramJS crash protection
  try {
    await getClient();
    console.log('✅ GramJS connected');
  } catch (err) {
    console.error('❌ GramJS failed:', err.message);
    console.warn('⚠️ Running without GramJS — file delivery disabled until session is fixed');
  }

  // Setup Express server
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.get("/", (req, res) => res.send("StudyHub Bot is running."));

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      mode: process.env.NODE_ENV || 'development'
    });
  });

  // Mount REST API for Web & Mobile
  app.use("/api", require("./src/api/routes"));

  // Diagnostic endpoints for Render & Webhook status
  app.get("/webhook-info", async (req, res) => {
    try {
      const info = await bot.telegram.getWebhookInfo();
      res.json({ ok: true, webhookInfo: info });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.get("/set-webhook", async (req, res) => {
    const rawUrl = req.query.url || process.env.WEBHOOK_URL;
    if (!rawUrl) {
      return res.status(400).json({ ok: false, message: "WEBHOOK_URL not set" });
    }
    const cleanUrl = rawUrl.replace(/\/+$/, "");
    try {
      await bot.telegram.setWebhook(`${cleanUrl}/webhook`);
      const info = await bot.telegram.getWebhookInfo();
      res.json({ ok: true, message: `Webhook configured at ${cleanUrl}/webhook`, webhookInfo: info });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Webhook vs Polling
  const rawWebhookUrl = process.env.WEBHOOK_URL || "";
  const webhookUrl = rawWebhookUrl.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production") {
    if (webhookUrl) {
      app.use(bot.webhookCallback("/webhook"));
      
      // Auto-retry setWebhook with exponential backoff
      const setupWebhookWithRetry = async (retries = 5, delay = 2000) => {
        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            await bot.telegram.setWebhook(`${webhookUrl}/webhook`);
            console.log(`✅ Webhook successfully configured at ${webhookUrl}/webhook`);
            return;
          } catch (err) {
            console.error(`❌ Webhook configuration failed (attempt ${attempt}/${retries}):`, err.message);
            if (attempt < retries) {
              const waitMs = delay * attempt;
              console.log(`   Retrying setWebhook in ${waitMs / 1000}s...`);
              await new Promise(r => setTimeout(r, waitMs));
            } else {
              console.warn(`⚠️ Could not auto-set webhook from server.`);
              console.warn(`👉 You can manually set it by visiting: ${webhookUrl}/set-webhook`);
            }
          }
        }
      };

      setupWebhookWithRetry();
    } else {
      console.warn("⚠️ WEBHOOK_URL not set in .env! Bot will not receive updates.");
    }
    console.log('✅ Bot started in WEBHOOK mode');
  } else {
    bot
      .launch({ dropPendingUpdates: true })
      .catch((err) => console.error("❌ Polling failed:", err));
    console.log('✅ Bot started in POLLING mode');
  }

  const server = app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
  });

  // Keep Render free tier alive — ping self every 10 minutes
  if (process.env.NODE_ENV === "production") {
    const https = require("https");
    setInterval(() => {
      const url = process.env.WEBHOOK_URL;
      if (!url) return;
      https.get(`${url}/health`, (res) => {
        console.log(`[KeepAlive] Ping ${res.statusCode}`);
      }).on("error", (err) => {
        console.warn("[KeepAlive] Ping failed:", err.message);
      });
    }, 10 * 60 * 1000); // every 10 minutes
  }

  // Export server for graceful shutdown reference
  return server;
}

const serverPromise = bootstrap();

const { getPendingDeliveryDebugInfo } = require("./src/telegram/fileDelivery");

// Graceful shutdown
const shutdown = async () => {
  console.log("🛑 Shutting down gracefully...");

  try {
    const debugInfo = await getPendingDeliveryDebugInfo();
    if (debugInfo.pendingDeliveries > 0 || debugInfo.pendingGroups > 0) {
      console.warn(`⚠️ WARNING: Shutting down with in-flight deliveries! Abandoning ${debugInfo.pendingDeliveries} single files and ${debugInfo.pendingGroups} groups. (${debugInfo.activeUserRequests} active user requests). Relay messages may be left stranded.`);
    }
  } catch (err) {
    console.error("Failed to check pending deliveries during shutdown:", err);
  }

  try {
    const server = await serverPromise;
    server.close(() => console.log("HTTP server closed"));
  } catch(e) {}
  mongoose.connection.close(false).then(() => {
    console.log("MongoDB connection closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("[FATAL-UNCAUGHT] Uncaught Exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[FATAL-UNHANDLED] Unhandled Rejection:", err);
});

// Re-index all channels every 6 hours
if (process.env.DISABLE_AUTO_INDEX !== 'true') {
  cron.schedule("0 */6 * * *", async () => {
    try {
      console.log("📅 Scheduled re-index starting...");
      await indexAllChannels();
    } catch (err) {
      console.error("❌ Scheduled re-index failed:", err);
    }
  });
} else {
  console.log("⚠️ Auto-indexing disabled via DISABLE_AUTO_INDEX env var");
}

// Daily Summary to Admin at 8:00 AM
cron.schedule("0 8 * * *", async () => {
  try {
    const totalUsers = await User.countDocuments();
    const totalResources = await TelegramResource.countDocuments();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const searchesToday = await SearchHistory.countDocuments({ createdAt: { $gte: startOfDay } });

    const deadChannelsObj = await TelegramChannel.find({ healthStatus: "DEAD" }, "username");
    const deadChannels = deadChannelsObj.map(c => `@${c.username}`);

    notifyAdmin("DAILY_SUMMARY", {
      totalUsers,
      totalResources,
      searchesToday,
      deadChannels
    });
  } catch (error) {
    console.error("❌ Error generating daily summary:", error);
  }
});

// Run once on startup after a 10s delay
if (process.env.DISABLE_AUTO_INDEX !== 'true') {
  setTimeout(async () => {
    try {
      await indexAllChannels();
    } catch (err) {
      console.error("❌ Startup re-index failed:", err);
    }
  }, 10000);
}
