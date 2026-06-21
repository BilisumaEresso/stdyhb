require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const cron = require("node-cron");
const bot = require("./src/bot");
const { indexAllChannels, getClient } = require("./src/search/telegramIndexer");

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

  // Webhook vs Polling
  const webhookUrl = process.env.WEBHOOK_URL;
  if (process.env.NODE_ENV === "production") {
    if (webhookUrl) {
      app.use(bot.webhookCallback("/webhook"));
      bot.telegram.setWebhook(`${webhookUrl}/webhook`)
        .then(() => console.log(`✅ Webhook configured at ${webhookUrl}/webhook`))
        .catch(err => console.error("❌ Webhook configuration failed:", err));
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
