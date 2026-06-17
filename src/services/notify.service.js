function notifyAdmin(type, data) {
  try {
    const bot = require("../bot/index");
    const adminIds = process.env.ADMIN_ID ? process.env.ADMIN_ID.split(",") : [];
    if (adminIds.length === 0) return;

    let message = "";
    let buttons = null;

    switch (type) {
      case "NEW_USER":
        message = `👤 <b>New user:</b> @${data.username || data.firstName} (ID: ${data.telegramId}) from ${data.university || "Unknown"}, ${data.department || "Unknown"}`;
        break;
      case "CHANNEL_DEGRADED":
        message = `⚠️ <b>Channel @${data.channelUsername}</b> is DEGRADED (${data.failureCount} failures)`;
        break;
      case "CHANNEL_DEAD":
        message = `🔴 <b>Channel @${data.channelUsername}</b> is DEAD — consider removing`;
        break;
      case "CHANNEL_RECOMMENDATION":
        message = `📢 <b>New channel recommendation:</b> @${data.channelUsername}\nby @${data.userUsername || data.userId} | Type: ${data.type} | University: ${data.university}`;
        buttons = {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `approve_rec_${data.recId}` },
              { text: "❌ Reject", callback_data: `reject_rec_${data.recId}` }
            ]
          ]
        };
        break;
      case "DAILY_SUMMARY":
        message = `📊 <b>Daily Summary</b>\n\nTotal Users: ${data.totalUsers}\nTotal Resources: ${data.totalResources}\nSearches Today: ${data.searchesToday}\nDEAD Channels: ${data.deadChannels.length > 0 ? data.deadChannels.join(", ") : "None"}`;
        break;
      default:
        return;
    }

    for (const adminId of adminIds) {
      bot.telegram.sendMessage(adminId, message, {
        parse_mode: "HTML",
        reply_markup: buttons
      }).catch(err => console.error(`[NotifyAdmin] Failed to send to ${adminId}:`, err));
    }
  } catch (error) {
    console.error("[NotifyAdmin] Error:", error);
  }
}

module.exports = { notifyAdmin };
