const userService = require("../../services/user.service");

const WELCOME_MESSAGE = `🎓 Welcome to StudyHub!

Find:
📚 Past exams
📄 PDFs & handouts
📊 PPT slides
🎥 YouTube learning resources
💻 GitHub study materials

Try:
\`/search database systems\`
\`/search networking ppt\`
\`/search oop exam\``;

async function startCommand(ctx) {
  try {
    const telegramUser = ctx.from;

    // Get or create user in database
    await userService.getOrCreateUser(telegramUser);

    // Send welcome message
    await ctx.reply(WELCOME_MESSAGE, {
      parse_mode: "Markdown",
    });
  } catch (error) {
    console.error("Error in /start command:", error);
    await ctx.reply("❌ An error occurred. Please try again later.");
  }
}

module.exports = startCommand;
