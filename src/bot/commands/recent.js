const TelegramResource = require("../../db/models/TelegramResource");
const { Markup } = require("telegraf");

function escapeHtml(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function recentCommand(ctx) {
  try {
    const resources = await TelegramResource.find({ isAvailable: { $ne: false } })
      .sort({ indexedAt: -1, _id: -1 })
      .limit(8);

    if (!resources || resources.length === 0) {
      return await ctx.reply("🆕 No resources have been indexed yet.");
    }

    let message = "🆕 <b>Recently Added Resources</b>\n\n";
    const buttons = [];

    resources.forEach((resource, index) => {
      let title = escapeHtml(resource.fileName || resource.caption || "Untitled");
      if (title.length > 40) title = title.substring(0, 39) + "…";
      const channel = resource.channelUsername ? ` (@${escapeHtml(resource.channelUsername)})` : "";
      const type = (resource.fileType || "file").toUpperCase();

      message += `${index + 1}. 📄 <b>${title}</b>${channel}\n   Type: <b>${type}</b>\n\n`;

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
    console.error("Error in /recent command:", error);
    await ctx.reply("❌ An error occurred while loading recent resources.");
  }
}

module.exports = recentCommand;
