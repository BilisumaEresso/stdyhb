async function helpCommand(ctx) {
  const helpText = `📚 <b>StudyHub Bot Help</b>

Here are the commands you can use:

/start - Restart the bot and show the main menu
/search &lt;query&gt; - Search for study resources
/saves - View your saved resources
/profile - View and edit your profile info
/help - Show this help message

<i>You can also just type any subject or topic directly to search!</i>`;

  await ctx.reply(helpText, { parse_mode: "HTML" });
}

module.exports = helpCommand;
