const orchestrationService = require("../../search/search.service");
const userService = require("../../services/user.service");
const searchService = require("../../services/search.service");
const templates = require("../../telegram/templates");

/**
 * Handle incoming Telegram Inline Queries (@StudyHubBot <query>)
 */
async function handleInlineQuery(ctx) {
  try {
    const rawQuery = ctx.inlineQuery.query || "";
    const query = rawQuery.trim();
    const offset = parseInt(ctx.inlineQuery.offset || "0", 10) || 0;
    const PAGE_SIZE = 10;

    const botUsername =
      (ctx.botInfo && ctx.botInfo.username) ||
      process.env.BOT_USERNAME ||
      "StudyHubBot";

    // 1. Empty Query -> Show trending / popular topics as suggestion cards
    if (!query) {
      const suggestions = await searchService.getGlobalSuggestions(6);
      const results = suggestions.map((sug, idx) => ({
        type: "article",
        id: `sug_${idx}`,
        title: `💡 ${sug}`,
        description: `Tap to search materials for "${sug}"`,
        input_message_content: {
          message_text:
            `🔍 <b>Searching for:</b> <i>${templates.escapeHTML(sug)}</i>\n\n` +
            `Type <code>@${botUsername} ${templates.escapeHTML(sug)}</code> to browse exams & slides!`,
          parse_mode: "HTML",
        },
      }));

      return await ctx.answerInlineQuery(results, {
        cache_time: 120,
        is_personal: false,
      });
    }

    // 2. Active Query -> Search database
    const user = await userService.findByTelegramId(ctx.from.id);
    const searchResults = await orchestrationService.searchResources(query, user);

    if (!searchResults || searchResults.length === 0) {
      return await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "no_results",
            title: `❌ No materials found for "${query}"`,
            description: "Tap to see search tips and recommendations",
            input_message_content: {
              message_text: templates.renderNoResults(query),
              parse_mode: "HTML",
            },
          },
        ],
        { cache_time: 60, is_personal: false }
      );
    }

    const currentBatch = searchResults.slice(offset, offset + PAGE_SIZE);
    const nextOffset =
      offset + PAGE_SIZE < searchResults.length
        ? String(offset + PAGE_SIZE)
        : "";

    const inlineArticles = currentBatch.map((resource, index) => {
      const emoji = templates.getFileEmoji(
        resource.fileType,
        resource._isGrouped
      );
      const label = templates.getFileLabel(
        resource.fileType,
        resource._isGrouped
      );

      let title =
        resource.fileName || resource.title || resource.caption || "Study Material";
      if (title.length > 55) title = title.substring(0, 54) + "…";

      const descParts = [];
      if (resource.isExam) descParts.push("🎓 Exam");
      descParts.push(`📁 ${label}`);
      const sizeStr = templates.formatSize(resource.fileSize);
      if (sizeStr) descParts.push(`💾 ${sizeStr}`);
      if (resource.channelUsername) {
        descParts.push(`@${resource.channelUsername}`);
      }

      const cardText = resource._telegramResource
        ? templates.renderDetailCard(resource, user)
        : `💻 <b>${templates.escapeHTML(resource.title || "GitHub Repository")}</b>\n📌 Source: GitHub\n\n🔗 ${resource.url}`;

      const buttons = [];
      if (resource._telegramResource) {
        const actionPrefix = resource._isGrouped ? "grp" : "get";
        const dlUrl = `https://t.me/${botUsername}?start=${actionPrefix}_${resource._id.toString()}`;
        const buttonRow = [{ text: "📥 Get File via Bot", url: dlUrl }];

        if (resource.channelUsername && resource.messageId) {
          buttonRow.push({
            text: "🔗 View in Channel",
            url: `https://t.me/${resource.channelUsername}/${resource.messageId}`,
          });
        }
        buttons.push(buttonRow);
      } else if (resource.url) {
        buttons.push([{ text: "🔗 Open Link", url: resource.url }]);
      }

      return {
        type: "article",
        id: resource._id ? resource._id.toString() : `inline_${offset + index}`,
        title: `${emoji} ${title}`,
        description: descParts.join(" · "),
        input_message_content: {
          message_text: cardText,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        },
        reply_markup: {
          inline_keyboard: buttons,
        },
      };
    });

    await ctx.answerInlineQuery(inlineArticles, {
      cache_time: 300,
      is_personal: false,
      next_offset: nextOffset,
    });
  } catch (error) {
    console.error("Error in handleInlineQuery:", error);
    await ctx.answerInlineQuery([], { cache_time: 10, is_personal: false }).catch(() => {});
  }
}

module.exports = { handleInlineQuery };
