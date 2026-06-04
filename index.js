require("dotenv").config();
const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected "))
  .catch((err) => console.error("❌ MongoDB error:", err));

const { Telegraf } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    "🎓 Welcome to StudyHub!\n\nSearch exams, PPTs, notes, and study resources.\n\nExample:\n/search database systems",
  );
});

bot.command("search", (ctx) => {
  const query = ctx.message.text.split(" ").slice(1).join(" ");

  if (!query) {
    return ctx.reply("Please provide a search query.");
  }

  ctx.reply(`🔍 Searching for: ${query}`);
});

bot.launch();

console.log("🤖 Bot running...");