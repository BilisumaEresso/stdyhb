const CachedSearch = require("../db/models/CachedSearch");
const TelegramResource = require("../db/models/TelegramResource");
const { searchGitHub } = require("./providers/github");
const { expandQuery } = require("../config/subjectAliases");
const { correctTypos } = require("./typoCorrector");


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
   * Detect search intent from query
   */
  detectIntent(query) {
    const intent = {
      exam: false,
      notes: false,
      simple: false,
      assignmentLab: false,
      year: null,
    };

    if (/\b(mid|midterm|final|exam|exam paper|past paper|previous exam|test|quiz)\b/i.test(query)) {
      intent.exam = true;
    }
    if (/\b(note|notes|slide|slides|ppt|handout|lecture note|lecture notes|pdf)\b/i.test(query)) {
      intent.notes = true;
    }
    if (/\b(summary|short|easy|cheat sheet|quick review|revision|compact|brief)\b/i.test(query)) {
      intent.simple = true;
    }
    if (/\b(assignment|project|report|lab|lab manual|worksheet|practical|exercise|solution)\b/i.test(query)) {
      intent.assignmentLab = true;
    }

    const yearMatch = query.match(/\b(201\d|202\d)\b/);
    if (yearMatch) {
      intent.year = yearMatch[0];
    }

    return intent;
  }

  /**
   * Calculate priority score for Telegram resources based on textScore, tags, and type
   */
  calculateTelegramScore(resource, query, textScore, intent, user) {
    let score = (textScore || 0) * 10; // Base score from MongoDB text index

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    // Tag intersection boost
    if (resource.tags && resource.tags.length > 0) {
      const intersection = resource.tags.filter(tag => queryWords.includes(tag.toLowerCase()));
      score += intersection.length * 15; // +15 per matching tag
    }

    // Intent scoring
    if (intent.exam && resource.isExam) {
      score += 150; // Massively boost exams
    }

    if (intent.notes && (resource.fileType === "ppt" || resource.fileType === "doc" || resource.fileType === "pdf")) {
      score += 40;
    }

    if (intent.simple) {
      if (resource.tags && (resource.tags.includes("summary") || resource.tags.includes("short"))) score += 50;
    }

    if (intent.assignmentLab) {
      if (resource.tags && (resource.tags.includes("assignment") || resource.tags.includes("project") || resource.tags.includes("lab"))) score += 60;
    }

    if (intent.year) {
      if (resource.tags && resource.tags.includes(intent.year)) score += 100;
      else if (resource.messageDate && resource.messageDate.getFullYear().toString() === intent.year) score += 50;
    }

    // Personalization scoring
if (
  user &&
  user.university &&
  resource.university &&
  resource.university.toLowerCase() === user.university.toLowerCase()
) {
  score += 80; // Boost own university
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
  async searchTelegramResources(query, intent, user, logger = null, limit = 200) {
    try {
      console.log(`  📱 Searching Telegram resources...`);

      const results = await TelegramResource.find(
        { $text: { $search: query }, isAvailable: { $ne: false } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(limit);

      if (results.length === 0) {
        console.log(`  📱 Telegram: No results found`);
        return [];
      }

      // Score and prioritize results
      const scoredResults = results.map((resource) => {
        const textScore = resource.get('score');
        const telegramScore = this.calculateTelegramScore(resource, query, textScore, intent, user);

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

      const topResults = scoredResults.slice(0, 200);
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
    const startTimeMs = Date.now();
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

      const intent = this.detectIntent(normalizedQuery);
      logger.log("Intent", intent);

      // Kick off GitHub search in parallel so its timeout overlaps with Telegram searches
      const githubPromise = searchGitHub(correctedQuery).catch(err => []);

      // Primary search with corrected & expanded query
      console.log(`\n📱 PHASE 1: Primary Telegram search...`);
      let allResults = await this.searchTelegramResources(expanded.expanded, intent, user, logger, 200);

      const queryWords = normalizedQuery.split(/\s+/);
      if (allResults.length < 5 && queryWords.length >= 3) {
        console.log(`\n⚠️  Primary returned < 5 results. Triggering fallback fan-out...`);
        const fallbackQueries = new Set();
        let addedCount = 0;

        // Multi-word combinatorics - prioritize word-pairs first
        for (let i = 0; i < queryWords.length - 1 && addedCount < 5; i++) {
          const q = `${queryWords[i]} ${queryWords[i+1]}`;
          if (q !== expanded.expanded) {
            fallbackQueries.add(q);
            addedCount++;
          }
        }
        // Then individual words > 2 chars, up to 5 total fallbacks
        for (const w of queryWords) {
          if (addedCount >= 5) break;
          if (w.length > 2 && w !== expanded.expanded && !fallbackQueries.has(w)) {
            fallbackQueries.add(w);
            addedCount++;
          }
        }

        if (fallbackQueries.size > 0) {
          console.log(`Executing ${fallbackQueries.size} fallback searches concurrently...`);
          // Use smaller limit=50 for fallback queries
          const searchPromises = Array.from(fallbackQueries).map(q => this.searchTelegramResources(q, intent, user, logger, 50));
          const resultsArrays = await Promise.all(searchPromises);

          for (const resArray of resultsArrays) {
            allResults = allResults.concat(resArray);
          }
        }
      }

      // Deduplicate by _id, keeping highest score
      const dedupMap = new Map();
      for (const res of allResults) {
        const existing = dedupMap.get(res._id.toString());
        if (!existing || res.score > existing.score) {
          dedupMap.set(res._id.toString(), res);
        }
      }
      allResults = Array.from(dedupMap.values());

      // Step 3: Search fallback strategy
      if (allResults.length === 0) {
        console.log(`\n⚠️  No results for expanded query, trying fallback...`);
        logger.log("Fallback used", "expanded_to_aliases");

        // Try alias search if we haven't already
        const aliasQuery = expanded.appliedAliases.join(" ");
        if (aliasQuery) {
          const res = await this.searchTelegramResources(aliasQuery, intent, user, logger);
          allResults = allResults.concat(res);
        }

        // Try partial keyword match
        if (allResults.length === 0 && correctedQuery !== normalizedQuery) {
          const res = await this.searchTelegramResources(normalizedQuery, intent, user, logger);
          allResults = allResults.concat(res);
        }
      }

      // Finally, try GitHub search if less than 3 results from Telegram
      if (allResults.length < 0) {
        console.log(`\n🐙 PHASE 2: GitHub search fallback...`);
        logger.log("Fallback used", "github_search");
        // Await the promise we started at the top
        const gitHubResults = await githubPromise;

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
      // Step 4: Deduplicate and collapse DB-assigned groups
      if (telegramResults.length > 0) {
        console.log(`\n📸 Collapsing grouped images...`);
        const collapsed = [];
        const seenGroups = new Set();

        for (const r of allResults) {
          if (r.groupId && r.fileType === "image") {
             if (seenGroups.has(r.groupId)) continue;
             seenGroups.add(r.groupId);
             r._isGrouped = true;
             r.groupSize = r.groupTotal;
          }
          collapsed.push(r);
        }
        allResults = collapsed;
      }

      // Return top 200 for pagination
      const topResults = allResults.slice(0, 200);
      console.log(
        `\n✨ FINAL: ${topResults.length} results`
      );

      logger.log("Results returned", topResults.length);
      logger.print();

      // Cache results (non-blocking)
      this.cacheResults(query, correctedQuery, topResults).catch((err) => {
        console.error("Caching failed (non-blocking):", err);
      });

      const durationMs = Date.now() - startTimeMs;
      console.log(`⏱ Total search time: ${durationMs}ms`);

      return topResults;
    } catch (error) {
      console.error("Error in searchResources:", error);
      throw error;
    }
  }
}

module.exports = new SearchService();
