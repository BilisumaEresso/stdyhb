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
    let resources = await TelegramResource.find({ downloadCount: { $gt: 0 }, isAvailable: { $ne: false } })
      .sort({ downloadCount: -1 })
      .limit(8);

    let isFallback = false;
    if (!resources || resources.length === 0) {
      // Fallback to latest resources if no downloads recorded yet
      resources = await TelegramResource.find({ isAvailable: { $ne: false } })
        .sort({ indexedAt: -1 })
        .limit(8);
      isFallback = true;
    }

    if (!resources || resources.length === 0) {
      return await ctx.reply(
        "🔥 No trending resources found yet. Check back soon!",
      );
    }

    let message = isFallback
      ? "🔥 <b>Featured Study Materials</b>\n\n"
      : "🔥 <b>Trending This Week</b>\n\n";

    const buttons = [];

    resources.forEach((resource, index) => {
      let title = escapeHtml(
        resource.fileName || resource.caption || "Untitled",
      );
      if (title.length > 40) title = title.substring(0, 39) + "…";

      const channel = resource.channelUsername
        ? ` @${escapeHtml(resource.channelUsername)}`
        : "";
      const type = escapeHtml((resource.fileType || "file").toUpperCase());

      message += `${index + 1}. 📄 <b>${title}</b>${channel}\n`;
      if (!isFallback) {
        message += `   📥 Downloads: <b>${resource.downloadCount}</b> · Type: <b>${type}</b>\n\n`;
      } else {
        message += `   Type: <b>${type}</b>\n\n`;
      }

      const action = resource.groupId && resource.fileType === "image"
        ? `grp_${resource._id}`
        : `get_${resource._id}`;
      buttons.push([Markup.button.callback(`📥 Get #${index + 1} (${title.slice(0, 22)})`, action)]);
    });

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
    });
  } catch (error) {
    console.error("Error in /trending command:", error);
    await ctx.reply("❌ An error occurred while loading trending resources.");
  }
}

module.exports = trendingCommand;
