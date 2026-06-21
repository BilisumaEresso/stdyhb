const { Scenes, Markup } = require("telegraf");
const User = require("../../db/models/User");
const startCommand = require("../commands/start");const { getBot } = require("../botInstance");
const LABELS = require("../keyboardLabels");
const RESERVED_TEXTS = Object.values(LABELS);

function isEscapeText(ctx) {
  const text = ctx.message?.text?.trim();
  return !!text && (text.startsWith("/") || RESERVED_TEXTS.includes(text));
}

const onboardingWizard = new Scenes.WizardScene(
  "onboarding",
  // Step 1: University
  async (ctx) => {
    await ctx.reply(
      "🎓 Which university are you from?",
      Markup.inlineKeyboard([
        [Markup.button.callback("ASTU", "uni_ASTU"), Markup.button.callback("AAU", "uni_AAU"), Markup.button.callback("JU", "uni_JU")],
        [Markup.button.callback("Gondar", "uni_Gondar"), Markup.button.callback("Haramaya", "uni_Haramaya"), Markup.button.callback("Bahir Dar", "uni_Bahir_Dar")],
        [Markup.button.callback("Jimma", "uni_Jimma"), Markup.button.callback("Hawassa", "uni_Hawassa"), Markup.button.callback("Mekelle", "uni_Mekelle")],
        [Markup.button.callback("Other / Not listed", "uni_Other")]
      ])
    );
    return ctx.wizard.next();
  },
  // Step 2: Department
  async (ctx) => {
    if (ctx.updateType === "callback_query" && ctx.match && ctx.match[0].startsWith("uni_")) {
      ctx.session.university = ctx.match[0].replace("uni_", "").replace(/_/g, " ");
      await ctx.answerCbQuery();
    } else if (ctx.message && ctx.message.text) {
      ctx.session.university = ctx.message.text.trim();
    } else {
      ctx.session.university = "Other";
    }

    await ctx.reply(
      "📚 What is your department or field of study?\n(e.g. Software Engineering, Nursing, Law)\n\nType it or tap skip:",
      Markup.inlineKeyboard([
        [Markup.button.callback("⏭ Skip", "skip_dept")]
      ])
    );
    return ctx.wizard.next();
  },
  // Step 3: Year
  async (ctx) => {
    if (ctx.updateType === "callback_query" && ctx.match && ctx.match[0] === "skip_dept") {
      ctx.session.department = "";
      await ctx.answerCbQuery();
    } else if (ctx.message && ctx.message.text) {
      ctx.session.department = ctx.message.text.trim();
    } else {
      ctx.session.department = "";
    }

    await ctx.reply(
      "📅 What year are you in?",
      Markup.inlineKeyboard([
        [Markup.button.callback("1st Year", "year_1"), Markup.button.callback("2nd Year", "year_2"), Markup.button.callback("3rd Year", "year_3")],
        [Markup.button.callback("4th Year", "year_4"), Markup.button.callback("5th Year+", "year_5"), Markup.button.callback("Graduate", "year_grad")],
        [Markup.button.callback("⏭ Skip", "skip_year")]
      ])
    );
    return ctx.wizard.next();
  },
  // Final Step: Save
  async (ctx) => {
    let yearValue = null;
    if (ctx.updateType === "callback_query" && ctx.match) {
      const match = ctx.match[0];
      if (match.startsWith("year_")) {
        const val = match.replace("year_", "");
        if (val === "grad") yearValue = 6;
        else yearValue = parseInt(val, 10);
      }
      await ctx.answerCbQuery();
    } else if (ctx.message && ctx.message.text) {
      const parsed = parseInt(ctx.message.text.trim());
      if (!isNaN(parsed)) yearValue = parsed;
    }

    ctx.session.year = yearValue;

    try {
      await User.findOneAndUpdate(
        { telegramId: String(ctx.from.id) },
        {
          university: ctx.session.university || "",
          department: ctx.session.department || "",
          year: ctx.session.year
        }
      );

      await ctx.reply("✅ You're all set! Just type anything to search for resources.");

      // We also trigger the normal start command to ensure they see the persistent Reply Keyboard
      // The startCommand should now have a check to avoid re-triggering the wizard!
      await startCommand(ctx, true);
    } catch (error) {
      console.error("Error saving onboarding data:", error);
      await ctx.reply("❌ There was an error saving your profile, but you can still use the bot!");
    }

    return ctx.scene.leave();
  }
);

onboardingWizard.use(async (ctx, next) => {
  if (isEscapeText(ctx)) {
    await ctx.scene.leave();
    return getBot().handleUpdate(ctx.update);
  }
  return next();
});

// We need an action listener on the wizard to catch the callbacks cleanly
onboardingWizard.action(/uni_.*/, async (ctx, next) => {
    if (ctx.wizard.cursor === 1) return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    return next();
});
onboardingWizard.action("skip_dept", async (ctx, next) => {
    if (ctx.wizard.cursor === 2) return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    return next();
});
onboardingWizard.action(/year_.*/, async (ctx, next) => {
    if (ctx.wizard.cursor === 3) return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    return next();
});
onboardingWizard.action("skip_year", async (ctx, next) => {
    if (ctx.wizard.cursor === 3) return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    return next();
});

module.exports = onboardingWizard;
