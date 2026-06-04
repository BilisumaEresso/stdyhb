const axios = require("axios");

const GOOGLE_API_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const ACADEMIC_FILTERS = " filetype:pdf OR filetype:ppt OR notes OR exam";

/**
 * Detect resource type from URL and title
 */
function detectResourceType(url, title) {
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();

  if (urlLower.includes(".pdf")) {
    return "pdf";
  } else if (urlLower.includes(".ppt") || urlLower.includes(".pptx")) {
    return "ppt";
  } else if (titleLower.includes("exam")) {
    return "exam";
  } else if (titleLower.includes("notes")) {
    return "notes";
  }

  return "website";
}

/**
 * Calculate score for Google search result
 */
function calculateGoogleScore(url, title, snippet) {
  let score = 0;

  // Check for file types in URL
  if (url.toLowerCase().includes(".pdf")) {
    score += 5;
  }

  if (
    url.toLowerCase().includes(".ppt") ||
    url.toLowerCase().includes(".pptx")
  ) {
    score += 3;
  }

  // Check for keywords in title and snippet
  const contentToCheck = `${title} ${snippet}`.toLowerCase();

  if (contentToCheck.includes("exam")) {
    score += 4;
  }

  if (contentToCheck.includes("notes")) {
    score += 3;
  }

  if (
    contentToCheck.includes("ppt") ||
    contentToCheck.includes("presentation")
  ) {
    score += 3;
  }

  if (contentToCheck.includes("solved")) {
    score += 2;
  }

  if (contentToCheck.includes("solution")) {
    score += 2;
  }

  return score;
}

/**
 * Search Google Custom Search API for academic resources
 */
async function searchGoogle(query) {
  try {
    // Validate API credentials
    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_CX) {
      console.warn(
        "⚠️  Google Search API credentials not configured. Skipping Google search.",
      );
      return [];
    }

    console.log(`🔍 Google search starting for query: "${query}"`);

    // Build query with academic filters
    const enhancedQuery = query + ACADEMIC_FILTERS;
    console.log(`📝 Enhanced query: "${enhancedQuery}"`);

    // Make API request
    const response = await axios.get(GOOGLE_API_ENDPOINT, {
      params: {
        key: process.env.GOOGLE_API_KEY,
        cx: process.env.GOOGLE_CX,
        q: enhancedQuery,
        num: 10, // Fetch up to 10 results
      },
      timeout: 5000, // 5 second timeout
    });

    console.log(`✅ Google API response status: ${response.status}`);

    // Parse results
    const items = response.data.items || [];
    console.log(`📦 Google returned ${items.length} items`);

    const results = items.map((item) => {
      const type = detectResourceType(item.link, item.title);
      const googleScore = calculateGoogleScore(
        item.link,
        item.title,
        item.snippet || ""
      );

      return {
        title: item.title,
        url: item.link,
        source: "google",
        type,
        score: googleScore,
      };
    });

    console.log(
      `✅ Google search found ${results.length} results for: "${query}"`
    );
    return results;
  } catch (error) {
    if (error.response?.status === 403) {
      console.error(
        "❌ Google Search API quota exceeded or access denied. Check credentials."
      );
    } else if (error.code === "ECONNABORTED") {
      console.error("❌ Google Search API request timeout");
    } else {
      console.error("❌ Error searching Google:", error.message);
    }

    // Return empty array on any error - don't crash pipeline
    return [];
  }
}

module.exports = { searchGoogle };
