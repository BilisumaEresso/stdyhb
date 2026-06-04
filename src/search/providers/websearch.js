const { search } = require("duck-duck-scrape");

const SEARCH_FILTERS = " pdf OR ppt OR exam OR notes";

// Throttling: store last request time
let lastRequestTime = 0;
const THROTTLE_DELAY_MS = 1500; // 1.5 seconds between requests

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Apply throttling to prevent rate limiting
 */
async function applyThrottle() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < THROTTLE_DELAY_MS) {
    const delayNeeded = THROTTLE_DELAY_MS - timeSinceLastRequest;
    console.log(`  ⏳ Throttling: waiting ${delayNeeded}ms...`);
    await sleep(delayNeeded);
  }

  lastRequestTime = Date.now();
}

/**
 * Perform DuckDuckGo search with retry logic
 */
async function performSearch(enhancedQuery, retryCount = 0) {
  try {
    await applyThrottle();

    console.log(`  🔄 DuckDuckGo request (attempt ${retryCount + 1})...`);

    const results = await search(enhancedQuery);

    return results;
  } catch (error) {
    const isRateLimited =
      error.message?.includes("429") ||
      error.message?.includes("rate limit") ||
      error.message?.includes("blocked") ||
      error.message?.includes("timeout");

    if (isRateLimited && retryCount < 1) {
      console.log(`  ⚠️ Rate limited, retrying after 2 seconds...`);
      await sleep(2000);
      return performSearch(enhancedQuery, retryCount + 1);
    }

    throw error;
  }
}

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
  } else if (combined.includes("exam") || combined.includes("test")) {
    return "exam";
  } else if (combined.includes("notes") || combined.includes("lecture")) {
    return "notes";
  }

  return "website";
}

/**
 * Calculate score for web search result
 * Prioritizes PDFs, exams, and academic materials
 * Excludes software projects and general websites
 */
function calculateWebScore(url, title, snippet) {
  let score = 0;
  const combined = `${title} ${snippet}`.toLowerCase();

  // 🔍 EXCLUSION CHECK: Filter out non-academic content
  const exclusions = [
    "github.com",
    "npm package",
    "npm install",
    "source code",
    "open source",
    "software project",
  ];

  const shouldExclude = exclusions.some((keyword) =>
    combined.includes(keyword)
  );

  if (shouldExclude && !combined.includes("exam")) {
    return 0;
  }

  // 🥇 HIGHEST: PDF Files (especially exams/solutions)
  if (url.toLowerCase().includes(".pdf")) {
    score = 50;

    if (
      combined.includes("exam") ||
      combined.includes("past") ||
      combined.includes("solved")
    ) {
      score = 60;
    }

    if (combined.includes("solution")) {
      score = 65;
    }

    return score;
  }

  // 🥇 EXAMS & SOLVED QUESTIONS
  if (combined.includes("exam") || combined.includes("test")) {
    score = 40;

    if (combined.includes("solution") || combined.includes("solved")) {
      score = 50;
    }

    if (combined.includes("past")) {
      score = 45;
    }

    return score;
  }

  // 🥈 PPT/PRESENTATIONS
  if (url.toLowerCase().includes(".ppt") || url.toLowerCase().includes(".pptx")) {
    score = 35;

    if (combined.includes("lecture") || combined.includes("slide")) {
      score = 40;
    }

    return score;
  }

  // 🥈 NOTES & LECTURES
  if (combined.includes("notes") || combined.includes("lecture")) {
    score = 30;

    if (combined.includes("complete") || combined.includes("full")) {
      score = 35;
    }

    return score;
  }

  // 🥈 TUTORIALS & HANDOUTS
  if (combined.includes("tutorial") || combined.includes("handout")) {
    score = 25;
  }

  // Low score for general websites without clear academic indicators
  if (score === 0) {
    score = 5; // Very low score for generic sites
  }

  return Math.max(0, score);
}

/**
 * Search web using DuckDuckGo (Free, no API key, reliable)
 * Includes throttling and retry logic to prevent rate limiting
 */
async function searchWeb(query) {
  try {
    console.log(`  📝 Enhanced query: "${query}${SEARCH_FILTERS}"`);

    const enhancedQuery = query + SEARCH_FILTERS;

    let results;
    try {
      results = await performSearch(enhancedQuery);
    } catch (error) {
      console.error(`  ❌ Web search blocked/failed: ${error.message}`);
      console.log(`  📌 Returning empty results (will try other sources)`);
      return [];
    }

    console.log(`  📦 DuckDuckGo returned: ${results.length} raw items`);

    const mappedResults = results
      .map((item) => {
        const type = detectResourceType(item.url, item.title, item.description || "");
        const score = calculateWebScore(
          item.url,
          item.title,
          item.description || ""
        );

        return {
          title: item.title,
          url: item.url,
          source: "web",
          type,
          score,
        };
      })
      .filter((result) => result.score > 0);

    console.log(`  ✅ Web: ${mappedResults.length} qualified results (score > 0)`);
    if (mappedResults.length > 0) {
      console.log(`     Top result: "${mappedResults[0].title}" (score: ${mappedResults[0].score})`);
    }
    return mappedResults;
  } catch (error) {
    console.error(`  ❌ Web search error: ${error.message}`);
    return [];
  }
}

module.exports = { searchWeb };
