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
   * Extract a clean, human-readable title from image captions
   */
  cleanCaptionTitle(caption) {
    if (!caption) return "Exam Material";
    const lines = caption
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        if (!line || line.startsWith("http") || line.startsWith("@")) return false;
        // Must contain at least some letters or numbers in any language
        return /[\p{L}\p{N}]/u.test(line);
      });

    if (lines.length === 0) return "Exam Material";

    let title = "";
    for (const l of lines) {
      let candidate = l
        .replace(/@\w+/g, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/#\w+/g, "")
        .replace(/[^\p{L}\p{N}\s\-()[\].,:'"]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (candidate.length >= 4) {
        title = candidate;
        break;
      }
    }

    if (!title && lines[0]) {
      title = lines[0].substring(0, 50).trim();
    }

    if (title.length > 55) title = title.substring(0, 54) + "…";
    return title || "Exam Material";
  }

  /**
   * Detect search intent from query
   */
  detectIntent(query) {
    const q = query.toLowerCase();
    const intent = {
      exam: false,
      ppt: false,
      pdf: false,
      doc: false,
      notes: false,
      simple: false,
      assignmentLab: false,
      year: null,
      explicitFormat: false,
    };

    if (/\b(ppt|pptx|slide|slides|powerpoint|presentation)\b/i.test(q)) {
      intent.ppt = true;
      intent.explicitFormat = true;
    }
    if (/\b(pdf|book|textbook)\b/i.test(q)) {
      intent.pdf = true;
      intent.explicitFormat = true;
    }
    if (/\b(doc|docx|word|document)\b/i.test(q)) {
      intent.doc = true;
      intent.explicitFormat = true;
    }

    if (/\b(mid|midterm|final|exam|exam paper|past paper|previous exam|test|quiz)\b/i.test(q)) {
      intent.exam = true;
    }
    if (/\b(note|notes|handout|lecture note|lecture notes)\b/i.test(q)) {
      intent.notes = true;
    }
    if (/\b(summary|short|easy|cheat sheet|quick review|revision|compact|brief)\b/i.test(q)) {
      intent.simple = true;
    }
    if (/\b(assignment|project|report|lab|lab manual|worksheet|practical|exercise|solution)\b/i.test(q)) {
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
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Tag intersection boost
    if (resource.tags && resource.tags.length > 0) {
      const intersection = resource.tags.filter(tag => queryWords.includes(tag.toLowerCase()));
      score += intersection.length * 20; // +20 per matching tag
    }

    const isImageGroup = (resource.groupId && resource.fileType === "image") || resource._isGrouped;

    // Explicit format matching vs Default Exam Photo Set Priority
    if (intent.explicitFormat) {
      if (intent.ppt && resource.fileType === "ppt") score += 200;
      if (intent.pdf && resource.fileType === "pdf") score += 200;
      if (intent.doc && resource.fileType === "doc") score += 200;
    } else {
      // User did not specify a format: PRIORITIZE EXAM PHOTO SETS & IMAGES!
      if (isImageGroup) {
        score += 160; // Top priority for exam photo bundles
      } else if (resource.fileType === "image" && resource.isExam) {
        score += 100;
      } else if (resource.fileType === "pdf") {
        score += 30;
      } else if (resource.fileType === "ppt") {
        score += 20;
      } else if (resource.fileType === "doc") {
        score += 15;
      }
    }

    // Exam boost
    if (intent.exam && resource.isExam) {
      score += 80;
    } else if (!intent.explicitFormat && resource.isExam) {
      score += 50;
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

    // Demote advertisements / commercial promotions in images
    if (resource.caption && /\b(#ad|#advertisement|#advetisement|sponsored|አስጠኚ ይፈልጋሉ|ኮርስ ለመግዛት)\b/i.test(resource.caption)) {
      score -= 150;
    }

    // Boost by popularity
    if (resource.downloadCount && resource.downloadCount > 0) {
      score += Math.min(resource.downloadCount * 2, 50);
    }

    return Math.max(0, score);
  }

  /**
   * Search Telegram indexed resources with intelligence
   */
  async searchTelegramResources(query, intent, user, logger = null, limit = 200) {
    try {
      console.log(`  📱 Searching Telegram resources...`);

      // Clean search string of boolean/syntax artifacts for MongoDB text search
      const cleanSearch = query.replace(/[()]/g, " ").trim();

      // Partitioned search: Guarantee both images/image groups and documents are retrieved
      const [images, docs] = await Promise.all([
        TelegramResource.find(
          { $text: { $search: cleanSearch }, fileType: "image", isAvailable: { $ne: false } },
          { score: { $meta: "textScore" } }
        )
          .sort({ score: { $meta: "textScore" } })
          .limit(100)
          .catch(() => []),
        TelegramResource.find(
          { $text: { $search: cleanSearch }, fileType: { $ne: "image" }, isAvailable: { $ne: false } },
          { score: { $meta: "textScore" } }
        )
          .sort({ score: { $meta: "textScore" } })
          .limit(100)
          .catch(() => []),
      ]);

      let results = [...images, ...docs];

      // If text index found fewer than 5 images, do a targeted caption search for exam photo sets
      if (images.length < 5) {
        const queryKeywords = cleanSearch
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2 && w !== "exam" && w !== "notes" && w !== "mid" && w !== "final");
        if (queryKeywords.length > 0) {
          const keywordRegex = new RegExp(queryKeywords.join("|"), "i");
          const fallbackImages = await TelegramResource.find({
            fileType: "image",
            caption: { $regex: keywordRegex },
            isAvailable: { $ne: false },
          })
            .limit(40)
            .catch(() => []);

          if (fallbackImages.length > 0) {
            results = results.concat(fallbackImages);
          }
        }
      }

      if (results.length === 0) {
        console.log(`  📱 Telegram: No results found`);
        return [];
      }

      // Deduplicate results by _id
      const uniqueDocs = new Map();
      for (const doc of results) {
        uniqueDocs.set(doc._id.toString(), doc);
      }

      // Score and prioritize results
      const scoredResults = Array.from(uniqueDocs.values()).map((resource) => {
        const textScore = resource.get ? resource.get("score") : 5;
        const telegramScore = this.calculateTelegramScore(resource, query, textScore, intent, user);

        const computedTitle =
          resource.fileName ||
          this.cleanCaptionTitle(resource.caption) ||
          "Untitled Resource";

        return {
          title: computedTitle,
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
          downloadCount: resource.downloadCount || 0,
          messageDate: resource.messageDate,
          fileName: resource.fileName,
          fileType: resource.fileType,
          fileSize: resource.fileSize || 0,
          groupTotal: resource.groupTotal || 1,
          archiveMessageId: resource.archiveMessageId,
          _telegramResource: true,
          _id: resource._id,
        };
      });

      scoredResults.sort((a, b) => b.score - a.score);

      const topResults = scoredResults.slice(0, limit);
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

      // Finally, try GitHub search if no results found from Telegram
      if (allResults.length === 0) {
        console.log(`\n🐙 PHASE 2: GitHub search fallback...`);
        logger.log("Fallback used", "github_search");
        const gitHubResults = await searchGitHub(correctedQuery).catch(() => []);

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
             r.groupSize = r.groupTotal || 1;
          }
          collapsed.push(r);
        }
        allResults = collapsed;
        allResults.sort((a, b) => b.score - a.score);
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
