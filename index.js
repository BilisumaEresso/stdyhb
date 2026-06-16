require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const cron = require("node-cron");
const bot = require("./src/bot");
const { indexAllChannels } = require("./src/search/telegramIndexer");

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
if (webhookUrl) {
  app.use(bot.webhookCallback("/webhook"));
  bot.telegram.setWebhook(`${webhookUrl}/webhook`)
    .then(() => console.log(`✅ Webhook configured at ${webhookUrl}/webhook`))
    .catch(err => console.error("❌ Webhook configuration failed:", err));
} else {
  console.warn("⚠️ WEBHOOK_URL not set in .env! Bot will not receive updates.");
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
cron.schedule("0 */6 * * *", async () => {
  console.log("📅 Scheduled re-index starting...");
  await indexAllChannels();
});

// Run once on startup after a 10s delay
setTimeout(indexAllChannels, 10000);
