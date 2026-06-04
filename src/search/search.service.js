const CachedSearch = require("../db/models/CachedSearch");
const TelegramResource = require("../db/models/TelegramResource");
const { searchWeb } = require("./providers/websearch");
const { searchGitHub } = require("./providers/github");
const { searchYouTube } = require("./providers/youtube");

class SearchService {
  /**
   * Normalize query for consistency
   */
  normalizeQuery(query) {
    return query.toLowerCase().trim();
  }

  /**
   * Check if cached results exist and are not expired
   */
  async getCachedResults(normalizedQuery) {
    try {
      const cached = await CachedSearch.findOne({
        normalizedQuery,
        expiresAt: { $gt: new Date() },
      });

      return cached;
    } catch (error) {
      console.error("Error fetching cached search:", error);
      return null;
    }
  }

  /**
   * Calculate priority score for Telegram resources
   */
  calculateTelegramScore(resource) {
    let score = 0;

    // Base score by file type
    if (resource.fileType === "pdf") {
      score = 100;
    } else if (resource.fileType === "ppt") {
      score = 90;
    } else if (resource.fileType === "image") {
      score = 70; // Lower for individual images, grouped sets handled separately
    } else if (resource.fileType === "doc") {
      score = 80;
    } else {
      score = 50;
    }

    // Boost for exam content (highest priority)
    if (resource.isExam) {
      score += 50;
    }

    // Additional keyword boost
    const combined = `${resource.title || ""} ${resource.caption || ""}`.toLowerCase();
    if (combined.includes("final") || combined.includes("solution")) {
      score += 20;
    } else if (combined.includes("mid")) {
      score += 15;
    }

    return score;
  }

  /**
   * Search Telegram indexed resources first
   */
  async searchTelegramResources(query) {
    try {
      console.log(`  📱 Searching Telegram resources...`);

      // Text search on caption, fileName, tags
      const results = await TelegramResource.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(20); // Get more, will filter down to 10

      if (results.length === 0) {
        console.log(`  📱 Telegram: No results found`);
        return [];
      }

      // Score and prioritize results
      const scoredResults = results.map((resource) => {
        const telegramScore = this.calculateTelegramScore(resource);
        return {
          title: resource.title || resource.fileName || "Unnamed",
          url: `https://t.me/${resource.channelUsername}/${resource.messageId}`, // Telegram link
          source: "telegram",
          type: resource.fileType,
          score: telegramScore,
          fileId: resource.fileId,
          channelUsername: resource.channelUsername,
          isExam: resource.isExam,
          groupId: resource.groupId,
          caption: resource.caption,
          tags: resource.tags,
          _telegramResource: true,
        };
      });

      // Sort by score descending
      scoredResults.sort((a, b) => b.score - a.score);

      // Return top 10 Telegram results
      const top10 = scoredResults.slice(0, 10);
      console.log(`  ✅ Telegram: ${top10.length} qualified results`);
      if (top10.length > 0) {
        console.log(`     Top: "${top10[0].title}" (score: ${top10[0].score})`);
      }

      return top10;
    } catch (error) {
      console.error(`  ❌ Telegram search error: ${error.message}`);
      return [];
    }
  }

  /**
   * Calculate score based on title and type
   * Priority: PDF/Exams > Notes/PPT > Videos > GitHub > Websites
   */
  calculateScore(title, type, source) {
    let score = 0;
    const titleLower = title.toLowerCase();

    // ❌ EXCLUDE non-academic content
    const exclusionKeywords = [
      "software",
      "project",
      "application",
      "system",
      "app",
      "framework",
      "library",
      "api",
      "database system",
      "management system",
      "operating system",
    ];

    const isExcluded = exclusionKeywords.some((keyword) =>
      titleLower.includes(keyword)
    );
    if (isExcluded && !titleLower.includes("dbms")) {
      return 0; // Exclude non-academic content
    }

    // 🥇 HIGHEST PRIORITY (100-80): PDFs, Exams, Past Papers, Solved Questions
    if (type === "pdf") {
      score = 100;

      if (titleLower.includes("exam") || titleLower.includes("past paper")) {
        score = 110; // Even higher for exam PDFs
      }
    } else if (type === "exam") {
      score = 100;

      if (titleLower.includes("solution") || titleLower.includes("solved")) {
        score = 115; // Highest for solved exams
      }
    } else if (titleLower.includes("past paper")) {
      score = 105;
    } else if (titleLower.includes("solved") || titleLower.includes("solution")) {
      score = 100;

      // 🥈 MEDIUM PRIORITY (80-50): Notes, PPTs, Lectures, Tutorials
    } else if (type === "ppt") {
      score = 85;

      if (titleLower.includes("lecture") || titleLower.includes("slide")) {
        score = 90;
      }
    } else if (type === "notes") {
      score = 80;

      if (titleLower.includes("lecture") || titleLower.includes("complete")) {
        score = 85;
      }
    } else if (titleLower.includes("lecture") || titleLower.includes("tutorial")) {
      score = 75;
    } else if (titleLower.includes("handout") || titleLower.includes("guide")) {
      score = 70;

      // 🥉 LOW PRIORITY (50-20): Videos, GitHub Repos
    } else if (type === "video") {
      score = 40;

      if (titleLower.includes("crash course") || titleLower.includes("full course")) {
        score = 50;
      }
    } else if (type === "github") {
      score = 30;

      if (titleLower.includes("university")) {
        score = 40;
      }
    } else {
      // Generic website result
      score = 20;
    }

    // Additional keyword boosts (small increments)
    if (titleLower.includes("final")) {
      score += 15;
    } else if (titleLower.includes("mid")) {
      score += 10;
    }

    if (titleLower.includes("complete") || titleLower.includes("comprehensive")) {
      score += 5;
    }

    if (titleLower.includes("official")) {
      score += 10;
    }

    return Math.max(0, score); // Ensure score is not negative
  }

