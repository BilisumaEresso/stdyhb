const { search } = require("duck-duck-scrape");

const SEARCH_FILTERS = " pdf OR ppt OR notes OR exam";

/**
 * Detect resource type from URL and title
 */
function detectResourceType(url, title, snippet) {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  const snippetLower = (snippet || "").toLowerCase();
  const combined = `${titleLower} ${snippetLower}`;

  if (urlLower.includes(".pdf")) {
    return "pdf";
  } else if (urlLower.includes(".ppt") || urlLower.includes(".pptx")) {
    return "ppt";
  } else if (combined.includes("exam")) {
    return "exam";
  } else if (combined.includes("notes") || combined.includes("lecture")) {
    return "notes";
  }

  return "website";
}

/**
 * Calculate score for DuckDuckGo search result
 */
function calculateDuckDuckGoScore(url, title, snippet) {
  let score = 0;

  const combined = `${title} ${snippet}`.toLowerCase();

  // File type scoring
  if (url.toLowerCase().includes(".pdf")) {
    score += 5;
  }

  if (
    url.toLowerCase().includes(".ppt") ||
    url.toLowerCase().includes(".pptx")
  ) {
    score += 3;
  }

  // Content keyword scoring
  if (combined.includes("exam")) {
    score += 4;
  }

  if (combined.includes("notes")) {
    score += 2;
  }

  if (combined.includes("lecture")) {
    score += 2;
  }

  if (combined.includes("solved")) {
    score += 2;
  }

  if (combined.includes("solution")) {
    score += 1;
  }

  return score;
}

/**
 * Search DuckDuckGo for academic resources (No API key required!)
 */
async function searchDuckDuckGo(query) {
  try {
    console.log(`🔍 DuckDuckGo search starting for query: "${query}"`);

    // Build query with academic filters
    const enhancedQuery = query + SEARCH_FILTERS;
    console.log(`📝 Enhanced query: "${enhancedQuery}"`);

    // Perform DuckDuckGo search (no API key needed!)
    const results = await search(enhancedQuery, {
      safeSearch: "moderate",
    });

    console.log(`✅ DuckDuckGo returned ${results.length} items`);

    // Map results to standard format
    const mappedResults = results
      .map((item) => {
        const type = detectResourceType(item.url, item.title, item.description);
        const score = calculateDuckDuckGoScore(
          item.url,
          item.title,
          item.description || "",
        );

        return {
          title: item.title,
          url: item.url,
          source: "duckduckgo",
          type,
          score,
        };
      })
      .filter((result) => result.score > 0); // Filter out low-scoring results

    console.log(
      `✅ DuckDuckGo search found ${mappedResults.length} relevant results for: "${query}"`,
    );
    return mappedResults;
  } catch (error) {
    console.error("❌ Error searching DuckDuckGo:", error.message);
    // Return empty array on any error - don't crash pipeline
    return [];
  }
}

module.exports = { searchDuckDuckGo };
