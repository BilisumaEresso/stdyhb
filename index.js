require("dotenv").config();
const mongoose = require("mongoose");
const cron = require("node-cron");
const bot = require("./src/bot");
const { indexAllChannels } = require("./src/search/telegramIndexer");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Launch bot
bot.launch();

console.log("🤖 Bot running...");

// Re-index all channels every 6 hours
cron.schedule("0 */6 * * *", async () => {
  console.log("📅 Scheduled re-index starting...");
  await indexAllChannels();
});

// Run once on startup after a 10s delay
setTimeout(indexAllChannels, 10000);
