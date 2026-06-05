const CachedSearch = require("../db/models/CachedSearch");
const TelegramResource = require("../db/models/TelegramResource");
const { searchWeb } = require("./providers/websearch");
const { searchGitHub } = require("./providers/github");
const { searchYouTube } = require("./providers/youtube");
const { expandQuery } = require("../config/subjectAliases");
const { correctTypos } = require("./typoCorrector");
const { deduplicateResources, getDuplicateStats } = require("./deduplicator");
const { groupExamImages } = require("./examGrouper");
const { parseIntent } = require("./intentParser");
const { scoreAndRankResources, getScoringStats } = require("./relevanceScorer");

// Search debugging logger
class SearchLogger {
  constructor() {
    this.logs = [];
  }

  log(key, value) {
    this.logs.push({ key, value });
  }

  print() {
    console.log("\n[SEARCH DEBUG]");
    for (const { key, value } of this.logs) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
  }
}

class SearchService {
  /**
   * Normalize query for consistency
   */
  normalizeQuery(query) {
    return query.toLowerCase().trim();
  }

  /**
   * Map TelegramResource fileType to CachedSearch type enum
   */
  mapFileTypeToResourceType(fileType) {
    const typeMap = {
      pdf: "pdf",
      ppt: "ppt",
      doc: "document",
      image: "notes",
      other: "other",
    };
    return typeMap[fileType] || "other";
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
    const combined = `${resource.title || ""} ${resource.caption || ""}`.toLowerCase();

    // Base score by file type
    if (resource.fileType === "pdf") {
      score = 100;
    } else if (resource.fileType === "ppt") {
      score = 90;
    } else if (resource.fileType === "doc") {
      score = 80;
    } else if (resource.fileType === "image") {
      score = 70;
    } else {
      score = 50;
    }

    // High priority keywords (+25 each)
    const highPriorityKeywords = [
      "exam",
      "final",
      "solution",
      "past paper",
      "mid",
      "midterm",
    ];
    highPriorityKeywords.forEach((kw) => {
      if (combined.includes(kw)) score += 25;
    });

    // Medium priority keywords (+10 each)
    const mediumPriorityKeywords = ["notes", "lecture", "tutorial"];
    mediumPriorityKeywords.forEach((kw) => {
      if (combined.includes(kw)) score += 10;
    });

    // Negative keywords (-15 each) - reduce non-exam content
    const negativeKeywords = [
      "project",
      "proposal",
      "management system",
      "software system",
    ];
    negativeKeywords.forEach((kw) => {
      if (combined.includes(kw)) score -= 15;
    });

    // Boost for exam flag (if detected)
    if (resource.isExam) {
      score += 50;
    }

    // Boost by popularity
    if (resource.downloadCount && resource.downloadCount > 0) {
      score += Math.min(resource.downloadCount * 2, 50);
    }

    return Math.max(0, score); // Don't go negative
  }

