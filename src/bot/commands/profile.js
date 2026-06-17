const userService = require("../../services/user.service");
const { Markup } = require("telegraf");

async function profileCommand(ctx) {
  try {
    const user = await userService.findByTelegramId(ctx.from.id);
    if (!user) {
      return await ctx.reply("❌ User not found. Please use /start to initialize your account.");
    }

    const uni = user.university || "Not set";
    const dept = user.department || "Not set";
    const year = user.year ? (user.year === 6 ? "Graduate" : `${user.year} Year`) : "Not set";

    const profileText = `👤 <b>Your Profile</b>

<b>Name:</b> ${user.firstName} ${user.lastName}
<b>University:</b> ${uni}
<b>Department:</b> ${dept}
<b>Year:</b> ${year}

🔍 <b>Total Searches:</b> ${user.searchCount}
`;

    await ctx.reply(profileText, {
      parse_mode: "HTML",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("✏️ Edit profile", "edit_profile")]
      ]).reply_markup
    });
  } catch (error) {
    console.error("Error in /profile command:", error);
    await ctx.reply("❌ An error occurred while fetching your profile.");
  }
}

module.exports = profileCommand;
