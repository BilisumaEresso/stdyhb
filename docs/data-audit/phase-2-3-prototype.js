const mongoose = require('mongoose');
const { SUBJECT_ALIASES, expandQuery } = require('../../src/config/subjectAliases');

// Load TelegramResource model
const TelegramResource = require('../../src/db/models/TelegramResource');

// Connect to isolated test DB
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
  biological: "bio"
};

function normalizeTerm(term) {
  const t = term.toLowerCase().replace(/[^a-z0-9]/g, "");
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

  // Collect alias keywords if recognized
  const aliasPhrases = new Set();
  const aliasKeywords = new Set();

  for (const aliasKey of appliedAliases) {
    const data = SUBJECT_ALIASES[aliasKey];
    if (data) {
      (data.aliases || []).forEach(a => aliasPhrases.add(a.toLowerCase()));
      (data.keywords || []).forEach(k => aliasKeywords.add(k.toLowerCase()));
    }
  }

  // Also check direct query against all subject aliases
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

function evaluateSubjectMatch(resource, subjectIntent, fullQuery) {
  if (!subjectIntent.hasSpecificSubject) {
    return { isSubjectMatch: true, matchType: "generic_query", boost: 0, penalty: 0 };
  }

  const title = (resource.cleanTitle || "").toLowerCase();
  const fileName = (resource.fileName || "").toLowerCase();
  const caption = (resource.caption || "").toLowerCase();
  const tags = (resource.tags || []).map(t => t.toLowerCase());

  const fullText = `${title} ${fileName} ${caption}`;
  const normalizedTextTokens = fullText.split(/[^a-z0-9]+/).filter(Boolean).map(normalizeTerm);
  const normalizedTagTokens = tags.map(t => t.replace(/_/g, " ")).join(" ").split(/[^a-z0-9]+/).filter(Boolean).map(normalizeTerm);
  const allNormalizedTokens = new Set([...normalizedTextTokens, ...normalizedTagTokens]);

  let isExactPhrase = false;
  let isAliasMatch = false;
  let matchedSubjectTokens = 0;

  // 1. Check exact subject phrases from aliases or multi-word subject
  for (const phrase of subjectIntent.aliasPhrases) {
    if (fullText.includes(phrase) || tags.some(t => t.replace(/_/g, " ") === phrase)) {
      isExactPhrase = true;
      break;
    }
  }

  // If query had multi-word subject tokens (e.g. "computer networks", "quantum mechanics")
  if (!isExactPhrase && subjectIntent.subjectTokens.length >= 2) {
    const multiSubject = subjectIntent.subjectTokens.join(" ");
    if (fullText.includes(multiSubject) || tags.some(t => t.replace(/_/g, " ").includes(multiSubject))) {
      isExactPhrase = true;
    }
  }

  // Check modifier + subject phrase (e.g. "general mathematics")
  if (!isExactPhrase && subjectIntent.modifiers.length > 0 && subjectIntent.subjectTokens.length > 0) {
    for (const mod of subjectIntent.modifiers) {
      for (const subj of subjectIntent.subjectTokens) {
        const combo = `${mod} ${subj}`;
        if (fullText.includes(combo) || tags.some(t => t.replace(/_/g, " ").includes(combo))) {
          isExactPhrase = true;
          break;
        }
      }
    }
  }

  // 2. Check subject alias keywords or acronyms
  if (!isExactPhrase) {
    for (const phrase of subjectIntent.aliasPhrases) {
      // Check for standalone acronym match (e.g. \bdbms\b, \bdsa\b)
      const regex = new RegExp(`(^|[^a-z0-9])${phrase}([^a-z0-9]|$)`, "i");
      if (regex.test(fullText) || tags.includes(phrase)) {
        isAliasMatch = true;
        break;
      }
    }
  }

  // 3. Count matching subject tokens
  for (const token of subjectIntent.subjectTokens) {
    const norm = normalizeTerm(token);
    if (allNormalizedTokens.has(norm)) {
      matchedSubjectTokens++;
    } else {
      // check substring in title or fileName if token is >= 4 chars
      if (token.length >= 4 && (title.includes(token) || fileName.includes(token))) {
        matchedSubjectTokens++;
      }
    }
  }

  const subjectRatio = subjectIntent.subjectTokens.length > 0
    ? matchedSubjectTokens / subjectIntent.subjectTokens.length
    : 0;

  if (title.includes("pysychology") || title.includes("psychology")) {
    console.log("DEBUG General Psychology:", {
      title,
      matchedSubjectTokens,
      subjectTokens: subjectIntent.subjectTokens,
      allNormalizedTokens: Array.from(allNormalizedTokens),
      isExactPhrase,
      isAliasMatch
    });
  }

  if (isExactPhrase) {
    return { isSubjectMatch: true, matchType: "exact_phrase", boost: 160, penalty: 0 };
  } else if (isAliasMatch) {
    return { isSubjectMatch: true, matchType: "alias_match", boost: 120, penalty: 0 };
  } else if (subjectRatio === 1) {
    return { isSubjectMatch: true, matchType: "full_subject", boost: 110, penalty: 0 };
  } else if (subjectRatio >= 0.5) {
    return { isSubjectMatch: true, matchType: "partial_subject", boost: 60, penalty: 0 };
  } else {
    // Zero subject match!
    return { isSubjectMatch: false, matchType: "zero_subject", boost: 0, penalty: 140 };
  }
}

async function testPrototype() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to isolated DB.");

  const queries = [
    'General Mathematics',
    'Computer Networks final exam',
    'DBMS exam',
    'DSA PPT',
    'quantum mechanics lecture notes'
  ];

  for (const q of queries) {
    console.log(`\n==================================================`);
    console.log(`TEST QUERY: "${q}"`);
    console.log(`==================================================`);

    const expanded = expandQuery(q);
    const subjectIntent = extractSubjectIntent(q, expanded.appliedAliases);
    console.log("Subject Intent:", {
      subjectTokens: subjectIntent.subjectTokens,
      genericTokens: subjectIntent.genericTokens,
      modifiers: subjectIntent.modifiers,
      aliasPhrases: subjectIntent.aliasPhrases.slice(0, 3)
    });

    const docs = await TelegramResource.find(
      { $text: { $search: expanded.expanded }, isAvailable: { $ne: false } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(50)
      .lean();

    const scored = docs.map(d => {
      let score = (d.score || 0) * 10;
      const match = evaluateSubjectMatch(d, subjectIntent, q);

      if (match.isSubjectMatch) {
        score += match.boost;
        // Normal boosts
        if (d.isExam && (subjectIntent.genericTokens.includes("exam") || subjectIntent.genericTokens.includes("final"))) {
          score += 80;
        }
        if (d.fileType === "ppt" && subjectIntent.genericTokens.includes("ppt")) {
          score += 200;
        }
        if (d.downloadCount >= 5) score += 150;
        else if (d.downloadCount > 0) score += d.downloadCount * 30;
      } else {
        // Zero subject match: penalize and scale down generic boosts
        score -= match.penalty;
        if (d.isExam) score += 15; // Scaled down
        if (d.fileType === "ppt") score += 20; // Scaled down
        if (d.downloadCount >= 5) score += 30; // Scaled down
      }

      return {
        title: d.cleanTitle || d.fileName,
        fileType: d.fileType,
        score: Math.max(0, score),
        matchType: match.matchType,
        isExam: d.isExam,
        downloadCount: d.downloadCount || 0,
        tags: (d.tags || []).slice(0, 3)
      };
    });

    scored.sort((a, b) => b.score - a.score);

    console.log(`Top 5 Results with Subject Relevance Scoring:`);
    scored.slice(0, 5).forEach((r, idx) => {
      console.log(`  ${idx + 1}. [Score: ${r.score.toFixed(1)}] [${r.matchType}] [${r.fileType}] ${r.title} (tags: ${r.tags.join(',')})`);
    });
  }

  await mongoose.disconnect();
}

testPrototype().catch(err => {
  console.error(err);
  process.exit(1);
});
