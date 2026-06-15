const CachedSearch = require("../db/models/CachedSearch");
const TelegramResource = require("../db/models/TelegramResource");
const { searchGitHub } = require("./providers/github");
const { expandQuery } = require("../config/subjectAliases");
const { correctTypos } = require("./typoCorrector");
const { groupExamImages } = require("./examGrouper");

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
   * Calculate priority score for Telegram resources based on textScore, tags, and type
   */
  calculateTelegramScore(resource, query, textScore) {
    let score = (textScore || 0) * 10; // Base score from MongoDB text index

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    // Tag intersection boost
    if (resource.tags && resource.tags.length > 0) {
      const intersection = resource.tags.filter(tag => queryWords.includes(tag.toLowerCase()));
      score += intersection.length * 15; // +15 per matching tag
    }

    // Boost for exam flag (if detected)
    if (resource.isExam) {
      score += 50;
    }

    // Boost by popularity
    if (resource.downloadCount && resource.downloadCount > 0) {
      score += Math.min(resource.downloadCount * 2, 50);
    }

    // Base score by file type
    if (resource.fileType === "pdf") {
      score += 30;
    } else if (resource.fileType === "ppt") {
      score += 20;
    } else if (resource.fileType === "doc") {
      score += 15;
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
        { $text: { $search: query }, isAvailable: { $ne: false } },
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
        const textScore = resource.get('score');
        const telegramScore = this.calculateTelegramScore(resource, query, textScore);
        
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

      const topResults = scoredResults.slice(0, 10);
      console.log(`  ✅ Telegram: ${topResults.length} qualified results`);
      if (topResults.length > 0) {
        console.log(`     Top: "${topResults[0].title}" (score: ${topResults[0].score})`);
      }

      return topResults;
    } catch (error) {
      console.error(`  ❌ Telegram search error: ${error.message}`);
      return [];
    }
  }

  /**
   * Calculate score based on title and type for GitHub fallback
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
    ];

    const isExcluded = exclusionKeywords.some((keyword) =>
      titleLower.includes(keyword),
    );
    if (isExcluded && !titleLower.includes("dbms")) {
      return 0; // Exclude non-academic content
    }

    if (type === "github") {
      score = 30;

      if (titleLower.includes("university")) {
        score = 40;
      }
    } else {
      score = 20;
    }

    return Math.max(0, score);
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
   */
  async searchResources(query, user) {
    try {
      const logger = new SearchLogger();
      
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
        }

        // Try partial keyword match
        if (allResults.length === 0 && correctedQuery !== normalizedQuery) {
          allResults = await this.searchTelegramResources(normalizedQuery);
        }
      }
      
      // Finally, try GitHub search if less than 3 results from Telegram
      if (allResults.length < 3) {
        console.log(`\n🐙 PHASE 2: GitHub search fallback...`);
        logger.log("Fallback used", "github_search");
        const gitHubResults = await searchGitHub(correctedQuery).catch(err => []);
        
        const scoredGitHub = gitHubResults.map((result) => ({
          ...result,
          score: this.calculateScore(result.title, result.type, result.source),
        }));
        
        allResults = [...allResults, ...scoredGitHub];
      } else {
        console.log(`✅ Telegram results found (${allResults.length})`);
      }

      // Combine Telegram and fallback results
      allResults.sort((a, b) => b.score - a.score);

      const telegramResults = allResults.filter((r) => r._telegramResource);
      // Step 4: Smart image grouping
      if (telegramResults.length > 0) {
        console.log(`\n📸 Grouping exam images...`);
        const imageResults = allResults.filter((r) => r.fileType === "image");
        if (imageResults.length > 1) {
          const grouped = groupExamImages(allResults);
          console.log(`  Grouped into ${grouped.length} result sets`);
          allResults = grouped;
        }
      }

      // Return top 8
      const topResults = allResults.slice(0, 8);
      console.log(
        `\n✨ FINAL: ${topResults.length} results`
      );

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
