require("dotenv").config();
const mongoose = require("mongoose");
const bot = require("./src/bot");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Launch bot
bot.launch();

console.log("🤖 Bot running...");
