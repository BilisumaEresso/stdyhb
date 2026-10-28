const crypto = require("crypto");
const { Markup } = require("telegraf");
const userService = require("../../services/user.service");
const recordSearchService = require("../../services/search.service");
const orchestrationService = require("../../search/search.service");
const { sendPaginatedResults } = require("../../telegram/fileDelivery");
const templates = require("../../telegram/templates");
const QuerySession = require("../../db/models/QuerySession");

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Format search results for web results
 */
function formatWebResults(results) {
  if (!results || results.length === 0) {
    return "❌ No results found. Try a different search term.";
  }

  let message = `✅ <b>Found ${results.length} web/external results:</b>\n\n`;

  results.forEach((result, index) => {
    const typeEmoji =
      {
        pdf: "📄",
        ppt: "📊",
        exam: "📝",
        notes: "📓",
        video: "🎥",
        github: "💻",
        website: "🌐",
      }[result.type] || "📎";

    const title = escapeHtml(
      result.title.length > 50
        ? result.title.substring(0, 50) + "..."
        : result.title,
    );

    message += `${index + 1}. ${typeEmoji} <b>${title}</b>\n`;
    message += `   🔗 <a href="${result.url}">Open Link</a>\n`;
    message += `   Type: ${escapeHtml(result.type)} | Score: ${result.score}\n\n`;
  });

  return message;
}

async function prepareQueryItems(queries = []) {
  const items = [];
  for (const q of queries) {
    if (!q || typeof q !== "string") continue;
    const trimmed = q.trim();
    if (!trimmed) continue;
    const hash = crypto
      .createHash("md5")
      .update(trimmed)
      .digest("hex")
      .substring(0, 8);

    await QuerySession.findOneAndUpdate(
      { queryHash: hash },
      { queryHash: hash, query: trimmed },
      { upsert: true }
    );
    items.push({ query: trimmed, hash });
  }
  return items;
}

async function showSearchScreen(ctx, isEdit = false) {
  try {
    const user = await userService.findByTelegramId(ctx.from.id);
    let recentSearches = [];
    if (user && user._id) {
      recentSearches = await recordSearchService.getUserRecentSearches(
        user._id,
        4
      );
    }
    const globalSuggestions = await recordSearchService.getGlobalSuggestions(4);

    const recentItems = await prepareQueryItems(recentSearches);
    const suggestionItems = await prepareQueryItems(globalSuggestions);

    const { text, keyboard } = templates.renderSearchPrompt(
      recentItems,
      suggestionItems
    );
    const replyMarkup = Markup.inlineKeyboard(keyboard).reply_markup;

    if (isEdit && ctx.updateType === "callback_query") {
      await ctx
        .editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: replyMarkup,
        })
        .catch(() => {});
    } else {
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
    }
  } catch (error) {
    console.error("Error in showSearchScreen:", error);
    await ctx.reply(
      "Type anything to search — e.g. 'dbms exam' or 'networking notes'"
    );
  }
}

async function searchCommand(ctx) {
  try {
    const messageText = ctx.message.text;
    const query = messageText.split(" ").slice(1).join(" ").trim();
    if (!query) {
      return await showSearchScreen(ctx);
    }
    await performSearch(ctx, query);
  } catch (error) {
    console.error("Error in /search command:", error);
    await ctx.reply("❌ An error occurred. Please try again later.");
  }
}

async function performSearch(ctx, query) {
  try {
    const user = await userService.findByTelegramId(ctx.from.id);

    if (!user) {
      return await ctx.reply(
        "❌ User not found. Please use /start to initialize your account.",
      );
    }

    // Record search in database
    await recordSearchService.recordSearch(user._id, query);

    // Send typing chat action
    await ctx.telegram.sendChatAction(ctx.chat.id, "typing").catch(() => {});

    // Perform actual search (prioritizes Telegram resources)
    const results = await orchestrationService.searchResources(query, user);

    // Check if results contain Telegram resources
    const hasTelegramResults =
      results && results.length > 0 && results.some((r) => r._telegramResource);

    const queryHash = crypto
      .createHash("md5")
      .update(query)
      .digest("hex")
      .substring(0, 8);

    if (!results || results.length === 0) {
      await sendPaginatedResults(ctx, [], query, queryHash, 1, "all", user);
    } else if (hasTelegramResults) {
      await sendPaginatedResults(ctx, results, query, queryHash, 1, "all", user);
    } else {
      // Use web results formatting
      const resultsMessage = formatWebResults(results);
      await ctx.reply(resultsMessage, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    }

    // Clear typing action
    await ctx.telegram.sendChatAction(ctx.chat.id, "cancel").catch(() => {});
  } catch (error) {
    console.error("Error in performSearch:", error);
    await ctx.reply(
      "❌ An error occurred while processing your search. Please try again later.",
    );
  }
}

function registerSearchHandlers(bot) {
  bot.action(/qsearch_([a-f0-9]+)/, async (ctx) => {
    const hash = ctx.match[1];
    const session = await QuerySession.findOne({ queryHash: hash });
    if (!session || !session.query) {
      return await ctx.answerCbQuery(
        "❌ Search expired. Please type your query.",
        { show_alert: true }
      );
    }
    await ctx.answerCbQuery(`Searching for "${session.query}"...`);
    await performSearch(ctx, session.query);
  });

  bot.action("clear_search_history", async (ctx) => {
    const user = await userService.findByTelegramId(ctx.from.id);
    if (user && user._id) {
      await recordSearchService.clearUserSearchHistory(user._id);
    }
    await ctx.answerCbQuery("🗑️ Search history cleared.", {
      show_alert: false,
    });
    await showSearchScreen(ctx, true);
  });
}

module.exports = {
  searchCommand,
  performSearch,
  showSearchScreen,
  registerSearchHandlers,
};
