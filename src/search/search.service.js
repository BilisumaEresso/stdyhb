const CachedSearch = require("../db/models/CachedSearch");
const TelegramResource = require("../db/models/TelegramResource");
const { searchGitHub } = require("./providers/github");
const { expandQuery, SUBJECT_ALIASES } = require("../config/subjectAliases");
const { correctTypos } = require("./typoCorrector");
const { generateDisplayTitle } = require("../utils/titleGenerator");

// Curated book & literature channels where files must never be bundled
const BOOK_CHANNELS = new Set([
  "amharic_fiction_books",
  "muscatnonfiction",
  "ethio_pdf_books",
  "academicbookspdf",
  "best_book_for_students",
  "medallbooks",
  "freshmanebook",
]);

// Generic intent and material type tokens
const GENERIC_TYPES = new Set([
  "exam", "exams", "examination", "examinations",
  "mid", "midterm", "midterms",
  "final", "finals",
  "test", "tests", "quiz", "quizzes",
  "paper", "papers", "question", "questions",
  "model", "sample", "past", "previous", "exit", "entrance",
  "note", "notes", "handout", "handouts", "lecture", "lectures",
  "summary", "summaries", "short", "review", "revision", "outline",
  "ppt", "pptx", "pdf", "doc", "docx", "slide", "slides", "presentation", "powerpoint",
  "assignment", "assignments", "project", "projects", "lab", "labs", "manual", "manuals",
  "worksheet", "worksheets", "exercise", "exercises", "solution", "solutions",
  "report", "reports", "case", "study",
  "book", "books", "module", "modules", "textbook", "textbooks", "guide", "guidebook", "reference"
]);

// Generic academic modifiers and noise tokens
const GENERIC_MODIFIERS = new Set([
  "general", "introduction", "intro", "introductory", "fundamentals", "fundamental",
  "basic", "basics", "principles", "principle", "applied", "advanced", "elementary",
  "freshman", "department", "course", "part", "chapter", "unit", "ch", "vol", "volume",
  "year", "semester", "sem", "1st", "2nd", "3rd", "4th"
]);

// Stopwords & connectors
const STOPWORDS = new Set([
  "for", "in", "and", "of", "to", "the", "a", "an", "on", "with", "by", "from", "at", "about"
]);

// Stemming / variant mapping for core academic terms
const STEM_MAP = {
  mathematics: "math",
  mathes: "math",
  maths: "math",
  math: "math",
  physics: "phys",
  physical: "phys",
  chemistry: "chem",
  chemical: "chem",
  biology: "bio",
  biological: "bio",
  network: "net",
  networks: "net",
  networking: "net",
  database: "db",
  databases: "db",
  algorithm: "algo",
  algorithms: "algo",
  structure: "struct",
  structures: "struct",
  "c++": "cpp",
  cpp: "cpp"
};

