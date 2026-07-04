const { Markup } = require("telegraf");

async function helpCommand(ctx) {
  const helpText = `📚 <b>StudyHub — Your Academic Search Engine</b>

<b>🔍 HOW TO SEARCH</b>
Just type any subject, course, or topic. No commands needed.
<i>Examples: "dbms exam", "networking notes", "exit exam 2023"
Tip: Add "exam", "notes", or "pdf" to narrow results</i>

<b>📖 WHAT YOU'LL FIND</b>
📝 Past exams &amp; solved papers
📖 Lecture notes &amp; handouts
📊 PPT slides &amp; study guides
🖼️ Photo exam sets (common for Ethiopian university exams)
<i>Resources indexed from 30+ Ethiopian university channels</i>

<b>⚙️ COMMANDS</b>
/search &lt;topic&gt; — search directly
/saves — your saved resources
/profile — view/edit your profile
/trending — most downloaded this week
/recent — latest indexed resources
/start — return to main menu

<b>📢 RECOMMEND A CHANNEL</b>
Know a channel with study materials?
Tap "📢 Recommend Channel" or send us the @username or t.me link directly`;

  await ctx.reply(helpText, {
    parse_mode: "HTML",
    reply_markup: Markup.inlineKeyboard([
      [
        Markup.button.url(
          "📬 Contact Admin",
          process.env.ADMIN_TELEGRAM_URL || "https://t.me/+251938730818",
        ),
        Markup.button.callback("ℹ️ About StudyHub", "about_studyhub"),
      ],
    ]).reply_markup,
  });
}

module.exports = helpCommand;
