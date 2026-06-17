const userService = require("../../services/user.service");
const SavedResource = require("../../db/models/SavedResource");
const { sendPaginatedSaves } = require("../../telegram/fileDelivery");

async function savesCommand(ctx) {
  try {
    const user = await userService.findByTelegramId(ctx.from.id);
    if (!user) {
      return await ctx.reply("❌ User not found. Please use /start to initialize your account.");
    }

    const saves = await SavedResource.find({ userId: user._id }).sort({ savedAt: -1 });
    
    // We pass page 1 initially
    await sendPaginatedSaves(ctx, saves, 1);

  } catch (error) {
    console.error("Error in /saves command:", error);
    await ctx.reply("❌ An error occurred while fetching your saves.");
  }
}

module.exports = savesCommand;
