const mongoose = require('mongoose');
const { SUBJECT_ALIASES, expandQuery } = require('../../src/config/subjectAliases');
const TelegramResource = require('../../src/db/models/TelegramResource');

const MONGO_URI = 'mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113';

// Classification constants
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

const GENERIC_MODIFIERS = new Set([
  "general", "introduction", "intro", "introductory", "fundamentals", "fundamental",
  "basic", "basics", "principles", "principle", "applied", "advanced", "elementary",
  "freshman", "department", "course", "part", "chapter", "unit", "ch", "vol", "volume",
  "year", "semester", "sem", "1st", "2nd", "3rd", "4th"
]);

const STOPWORDS = new Set([
  "for", "in", "and", "of", "to", "the", "a", "an", "on", "with", "by", "from", "at", "about"
]);

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
  biological: "bio"
};

function normalizeTerm(term) {
  const t = (term || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return STEM_MAP[t] || t;
}

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
    for (const a of data.aliases) {
      const aLower = a.toLowerCase();
      if (clean.includes(aLower)) {
        aliasPhrases.add(aLower);
        (data.keywords || []).forEach(k => aliasKeywords.add(k.toLowerCase()));
      }
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
    if (primaryText.includes(phrase) || tags.some(t => t.replace(/_/g, " ") === phrase)) {
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
      const regex = new RegExp(`(^|[^a-z0-9])${phrase}([^a-z0-9]|$)`, "i");
      if (regex.test(primaryText) || tags.includes(phrase)) {
        isAliasMatch = true;
        break;
      }
    }
  }

  // 3. Count matching subject tokens in primary text/tags
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
    const boost = hasPrimaryMatch ? 130 : 70;
    return { isSubjectMatch: true, matchType: "full_subject", boost, penalty: 0, hasPrimaryMatch };
  } else if (subjectRatio >= 0.5) {
    // If one of the tokens is a heavy discriminator (like 'quantum')
    const hasQuantum = subjectIntent.subjectTokens.includes("quantum");
    const matchedQuantum = hasQuantum && (primaryAndTagTokens.has("quantum") || title.includes("quantum"));
    if (hasQuantum && !matchedQuantum) {
      // User wanted quantum mechanics, this doc only matched mechanics!
      return { isSubjectMatch: true, matchType: "partial_subject_no_discriminator", boost: 30, penalty: 0, hasPrimaryMatch };
    }
    const boost = hasPrimaryMatch ? 80 : 40;
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

function calculateScore(resource, query, textScore, intent, user, subjectIntent) {
  let score = (textScore || 0) * 10;

  const match = evaluateSubjectMatch(resource, subjectIntent);

  // Subject match adjustments
  if (match.isSubjectMatch) {
    score += match.boost;
  } else {
    score -= match.penalty;
  }

  // Tag intersection
  if (resource.tags && resource.tags.length > 0) {
    for (const tag of resource.tags) {
      const tagLower = tag.toLowerCase().replace(/_/g, " ");
      const tagTokens = tagLower.split(/\s+/).map(normalizeTerm);
      const isSubjectTag = subjectIntent.subjectTokens.some(st => tagTokens.includes(normalizeTerm(st))) ||
        subjectIntent.aliasPhrases.some(ap => tagLower.includes(ap)) ||
        subjectIntent.aliasKeywords.some(ak => tagTokens.includes(normalizeTerm(ak)));

      if (isSubjectTag) {
        score += 30;
      } else if (match.isSubjectMatch && (tagLower === "exam" || tagLower === "final" || tagLower === "mid" || tagLower === "quiz" || tagLower === "notes")) {
        score += 10;
      }
    }
  }

  const isImageGroup = (resource.groupId && resource.fileType === "image") || (resource._isGrouped && resource.fileType === "image");
  const isDocGroup = Boolean(resource.groupId && resource.fileType !== "image");
  const channelLower = (resource.channelUsername || "").toLowerCase();
  const isBookChannel = false;
  const hasAmharicQuery = /[ሀ-፼]/.test(query);

  if (match.isSubjectMatch) {
    if (intent.explicitFormat) {
      if (intent.ppt && resource.fileType === "ppt") score += 200;
      if (intent.pdf && resource.fileType === "pdf") score += 200;
      if (intent.doc && resource.fileType === "doc") score += 200;
      if (isDocGroup && !isBookChannel) score += 40;
    } else {
      if (isImageGroup) {
        if (intent.exam) score += 160;
        else if (resource.isExam) score += 60;
        else score += 40;
      } else if (isDocGroup && !isBookChannel) {
        score += 100;
      } else if (resource.fileType === "image" && resource.isExam) {
        score += intent.exam ? 100 : 30;
      } else if (resource.fileType === "pdf") {
        score += 50;
      } else if (resource.fileType === "ppt") {
        score += 20;
      } else if (resource.fileType === "doc") {
        score += 15;
      }
    }

    if (intent.exam && resource.isExam) score += 80;
    else if (!intent.explicitFormat && !intent.notes && resource.isExam) score += 30;

    if (intent.notes) {
      if (resource.fileType === "ppt" || resource.fileType === "doc" || resource.fileType === "pdf") {
        score += 40;
      }
      const titleLower = ((resource.cleanTitle || "") + " " + (resource.fileName || "")).toLowerCase();
      if (titleLower.includes("note") || titleLower.includes("lecture") || (resource.tags || []).includes("notes")) {
        score += 50;
      }
    }

    // Popularity
    if (resource.downloadCount && resource.downloadCount > 0) {
      const dl = resource.downloadCount;
      if (dl >= 5) score += 150;
      else if (dl === 4) score += 120;
      else if (dl === 3) score += 90;
      else if (dl === 2) score += 60;
      else score += 35;
    }
  } else {
    // Zero subject match: Generic boosts scaled down
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

  // Personalization
  if (user && user.university && resource.university && resource.university.toLowerCase() === user.university.toLowerCase()) {
    score += 80;
  }

  // Non-academic demotions
  if (resource.caption && /\b(#ad|#advertisement|#advetisement|sponsored|አስጠኚ ይፈልጋሉ|ኮርስ ለመግዛት)\b/i.test(resource.caption)) {
    score -= 150;
  }
  const titleLower = ((resource.cleanTitle || "") + " " + (resource.fileName || "")).toLowerCase();
  if (titleLower.includes("popular mechanics") || titleLower.includes("magazine")) {
    score -= 120;
  }

  return Math.max(0, score);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to local DB.");

  const testCases = [
    { query: "General Mathematics", intent: { explicitFormat: false } },
    { query: "Computer Networks final exam", intent: { exam: true, explicitFormat: false } },
    { query: "DBMS exam", intent: { exam: true, explicitFormat: false } },
    { query: "DSA PPT", intent: { ppt: true, explicitFormat: true } },
    { query: "quantum mechanics lecture notes", intent: { notes: true, explicitFormat: false } }
  ];

  for (const tc of testCases) {
    console.log(`\n======================================================`);
    console.log(`QUERY: "${tc.query}"`);
    console.log(`======================================================`);

    const expanded = expandQuery(tc.query);
    const subjectIntent = extractSubjectIntent(tc.query, expanded.appliedAliases);

    const [images, docs] = await Promise.all([
      TelegramResource.find(
        { $text: { $search: expanded.expanded }, fileType: "image", isAvailable: { $ne: false } },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } }).limit(100).lean(),
      TelegramResource.find(
        { $text: { $search: expanded.expanded }, fileType: { $ne: "image" }, isAvailable: { $ne: false } },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } }).limit(100).lean()
    ]);

    const results = [...images, ...docs];
    const scored = results.map(r => {
      const s = calculateScore(r, tc.query, r.score || 5, tc.intent, null, subjectIntent);
      const m = evaluateSubjectMatch(r, subjectIntent);
      return {
        title: r.cleanTitle || r.fileName,
        fileType: r.fileType,
        score: s,
        matchType: m.matchType,
        isExam: r.isExam,
        downloadCount: r.downloadCount || 0,
        tags: (r.tags || []).slice(0, 3)
      };
    });

    scored.sort((a, b) => b.score - a.score);

    console.log(`Top 5 Scored Results:`);
    scored.slice(0, 5).forEach((item, idx) => {
      console.log(`  ${idx + 1}. [Score: ${item.score.toFixed(1)}] [${item.matchType}] [${item.fileType}] ${item.title} (dl: ${item.downloadCount}, tags: ${item.tags.join(',')})`);
    });
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
