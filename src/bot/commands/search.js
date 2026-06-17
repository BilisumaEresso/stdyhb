const userService = require("../../services/user.service");
const recordSearchService = require("../../services/search.service");
const orchestrationService = require("../../search/search.service");
const { sendPaginatedResults } = require("../../telegram/fileDelivery");



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
    const messageText = ctx.message.text;
    const query = messageText.split(" ").slice(1).join(" ").trim();
    if (!query) {
      return await ctx.reply("❌ Please provide a search term. Example: /search dbms exam");
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
    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(() => {});

    // Perform actual search (prioritizes Telegram resources)
    const results = await orchestrationService.searchResources(query, user);

    // Check if results contain Telegram resources
    const hasTelegramResults = results && results.length > 0 && results.some((r) => r._telegramResource);

    if (hasTelegramResults) {
      // Use file delivery system for Telegram results
      const queryHash = require("crypto").createHash('md5').update(query).digest('hex').substring(0, 8);
      await sendPaginatedResults(ctx, results, query, queryHash, 1);
    } else {
      // Use web results formatting
      const resultsMessage = formatWebResults(results);
      await ctx.reply(resultsMessage, {
        parse_mode: "Markdown",
      });
    }

    // Clear typing action
    await ctx.telegram.sendChatAction(ctx.chat.id, 'cancel').catch(() => {});
  } catch (error) {
    console.error("Error in performSearch:", error);
    await ctx.reply(
      "❌ An error occurred while processing your search. Please try again later.",
    );
  }
}

module.exports = { searchCommand, performSearch };
