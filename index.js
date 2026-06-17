require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const cron = require("node-cron");
const bot = require("./src/bot");
const { indexAllChannels } = require("./src/search/telegramIndexer");
const { notifyAdmin } = require("./src/services/notify.service");
const User = require("./src/db/models/User");
const TelegramResource = require("./src/db/models/TelegramResource");
const TelegramChannel = require("./src/db/models/TelegramChannel");
const SearchHistory = require("./src/db/models/SearchHistory");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Setup Express server for Render webhooks
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => res.send("StudyHub Bot is running."));
app.get("/health", (req, res) => res.status(200).send("OK"));

// Webhook setup
const webhookUrl = process.env.WEBHOOK_URL;
if (process.env.NODE_ENV === "development") {
  bot.launch();
  console.log("🔧 bot running locally for development")
}else {

  if (webhookUrl) {
    app.use(bot.webhookCallback("/webhook"));
    bot.telegram.setWebhook(`${webhookUrl}/webhook`)
      .then(() => console.log(`✅ Webhook configured at ${webhookUrl}/webhook`))
      .catch(err => console.error("❌ Webhook configuration failed:", err));
  } else {
    console.warn("⚠️ WEBHOOK_URL not set in .env! Bot will not receive updates.");
  }
}

const server = app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("🛑 Shutting down gracefully...");
  server.close(() => console.log("HTTP server closed"));
  mongoose.connection.close(false).then(() => {
    console.log("MongoDB connection closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  shutdown();
});
process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  shutdown();
});

// Re-index all channels every 6 hours
if (process.env.DISABLE_AUTO_INDEX !== 'true') {
  cron.schedule("0 */6 * * *", async () => {
    console.log("📅 Scheduled re-index starting...");
    await indexAllChannels();
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
  setTimeout(indexAllChannels, 10000);
}