  /**
   * Search Telegram indexed resources with intelligence
   */
  async searchTelegramResources(query, logger = null) {
    try {
      console.log(`  📱 Searching Telegram resources...`);

      const results = await TelegramResource.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(20);

      if (results.length === 0) {
        console.log(`  📱 Telegram: No results found`);
        return [];
      }

      // Score and prioritize results
      const scoredResults = results.map((resource) => {
        const telegramScore = this.calculateTelegramScore(resource);
        return {
          title: resource.title || resource.fileName || "Unnamed",
          url: `https://t.me/${resource.channelUsername}/${resource.messageId}`,
          source: "telegram",
          type: this.mapFileTypeToResourceType(resource.fileType),
          score: telegramScore,
          fileId: resource.fileId,
          channelUsername: resource.channelUsername,
          isExam: resource.isExam,
          groupId: resource.groupId,
          caption: resource.caption,
          tags: resource.tags,
          downloadCount: resource.downloadCount,
          messageDate: resource.messageDate,
          fileName: resource.fileName,
          fileType: resource.fileType,
          _telegramResource: true,
          _id: resource._id,
        };
      });

      scoredResults.sort((a, b) => b.score - a.score);

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
      titleLower.includes(keyword),
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
    } else if (
      titleLower.includes("solved") ||
      titleLower.includes("solution")
    ) {
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
    } else if (
      titleLower.includes("lecture") ||
      titleLower.includes("tutorial")
    ) {
      score = 75;
    } else if (titleLower.includes("handout") || titleLower.includes("guide")) {
      score = 70;

      // 🥉 LOW PRIORITY (50-20): Videos, GitHub Repos
    } else if (type === "video") {
      score = 40;

      if (
        titleLower.includes("crash course") ||
        titleLower.includes("full course")
      ) {
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

    if (
      titleLower.includes("complete") ||
      titleLower.includes("comprehensive")
    ) {
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
        searchWeb(query).catch((err) => {
          console.error("❌ Web search error:", err.message);
          return [];
        }),
        searchGitHub(query).catch((err) => {
          console.error("❌ GitHub search error:", err.message);
          return [];
        }),
        searchYouTube(query).catch((err) => {
          console.error("❌ YouTube search error:", err.message);
          return [];
        }),
      ]);

      console.log(`🌐 WEB Results: ${webResults.length} items`);
      if (webResults.length > 0) {
        console.log(
          "  Sample:",
          webResults.slice(0, 2).map((r) => r.title),
        );
      }

      console.log(`🐙 GITHUB Results: ${gitHubResults.length} items`);
      if (gitHubResults.length > 0) {
        console.log(
          "  Sample:",
          gitHubResults.slice(0, 2).map((r) => r.title),
        );
      }

      console.log(`📺 YOUTUBE Results: ${youtubeResults.length} items`);
      if (youtubeResults.length > 0) {
        console.log(
          "  Sample:",
          youtubeResults.slice(0, 2).map((r) => r.title),
        );
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
   * Main search function with intelligence
   * Typo correction → Query expansion → Deduplication → Grouping
   */
  async searchResources(query, user) {
    try {
      const logger = new SearchLogger();
      
      // Original query
      const normalizedQuery = this.normalizeQuery(query);
      logger.log("Original", query);
      console.log(`\n🔎 SEARCH START - Original: "${query}"`);

      // Step 1: Typo correction
      const typoResult = correctTypos(normalizedQuery);
      const correctedQuery = typoResult.corrected;
      if (typoResult.hasCorrected) {
        logger.log("Typo corrected", correctedQuery);
        console.log(`  ✓ Typo correction: "${normalizedQuery}" → "${correctedQuery}"`);
      }

      // Step 2: Subject alias expansion
      const expanded = expandQuery(correctedQuery);
      logger.log("Expanded", expanded.expanded);
      if (expanded.appliedAliases.length > 0) {
        console.log(
          `  ✓ Aliases expanded: ${expanded.appliedAliases.join(", ")}`
        );
      }

      // Check cache with corrected query
      const cachedResults = await this.getCachedResults(correctedQuery);
      if (cachedResults) {
        console.log(
          `📦 Cache HIT (${cachedResults.resources.length} results)`
        );
        logger.log("Cache hit", true);
        return cachedResults.resources;
      }

      console.log(`💾 Cache MISS - fetching fresh results...`);
      logger.log("Cache hit", false);

      // Primary search with corrected & expanded query
      console.log(`\n📱 PHASE 1: Telegram search...`);
      let allResults = await this.searchTelegramResources(expanded.expanded);

      // Step 3: Search fallback strategy
      if (allResults.length === 0) {
        console.log(`\n⚠️  No results for expanded query, trying fallback...`);
        logger.log("Fallback used", "expanded_to_aliases");

        // Try alias search if we haven't already
        const aliasQuery = expanded.appliedAliases.join(" ");
        if (aliasQuery) {
          allResults = await this.searchTelegramResources(aliasQuery);
          if (allResults.length > 0) {
            console.log(`  ✓ Found ${allResults.length} results via aliases`);
          }
        }

        // Try partial keyword match
        if (allResults.length === 0 && correctedQuery !== normalizedQuery) {
          allResults = await this.searchTelegramResources(normalizedQuery);
          if (allResults.length > 0) {
            console.log(
              `  ✓ Found ${allResults.length} results (original query)`
            );
          }
        }

        // Finally, try web search
        if (allResults.length === 0) {
          console.log(`\n🌐 PHASE 2: Web search fallback...`);
          logger.log("Fallback used", "web_search");
          const webResults = await this.searchAllSources(correctedQuery);
          allResults = webResults.map((result) => ({
            ...result,
            score: this.calculateScore(result.title, result.type, result.source),
          }));
        }
      } else {
        console.log(`✅ Telegram results found (${allResults.length})`);
      }

      // Step 4: Deduplication with intelligent grouping
      console.log(`\n📊 Deduplicating results...`);
      const beforeDedup = allResults.length;
      
      // Separate telegram and non-telegram results for proper deduplication
      const telegramResults = allResults.filter((r) => r._telegramResource);
      const nonTelegramResults = allResults.filter((r) => !r._telegramResource);

      // Deduplicate telegram resources
      const deduplicatedTelegram = deduplicateResources(telegramResults);
      const stats = getDuplicateStats(telegramResults.length, deduplicatedTelegram);
      if (stats.removed > 0) {
        logger.log("Duplicates removed", stats.removed);
        console.log(`  Removed ${stats.removed} duplicates`);
      }

      // Combine and sort
      allResults = [...deduplicatedTelegram, ...nonTelegramResults];
      allResults.sort((a, b) => b.score - a.score);

      // STEP: Intent-aware relevance filtering
      console.log(`\n🧠 Intent-aware filtering...`);
      const intent = parseIntent(query);
      logger.log("Parsed intent", {
        subject: intent.subject,
        resourceType: intent.resourceType,
        department: intent.department,
        isExam: intent.isExam,
      });

      if (intent.subject || intent.resourceType) {
        console.log(`  Subject: ${intent.subject || "any"}`);
        console.log(`  Type: ${intent.resourceType || "any"}`);
        console.log(`  Department: ${intent.department || "any"}`);

        const beforeIntentFilter = allResults.length;
        const scoredResults = scoreAndRankResources(allResults, intent);
        const intentStats = getScoringStats(allResults, scoredResults);

        console.log(
          `  Filtered: ${intentStats.before} → ${intentStats.after} (removed ${intentStats.filtered})`
        );
        if (intentStats.topScore > 0) {
          console.log(`  Top score: ${intentStats.topScore}`);
        }
        logger.log("Intent filtered", `${intentStats.before} → ${intentStats.after}`);
        logger.log("Intent stats", intentStats);

        allResults = scoredResults;
      }

      // Step 5: Smart image grouping
      if (telegramResults.length > 0) {
        console.log(`\n📸 Grouping exam images...`);
        const imageResults = allResults.filter((r) => r.fileType === "image");
        if (imageResults.length > 1) {
          const grouped = groupExamImages(allResults);
          console.log(`  Grouped into ${grouped.length} result sets`);
          allResults = grouped;
        }
      }

      // Return top 10
      const topResults = allResults.slice(0, 10);
      console.log(
        `\n✨ FINAL: ${topResults.length} results | ${beforeDedup} → ${topResults.length}`
      );
      if (topResults.length > 0) {
        console.log(`   Sources: ${topResults.map((r) => r.source).join(", ")}\n`);
      }

      logger.log("Results returned", topResults.length);
      logger.print();

      // Cache results (non-blocking)
      this.cacheResults(query, correctedQuery, topResults).catch((err) => {
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
