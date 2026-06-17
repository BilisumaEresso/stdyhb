const { Scenes, Markup } = require("telegraf");
const ChannelRecommendation = require("../../db/models/ChannelRecommendation");
const TelegramChannel = require("../../db/models/TelegramChannel");
const userService = require("../../services/user.service");
const { notifyAdmin } = require("../../services/notify.service");

const recommendWizard = new Scenes.WizardScene(
  "recommendChannel",
  // Step 1: Channel Username
  async (ctx) => {
    await ctx.reply("📢 Know a good resource channel? Share it with us!\n\nSend the channel username (e.g. @channelname):");
    return ctx.wizard.next();
  },
  // Step 2: Resource Type
  async (ctx) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply("Please send a valid text username.");
      return;
    }
    let username = ctx.message.text.trim().replace("@", "").toLowerCase();
    if (username.startsWith("https://t.me/")) username = username.replace("https://t.me/", "");
    
    // Check duplicates
    const existingRec = await ChannelRecommendation.findOne({ channelUsername: username, status: "pending" });
    const existingChan = await TelegramChannel.findOne({ username });
    
    if (existingRec || existingChan) {
      await ctx.reply(`⚠️ The channel @${username} has already been recommended or is already active in our system! Thanks anyway!`);
      return ctx.scene.leave();
    }

    ctx.session.recUsername = username;

    await ctx.reply(
      "What kind of resources does it have?",
      Markup.inlineKeyboard([
        [Markup.button.callback("Exams", "rectype_Exams"), Markup.button.callback("Lecture Notes", "rectype_Lecture Notes")],
        [Markup.button.callback("Both", "rectype_Both"), Markup.button.callback("Other", "rectype_Other")]
      ])
    );
    return ctx.wizard.next();
  },
  // Step 3: University
  async (ctx) => {
    if (ctx.updateType === "callback_query" && ctx.match && ctx.match[0].startsWith("rectype_")) {
      ctx.session.recType = ctx.match[0].replace("rectype_", "");
      await ctx.answerCbQuery();
    } else {
      ctx.session.recType = "Other";
    }

    await ctx.reply(
      "Which university is it for?",
      Markup.inlineKeyboard([
        [Markup.button.callback("All Universities", "recuni_All Universities")],
        [Markup.button.callback("ASTU", "recuni_ASTU"), Markup.button.callback("AAU", "recuni_AAU"), Markup.button.callback("JU", "recuni_JU")],
        [Markup.button.callback("Gondar", "recuni_Gondar"), Markup.button.callback("Haramaya", "recuni_Haramaya"), Markup.button.callback("Bahir Dar", "recuni_Bahir_Dar")],
        [Markup.button.callback("Jimma", "recuni_Jimma"), Markup.button.callback("Hawassa", "recuni_Hawassa"), Markup.button.callback("Mekelle", "recuni_Mekelle")],
        [Markup.button.callback("Other / Not listed", "recuni_Other")]
      ])
    );
    return ctx.wizard.next();
  },
  // Final Step: Save & Notify
  async (ctx) => {
    if (ctx.updateType === "callback_query" && ctx.match && ctx.match[0].startsWith("recuni_")) {
      ctx.session.recUni = ctx.match[0].replace("recuni_", "").replace(/_/g, " ");
      await ctx.answerCbQuery();
    } else {
      ctx.session.recUni = "Other";
    }

    try {
      const user = await userService.findByTelegramId(ctx.from.id);
      
      const rec = new ChannelRecommendation({
        channelUsername: ctx.session.recUsername,
        type: ctx.session.recType,
        university: ctx.session.recUni,
        recommendedBy: user._id
      });
      await rec.save();

      notifyAdmin("CHANNEL_RECOMMENDATION", {
        channelUsername: ctx.session.recUsername,
        userUsername: user.username,
        userId: user.telegramId,
        type: ctx.session.recType,
        university: ctx.session.recUni,
        recId: rec._id.toString()
      });

      await ctx.reply(`✅ Thank you! Your recommendation for @${ctx.session.recUsername} has been submitted for review.`);
    } catch (error) {
      console.error("Error saving channel recommendation:", error);
      await ctx.reply("❌ There was an error submitting your recommendation. Please try again later.");
    }

    return ctx.scene.leave();
  }
);

recommendWizard.action(/rectype_.*/, async (ctx, next) => {
    if (ctx.wizard.cursor === 2) return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    return next();
});
recommendWizard.action(/recuni_.*/, async (ctx, next) => {
    if (ctx.wizard.cursor === 3) return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    return next();
});

module.exports = recommendWizard;
