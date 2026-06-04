const userService = require("../../services/user.service");
const recordSearchService = require("../../services/search.service");
const orchestrationService = require("../../search/search.service");
const { sendSearchResultsWithButtons } = require("../../telegram/fileDelivery");

const SEARCHING_MESSAGE = `🔍 Searching for: **{query}**

📚 Finding study resources...
⚙️ Aggregating from Telegram, Google...`;

/**
 * Format search results for web results
 */
function formatWebResults(results) {
  if (!results || results.length === 0) {
    return "❌ No results found. Try a different search term.";
  }

  let message = `✅ Found ${results.length} results:\n\n`;

  results.forEach((result, index) => {
    const typeEmoji = {
      pdf: "📄",
      ppt: "📊",
      exam: "📝",
      notes: "📓",
      video: "🎥",
      github: "💻",
      website: "🌐",
    }[result.type] || "📎";

    const title = result.title.length > 50 ? result.title.substring(0, 50) + "..." : result.title;

    message += `${index + 1}. ${typeEmoji} *${title}*\n`;
    message += `   [Link](${result.url})\n`;
    message += `   Type: ${result.type} | Score: ${result.score}\n\n`;
  });

  message += "_Reply with a number to save or get more info_";

  return message;
}

async function searchCommand(ctx) {
  try {
    // Extract query from message: "/search query here"
    const messageText = ctx.message.text;
    const query = messageText.split(" ").slice(1).join(" ").trim();

    // Validate query
    if (!query) {
      return await ctx.reply(
        "❌ Please provide a search term. Example: /search dbms exam",
      );
    }

    // Get user from database by telegramId
    const user = await userService.findByTelegramId(ctx.from.id);

    if (!user) {
      return await ctx.reply(
        "❌ User not found. Please use /start to initialize your account.",
      );
    }

    // Record search in database
    await recordSearchService.recordSearch(user._id, query);

    // Send searching message
    const searchingMsg = SEARCHING_MESSAGE.replace("{query}", query);
    const statusMessage = await ctx.reply(searchingMsg, {
      parse_mode: "Markdown",
    });

    // Perform actual search (prioritizes Telegram resources)
    const results = await orchestrationService.searchResources(query, user);

    // Check if results contain Telegram resources
    const hasTelegramResults = results.some((r) => r._telegramResource);

    if (hasTelegramResults) {
      // Use file delivery system for Telegram results
      await sendSearchResultsWithButtons(ctx, results);
    } else {
      // Use web results formatting
      const resultsMessage = formatWebResults(results);
      await ctx.reply(resultsMessage, {
        parse_mode: "Markdown",
      });
    }
  } catch (error) {
    console.error("Error in /search command:", error);
    await ctx.reply(
      "❌ An error occurred while processing your search. Please try again later.",
    );
  }
}

module.exports = searchCommand;