function normalizeTerm(term) {
  const t = (term || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return STEM_MAP[t] || t;
}

/**
 * Extract subject tokens, generic tokens, modifiers, and alias phrases from query.
 */
function extractSubjectIntent(query, appliedAliases = []) {
  const clean = (query || "").toLowerCase().replace(/[()_,-]/g, " ");
  const rawTokens = clean.split(/\s+/).filter(w => w.length >= 2);

  const subjectTokens = [];
  const genericTokens = [];
  const modifiers = [];

  for (const token of rawTokens) {
    if (STOPWORDS.has(token)) {
      continue;
    } else if (GENERIC_TYPES.has(token)) {
      genericTokens.push(token);
    } else if (GENERIC_MODIFIERS.has(token)) {
      modifiers.push(token);
    } else {
      subjectTokens.push(token);
    }
  }

  const aliasPhrases = new Set();
  const aliasKeywords = new Set();

  if (Array.isArray(appliedAliases)) {
    for (const aliasKey of appliedAliases) {
      const data = SUBJECT_ALIASES[aliasKey];
      if (data) {
        (data.aliases || []).forEach(a => aliasPhrases.add(a.toLowerCase()));
        (data.keywords || []).forEach(k => aliasKeywords.add(k.toLowerCase()));
      }
    }
  }

  for (const [key, data] of Object.entries(SUBJECT_ALIASES)) {
    if (!data.aliases) continue;
    let matched = false;
    for (const a of data.aliases) {
      const aLower = a.toLowerCase();
      const safe = aLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isWord = aLower.length <= 4 && !aLower.includes(" ")
        ? new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`, "i").test(clean)
        : clean.includes(aLower);
      if (isWord) {
        matched = true;
        break;
      }
    }
    if (matched) {
      (data.aliases || []).forEach(a => aliasPhrases.add(a.toLowerCase()));
      (data.keywords || []).forEach(k => aliasKeywords.add(k.toLowerCase()));
    }
  }

  return {
    rawTokens,
    subjectTokens,
    genericTokens,
    modifiers,
    aliasPhrases: Array.from(aliasPhrases),
    aliasKeywords: Array.from(aliasKeywords),
    hasSpecificSubject: subjectTokens.length > 0 || aliasPhrases.size > 0
  };
}

/**
 * Evaluate document alignment with the query's academic subject intent.
 */
function evaluateSubjectMatch(resource, subjectIntent) {
  if (!subjectIntent.hasSpecificSubject) {
    return { isSubjectMatch: true, matchType: "generic_query", boost: 0, penalty: 0 };
  }

  const title = (resource.cleanTitle || "").toLowerCase();
  const fileName = (resource.fileName || "").toLowerCase();
  const primaryText = `${title} ${fileName}`;
  const caption = (resource.caption || "").toLowerCase();
  const tags = (resource.tags || []).map(t => t.toLowerCase());

  const primaryNormalizedTokens = new Set(primaryText.split(/[^a-z0-9]+/).filter(Boolean).map(normalizeTerm));
  const tagNormalizedTokens = new Set(tags.map(t => t.replace(/_/g, " ")).join(" ").split(/[^a-z0-9]+/).filter(Boolean).map(normalizeTerm));
  const primaryAndTagTokens = new Set([...primaryNormalizedTokens, ...tagNormalizedTokens]);

  let isExactPhrase = false;
  let isAliasMatch = false;
  let primaryMatchedTokens = 0;

  // 1. Check exact subject phrases from aliases or multi-word subject in primary text/tags
  for (const phrase of subjectIntent.aliasPhrases) {
    const isShortAcronym = phrase.length <= 4 && !phrase.includes(" ");
    if (isShortAcronym) {
      const safe = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`, "i").test(primaryText)) {
        isExactPhrase = true;
        break;
      }
    } else {
      if (primaryText.includes(phrase)) {
        isExactPhrase = true;
        break;
      }
    }

    const phraseNorm = phrase.split(/\s+/).map(normalizeTerm).join(" ");
    const tagMatched = tags.some(t => {
      const tagNorm = t.replace(/_/g, " ").split(/\s+/).map(normalizeTerm).join(" ");
      if (phraseNorm.length <= 3) {
        return tagNorm === phraseNorm;
      }
      return tagNorm === phraseNorm || (phraseNorm.length >= 6 && tagNorm.includes(phraseNorm));
    });
    if (tagMatched) {
      isExactPhrase = true;
      break;
    }
  }

  if (!isExactPhrase && subjectIntent.subjectTokens.length >= 2) {
    const multiSubject = subjectIntent.subjectTokens.join(" ");
    if (primaryText.includes(multiSubject) || tags.some(t => t.replace(/_/g, " ").includes(multiSubject))) {
      isExactPhrase = true;
    }
  }

  if (!isExactPhrase && subjectIntent.modifiers.length > 0 && subjectIntent.subjectTokens.length > 0) {
    for (const mod of subjectIntent.modifiers) {
      for (const subj of subjectIntent.subjectTokens) {
        const combo = `${mod} ${subj}`;
        if (primaryText.includes(combo) || tags.some(t => t.replace(/_/g, " ").includes(combo))) {
          isExactPhrase = true;
          break;
        }
      }
    }
  }

  // 2. Check subject alias acronyms in primary text/tags
  if (!isExactPhrase) {
    for (const phrase of subjectIntent.aliasPhrases) {
      const safe = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`, "i");
      if (regex.test(primaryText) || tags.some(t => t.toLowerCase() === phrase)) {
        isAliasMatch = true;
        break;
      }
    }
  }

  // 3. Check alias keywords in primary text/tags
  if (!isExactPhrase && !isAliasMatch) {
    for (const kw of subjectIntent.aliasKeywords) {
      const kwNorm = normalizeTerm(kw);
      if (primaryAndTagTokens.has(kwNorm)) {
        isAliasMatch = true;
        break;
      }
    }
  }

  // 4. Count matching subject tokens in primary text/tags
  for (const token of subjectIntent.subjectTokens) {
    const norm = normalizeTerm(token);
    if (primaryAndTagTokens.has(norm)) {
      primaryMatchedTokens++;
    } else if (token.length >= 4 && (title.includes(token) || fileName.includes(token))) {
      primaryMatchedTokens++;
    }
  }

  const subjectRatio = subjectIntent.subjectTokens.length > 0
    ? primaryMatchedTokens / subjectIntent.subjectTokens.length
    : 0;

  const titleHasSubject = subjectIntent.subjectTokens.some(st => title.includes(st) || title.includes(normalizeTerm(st))) ||
    subjectIntent.aliasPhrases.some(ap => title.includes(ap));
  const fileNameHasSubject = subjectIntent.subjectTokens.some(st => fileName.includes(st) || fileName.includes(normalizeTerm(st))) ||
    subjectIntent.aliasPhrases.some(ap => fileName.includes(ap));
  const hasPrimaryMatch = titleHasSubject || fileNameHasSubject;

  if (isExactPhrase) {
    return { isSubjectMatch: true, matchType: "exact_phrase", boost: 180, penalty: 0, hasPrimaryMatch: true };
  } else if (isAliasMatch) {
    return { isSubjectMatch: true, matchType: "alias_match", boost: 140, penalty: 0, hasPrimaryMatch: true };
  } else if (subjectRatio === 1) {
    const boost = hasPrimaryMatch ? 130 : 35;
    return { isSubjectMatch: true, matchType: "full_subject", boost, penalty: 0, hasPrimaryMatch };
  } else if (subjectRatio >= 0.5) {
    const hasQuantum = subjectIntent.subjectTokens.includes("quantum");
    const matchedQuantum = hasQuantum && (primaryAndTagTokens.has("quantum") || title.includes("quantum"));
    if (hasQuantum && !matchedQuantum) {
      return { isSubjectMatch: true, matchType: "partial_subject_no_discriminator", boost: 30, penalty: 0, hasPrimaryMatch };
    }
    const boost = hasPrimaryMatch ? 80 : 30;
    return { isSubjectMatch: true, matchType: "partial_subject", boost, penalty: 0, hasPrimaryMatch };
  }

  // Check if subject is mentioned only in caption (secondary/weaker match)
  const captionTokens = new Set(caption.split(/[^a-z0-9]+/).filter(Boolean).map(normalizeTerm));
  let captionMatched = false;
  for (const token of subjectIntent.subjectTokens) {
    if (captionTokens.has(normalizeTerm(token))) {
      captionMatched = true;
      break;
    }
  }
  for (const phrase of subjectIntent.aliasPhrases) {
    if (caption.includes(phrase)) {
      captionMatched = true;
      break;
    }
  }

  if (captionMatched) {
    return { isSubjectMatch: true, matchType: "caption_only", boost: 35, penalty: 0 };
  }

  // Zero subject match!
  return { isSubjectMatch: false, matchType: "zero_subject", boost: 0, penalty: 140 };
}


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
   * Extract a clean, human-readable title from captions or origin channel text
   */
  cleanCaptionTitle(caption, fallback = "Study Material") {
    if (!caption) return fallback;
    const lines = caption
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        if (!line || line.startsWith("http") || line.startsWith("@")) return false;
        // Must contain at least some letters or numbers in any language
        return /[\p{L}\p{N}]/u.test(line);
      });

    if (lines.length === 0) return fallback;

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
    return title || fallback;
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
    if (/\b(book|books|fiction|novel|novels|nonfiction|non-fiction|reading|literature|\u1218\u133d\u1210\u134d|\u1218\u133d\u1210\u134d\u1275|\u12f0\u122b\u1232|\u1275\u122d\u1309\u121d|\u1295\u1263\u1265|\u134d\u1245\u122d|\u122d\u12cb\u12ed)\b/i.test(q)) {
      intent.book = true;
    }

    const yearMatch = query.match(/\b(201\d|202\d)\b/);
    if (yearMatch) {
      intent.year = yearMatch[0];
    }

    return intent;
  }

  /**
   * Calculate priority score for Telegram resources based on textScore, tags, subject intent, and type
   */
  calculateTelegramScore(resource, query, textScore, intent, user, context = {}) {
    let score = (textScore || 0) * 10; // Base score from MongoDB text index

    // Subject intent and match evaluation
    const subjectIntent = context.subjectIntent || extractSubjectIntent(context.normalizedQuery || query, context.appliedAliases);
    const match = evaluateSubjectMatch(resource, subjectIntent);

    if (match.isSubjectMatch) {
      score += match.boost;
    } else {
      score -= match.penalty;
    }

    // Tag intersection boost: Subject tags vs Generic tags
    if (resource.tags && resource.tags.length > 0) {
      for (const tag of resource.tags) {
        const tagLower = tag.toLowerCase().replace(/_/g, " ");
        const tagTokens = tagLower.split(/\s+/).map(normalizeTerm);
        const isSubjectTag = subjectIntent.subjectTokens.some(st => tagTokens.includes(normalizeTerm(st))) ||
          subjectIntent.aliasPhrases.some(ap => tagLower.includes(ap)) ||
          subjectIntent.aliasKeywords.some(ak => tagTokens.includes(normalizeTerm(ak)));

        if (isSubjectTag) {
          score += 30; // Strong boost for subject-specific tags
        } else if (match.isSubjectMatch && (tagLower === "exam" || tagLower === "final" || tagLower === "mid" || tagLower === "quiz" || tagLower === "notes")) {
          score += 10; // Bounded generic tag boost ONLY when document matches subject
        }
      }
    }

    const isImageGroup = (resource.groupId && resource.fileType === "image") || (resource._isGrouped && resource.fileType === "image");
    const isDocGroup = Boolean(resource.groupId && resource.fileType !== "image");
    const channelLower = (resource.channelUsername || "").toLowerCase();
    const isBookChannel = BOOK_CHANNELS.has(channelLower);
    const hasAmharicQuery = /[ሀ-፼]/.test(query);

    if (match.isSubjectMatch) {
      // Explicit format matching vs Default Exam Photo Set Priority
      if (intent.explicitFormat) {
        if (intent.ppt && resource.fileType === "ppt") score += 200;
        if (intent.pdf && resource.fileType === "pdf") score += 200;
        if (intent.doc && resource.fileType === "doc") score += 200;
        if (isDocGroup && !isBookChannel) score += 40;
      } else {
        // User did not specify a format: Prioritize contextually
        if (isImageGroup) {
          if (intent.book) {
            score += 10; // Do not prioritize image covers when user is searching for books
          } else if (intent.exam) {
            score += 160; // Top priority for exam photo bundles when user asked for exams
          } else if (resource.isExam && match.hasPrimaryMatch) {
            score += 50; // Moderate priority when exam wasn't explicitly requested but matches title
          } else if (hasAmharicQuery) {
            score += 40;
          } else {
            score += 25;
          }
        } else if (isDocGroup && !isBookChannel) {
          score += 100;
        } else if (resource.fileType === "image" && resource.isExam) {
          score += intent.exam ? 100 : (match.hasPrimaryMatch ? 30 : 15);
        } else if (resource.fileType === "pdf") {
          score += 50;
          if (isBookChannel || intent.book) {
            score += 130;
          }
          if (hasAmharicQuery && /[ሀ-፼]/.test(resource.fileName || resource.cleanTitle || "")) {
            score += 100;
          }
        } else if (resource.fileType === "ppt") {
          score += 20;
        } else if (resource.fileType === "doc") {
          score += 15;
        }
      }

      // Exam boost
      if (intent.exam && resource.isExam) {
        score += 80;
      } else if (!intent.explicitFormat && !intent.notes && resource.isExam) {
        score += 30;
      }

      // Notes boost
      if (intent.notes) {
        if (resource.fileType === "ppt" || resource.fileType === "doc" || resource.fileType === "pdf") {
          score += 40;
        }
        const titleLower = ((resource.cleanTitle || "") + " " + (resource.fileName || "")).toLowerCase();
        if (titleLower.includes("note") || titleLower.includes("lecture") || (resource.tags || []).includes("notes")) {
          score += 50;
        }
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

      // Calibrated ISR Popularity Boosting for relevant matches
      if (resource.downloadCount && resource.downloadCount > 0) {
        const dl = resource.downloadCount;
        if (dl >= 5) score += 150;
        else if (dl === 4) score += 120;
        else if (dl === 3) score += 90;
        else if (dl === 2) score += 60;
        else score += 35;
      }
    } else {
      // Zero subject match: Generic boosts are heavily scaled down to prevent irrelevant matches from competing
      if (intent.explicitFormat) {
        if (intent.ppt && resource.fileType === "ppt") score += 20;
        if (intent.pdf && resource.fileType === "pdf") score += 20;
        if (intent.doc && resource.fileType === "doc") score += 20;
      } else {
        if (resource.fileType === "pdf") score += 10;
        else if (resource.fileType === "ppt") score += 10;
      }

      if (intent.exam && resource.isExam) score += 15;
      else if (resource.isExam) score += 10;

      if (resource.downloadCount && resource.downloadCount > 0) {
        score += Math.min(30, resource.downloadCount * 6);
      }
    }

    // Personalization scoring (preserved fully)
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

    // Demote non-academic magazines
    const titleAndFileLower = ((resource.cleanTitle || "") + " " + (resource.fileName || "")).toLowerCase();
    if (titleAndFileLower.includes("popular mechanics") || titleAndFileLower.includes("magazine")) {
      score -= 120;
    }

    return Math.max(0, score);
  }

  /**
   * Search Telegram indexed resources with intelligence
   */
  async searchTelegramResources(query, intent, user, logger = null, limit = 200, queryContext = {}) {
    try {
      console.log(`  📱 Searching Telegram resources...`);

      // Clean search string of syntax artifacts for MongoDB text search
      const cleanSearch = (query || "").replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
      if (!cleanSearch) {
        return [];
      }

      const subjectIntent = queryContext.subjectIntent || extractSubjectIntent(queryContext.normalizedQuery || query, queryContext.appliedAliases);

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
        const telegramScore = this.calculateTelegramScore(resource, query, textScore, intent, user, { ...queryContext, subjectIntent });

        let computedTitle =
          resource.cleanTitle ||
          generateDisplayTitle(resource) ||
          "Untitled Resource";

        // Remove commercial trailing watermarks like "ExamClass" from display title
        computedTitle = computedTitle
          .replace(/\b(ExamClass|Freshman\s*Master\s*Class)\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        return {
          title: computedTitle,
          url: `https://t.me/${resource.channelUsername}/${resource.messageId}`,
          source: "telegram",
          type: this.mapFileTypeToResourceType(resource.fileType),
          score: telegramScore,
          fileId: resource.fileId,
          fileUniqueId: resource.fileUniqueId,
          channelUsername: resource.channelUsername,
          chatId: resource.chatId,
          university: resource.university || "",
          cleanTitle: resource.cleanTitle || "",
          isExam: resource.isExam,
          groupId: resource.groupId,
          groupIndex: resource.groupIndex || 0,
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
   * Collapse exact cross-channel duplicate files using (fileName + fileSize) and fileUniqueId.
   * Golden Rule: "no file can have exact same name and size by accident".
   * Collapses duplicates into a single high-quality representative card,
   * retaining all alternative channel sources, universities, download totals, and bundle structure.
   */
  deduplicateStandaloneDuplicates(results, user = null) {
    if (!Array.isArray(results) || results.length <= 1) {
      return results || [];
    }

    const userUni = (user && user.university && typeof user.university === "string")
      ? user.university.trim().toLowerCase()
      : null;

    const clusterMap = new Map(); // signature -> Array of duplicate items
    const orderedOutput = []; // Preserves search ranking order

    for (const r of results) {
      if (r.groupId) {
        // Standalone deduplication passes album members through untouched
        orderedOutput.push({ type: "passthrough", item: r });
        continue;
      }

      let key = null;
      if (typeof r.fileUniqueId === "string" && r.fileUniqueId.trim().length > 0) {
        key = `fuid::${r.fileUniqueId.trim()}`;
      } else {
        const fn = (r.fileName || "").trim().toLowerCase();
        const fs = Number(r.fileSize) || 0;
        if (fn && fs > 0) {
          key = `file::${fn}::${fs}`;
        }
      }

      if (key) {
        if (!clusterMap.has(key)) {
          clusterMap.set(key, [r]);
          orderedOutput.push({ type: "cluster", key });
        } else {
          clusterMap.get(key).push(r);
        }
      } else {
        orderedOutput.push({ type: "passthrough", item: r });
      }
    }

    const finalResults = [];

    for (const entry of orderedOutput) {
      if (entry.type === "passthrough") {
        finalResults.push(entry.item);
        continue;
      }

      const cluster = clusterMap.get(entry.key);
      if (!cluster || cluster.length === 0) continue;
      clusterMap.delete(entry.key);

      if (cluster.length === 1) {
        const item = cluster[0];
        item.channelCount = 1;
        item.duplicateCount = 1;
        item.alternativeSources = [];
        item.universities = item.university ? [item.university] : [];
        finalResults.push(item);
        continue;
      }

      // Pick best representative:
      // 1. Matches user university
      // 2. Retains grouped bundle structure if present
      // 3. Highest search score
      // 4. Highest download count
      // 5. Has cleanTitle or fileName
      cluster.sort((a, b) => {
        if (userUni) {
          const aMatch = (a.university || "").toLowerCase().includes(userUni);
          const bMatch = (b.university || "").toLowerCase().includes(userUni);
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }

        const aGrouped = a._isGrouped ? 1 : 0;
        const bGrouped = b._isGrouped ? 1 : 0;
        if (bGrouped !== aGrouped) return bGrouped - aGrouped;

        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (Math.abs(scoreDiff) > 0.001) return scoreDiff;

        const dlDiff = (b.downloadCount || 0) - (a.downloadCount || 0);
        if (dlDiff !== 0) return dlDiff;

        const aHasTitle = (a.cleanTitle || a.fileName) ? 1 : 0;
        const bHasTitle = (b.cleanTitle || b.fileName) ? 1 : 0;
        return bHasTitle - aHasTitle;
      });

      const representative = cluster[0];
      const alternatives = cluster.slice(1);

      // Merge download counts across duplicates
      representative.downloadCount = cluster.reduce((sum, item) => sum + (item.downloadCount || 0), 0);

      const allChannels = new Set();
      if (representative.channelUsername) {
        allChannels.add(representative.channelUsername.toLowerCase());
      }
      alternatives.forEach(alt => {
        if (alt.channelUsername) {
          allChannels.add(alt.channelUsername.toLowerCase());
        }
      });

      const allUniversities = new Set();
      if (representative.university) {
        allUniversities.add(representative.university);
      }
      alternatives.forEach(alt => {
        if (alt.university) {
          allUniversities.add(alt.university);
        }
      });

      const alternativeSources = alternatives.map(alt => ({
        channelUsername: alt.channelUsername,
        messageId: alt.messageId,
        url: alt.url,
        fileId: alt.fileId,
        archiveMessageId: alt.archiveMessageId,
        university: alt.university || "",
        downloadCount: alt.downloadCount || 0,
        score: alt.score,
        _id: alt._id
      }));

      representative.alternativeSources = alternativeSources;
      representative.channelCount = allChannels.size;
      representative.duplicateCount = cluster.length;
      representative.universities = Array.from(allUniversities);

      if (!representative.university && representative.universities.length > 0) {
        representative.university = representative.universities[0];
      }

      finalResults.push(representative);
    }

    return finalResults;
  }

  /**
   * Remove duplicate URLs and cross-channel identical files
   */
  deduplicateResults(results, user = null) {
    if (!Array.isArray(results)) return [];
    const standaloneDeduped = this.deduplicateStandaloneDuplicates(results, user);

    const seen = new Map();
    standaloneDeduped.forEach((result) => {
      const normalized = (result.url || "").toLowerCase().replace(/\/$/, "");
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

      const queryContext = {
        originalQuery: query,
        normalizedQuery,
        correctedQuery,
        appliedAliases: expanded.appliedAliases || []
      };

      // Primary search with corrected & expanded query
      console.log(`\n📱 PHASE 1: Primary Telegram search...`);
      let allResults = await this.searchTelegramResources(expanded.expanded, intent, user, logger, 200, queryContext);

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
          const searchPromises = Array.from(fallbackQueries).map(q => this.searchTelegramResources(q, intent, user, logger, 50, queryContext));
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
      // Step 4: Deduplicate and collapse DB-assigned groups (image albums & document bundles)
      if (telegramResults.length > 0) {
        console.log(`\n📦 Collapsing grouped bundles (images & documents)...`);
        const collapsed = [];
        const seenGroups = new Set();

        for (const r of allResults) {
          const chLower = (r.channelUsername || "").toLowerCase();
          const isBook = BOOK_CHANNELS.has(chLower);

          // Books are distinct literature files, NOT pages/parts of one bundle!
          if (r.groupId && !isBook) {
             if (seenGroups.has(r.groupId)) continue;
             seenGroups.add(r.groupId);
             r._isGrouped = true;
             r.groupSize = r.groupTotal || 1;

             // Clean title for collapsed bundle
             r.title = (r.cleanTitle || generateDisplayTitle(r))
               .replace(/\b(ExamClass|Freshman\s*Master\s*Class)\b/gi, "")
               .replace(/\s+/g, " ")
               .trim();
          } else if (!r.groupId && !isBook && r.channelUsername && r.messageId) {
             // Fallback un-grouped clustering for consecutive search results from same channel
             const titleLower = (r.cleanTitle || r.title || "").toLowerCase().trim();
             const existingGroup = collapsed.find(c =>
               !c.groupId &&
               c.channelUsername &&
               c.channelUsername.toLowerCase() === chLower &&
               Math.abs((c.messageId || 0) - (r.messageId || 0)) <= 3 &&
               (c.cleanTitle || c.title || "").toLowerCase().trim() === titleLower
             );
             if (existingGroup) {
               existingGroup._isGrouped = true;
               existingGroup.groupSize = (existingGroup.groupSize || 1) + 1;
               continue;
             }
          }
          collapsed.push(r);
        }
        allResults = collapsed;
        allResults.sort((a, b) => b.score - a.score);
      }

      // Step 4b: Deduplicate exact standalone files across channels using fileUniqueId
      if (allResults.length > 0) {
        console.log(`\n📑 Collapsing exact cross-channel duplicate files...`);
        const beforeCount = allResults.length;
        allResults = this.deduplicateStandaloneDuplicates(allResults, user);
        const deduplicatedCount = beforeCount - allResults.length;
        if (deduplicatedCount > 0) {
          console.log(`  ✓ Collapsed ${deduplicatedCount} duplicate file instances`);
        }
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
