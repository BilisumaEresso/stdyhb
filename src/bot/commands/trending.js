const TelegramResource = require("../../db/models/TelegramResource");
const { Markup } = require("telegraf");

function escapeHtml(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function trendingCommand(ctx) {
  try {
    const resources = await TelegramResource.find({ downloadCount: { $gt: 0 } })
      .sort({ downloadCount: -1 })
      .limit(8);

    if (!resources || resources.length === 0) {
      return await ctx.reply(
        "🔥 No trending resources found yet. Try again after more downloads occur.",
      );
    }

    let message = "🔥 <b>Trending This Week</b>\n\n";

    resources.forEach((resource, index) => {
      const title = escapeHtml(
        resource.fileName || resource.caption || "Untitled",
      );
      const channel = resource.channelUsername
        ? ` @${escapeHtml(resource.channelUsername)}`
        : "";
      message += `${index + 1}. <b>${title}</b>${channel}\n`;
      message += `   📥 Downloads: <b>${resource.downloadCount}</b>\n`;
      message += `   📄 Type: <b>${escapeHtml(resource.fileType || "other")}</b>\n\n`;
    });

    await ctx.reply(message, {
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error("Error in /trending command:", error);
    await ctx.reply("❌ An error occurred while loading trending resources.");
  }
}

module.exports = trendingCommand;