  /**
   * Search all sources: Web, GitHub, YouTube (No API keys!)
   */
  async searchAllSources(query) {
    try {
      console.log(`⏳ Searching multiple sources for: "${query}"`);

      const [webResults, gitHubResults, youtubeResults] = await Promise.all([
        searchWeb(query).catch(err => {
          console.error("❌ Web search error:", err.message);
          return [];
        }),
        searchGitHub(query).catch(err => {
          console.error("❌ GitHub search error:", err.message);
          return [];
        }),
        searchYouTube(query).catch(err => {
          console.error("❌ YouTube search error:", err.message);
          return [];
        }),
      ]);

      console.log(`🌐 WEB Results: ${webResults.length} items`);
      if (webResults.length > 0) {
        console.log("  Sample:", webResults.slice(0, 2).map(r => r.title));
      }

      console.log(`🐙 GITHUB Results: ${gitHubResults.length} items`);
      if (gitHubResults.length > 0) {
        console.log("  Sample:", gitHubResults.slice(0, 2).map(r => r.title));
      }

      console.log(`📺 YOUTUBE Results: ${youtubeResults.length} items`);
      if (youtubeResults.length > 0) {
        console.log("  Sample:", youtubeResults.slice(0, 2).map(r => r.title));
      }

      const merged = [...webResults, ...gitHubResults, ...youtubeResults];
      console.log(`✅ MERGED: ${merged.length} total results before dedup`);

      return merged;
    } catch (error) {
      console.error("Error searching all sources:", error);
      return [];
    }
  }

  /**
   * Save results to cache with 24h expiration
   */
  async cacheResults(query, normalizedQuery, resources) {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const cachedSearch = new CachedSearch({
        query,
        normalizedQuery,
        resources,
        expiresAt,
      });

      return await cachedSearch.save();
    } catch (error) {
      console.error("Error caching search results:", error);
      // Don't throw - caching failure shouldn't break search
      return null;
    }
  }

  /**
   * Remove duplicate URLs, keeping highest score
   */
  deduplicateResults(results) {
    const seen = new Map();

    results.forEach((result) => {
      const normalized = result.url.toLowerCase().replace(/\/$/, "");

      if (seen.has(normalized)) {
        const existing = seen.get(normalized);
        if (result.score > existing.score) {
          seen.set(normalized, result);
        }
      } else {
        seen.set(normalized, result);
      }
    });

    return Array.from(seen.values());
  }

  /**
   * Main search function
   * Orchestrates search: TELEGRAM first, then fallback to Web/GitHub/YouTube
   */
  async searchResources(query, user) {
    try {
      // Normalize query
      const normalizedQuery = this.normalizeQuery(query);
      console.log(`\n🔎 SEARCH START - Original: "${query}" | Normalized: "${normalizedQuery}"`);

      // Check cache first
      const cachedResults = await this.getCachedResults(normalizedQuery);

      if (cachedResults) {
        console.log(`📦 Cache hit for query: ${query} (${cachedResults.resources.length} cached results)`);
        return cachedResults.resources;
      }

      console.log(`💾 Cache MISS - fetching fresh results...`);

      // 🥇 PRIORITY 1: Search Telegram resources first
      console.log(`\n📱 PHASE 1: Searching Telegram resources...`);
      let allResults = await this.searchTelegramResources(normalizedQuery);

      // 🥈 FALLBACK: If no Telegram results, search web/GitHub/YouTube
      if (allResults.length === 0) {
        console.log(`\n🌐 PHASE 2: No Telegram results, falling back to web search...`);
        const webResults = await this.searchAllSources(normalizedQuery);

        // Score web/GitHub/YouTube results
        allResults = webResults.map((result) => ({
          ...result,
          score: this.calculateScore(result.title, result.type, result.source),
        }));

        console.log(`📊 Web search returned: ${allResults.length} results`);
      } else {
        console.log(`✅ Using ${allResults.length} Telegram results (PRIORITY)`);
      }

      console.log(`\n📊 BEFORE DEDUP: ${allResults.length} results`);

      // Remove duplicates
      const beforeDedup = allResults.length;
      allResults = this.deduplicateResults(allResults);
      console.log(`🔗 AFTER DEDUP: ${beforeDedup} → ${allResults.length} unique results`);

      // Sort by score descending
      allResults.sort((a, b) => b.score - a.score);

      // Return top 10
      const topResults = allResults.slice(0, 10);

      console.log(`✨ FINAL: ${topResults.length} results returned`);
      if (topResults.length > 0) {
        console.log(
          `   Sources: ${topResults.map((r) => r.source).join(", ")}\n`
        );
      }

      // Cache results asynchronously (don't wait)
      this.cacheResults(query, normalizedQuery, topResults).catch((err) => {
        console.error("Caching failed (non-blocking):", err);
      });

      return topResults;
    } catch (error) {
      console.error("Error in searchResources:", error);
      throw error;
    }
  }
}

module.exports = new SearchService();
