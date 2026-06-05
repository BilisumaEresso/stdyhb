/**
 * Parse search intent to extract structured information
 * Converts "dsa ppt cs" → { subject: "dsa", resourceType: "ppt", department: "cs" }
 */

const { SUBJECT_ALIASES } = require("../config/subjectAliases");

// Resource type keywords
const RESOURCE_TYPE_KEYWORDS = {
  ppt: ["ppt", "pptx", "presentation", "slides", "slide"],
  pdf: ["pdf", "paper"],
  doc: ["doc", "docx", "document", "notes", "note"],
  image: ["image", "photo", "pic", "screenshot", "exam scan"],
  video: ["video", "lecture", "class"],
  exam: ["exam", "test", "quiz", "final", "midterm", "mid", "past paper"],
};

// Department/Faculty keywords
const DEPARTMENT_KEYWORDS = {
  cs: ["cs", "computer science", "computing", "software", "programming"],
  engineering: ["engineering", "eng"],
  physics: ["physics"],
  chemistry: ["chemistry", "chem"],
  math: ["math", "mathematics"],
  business: ["business", "management", "accounting"],
  medicine: ["medicine", "medical", "health"],
  biology: ["biology", "bio"],
};

/**
 * Build subject detection map (all aliases → subject key)
 */
function buildSubjectMap() {
  const map = {};
  for (const [subject, data] of Object.entries(SUBJECT_ALIASES)) {
    map[subject] = subject;
    if (data.aliases) {
      data.aliases.forEach((alias) => {
        map[alias.toLowerCase()] = subject;
      });
    }
    if (data.keywords) {
      data.keywords.forEach((keyword) => {
        map[keyword.toLowerCase()] = subject;
      });
    }
  }
  return map;
}

const SUBJECT_MAP = buildSubjectMap();

/**
 * Parse search query into structured intent
 *
 * Returns:
 * {
 *   original: "dsa ppt cs exam",
 *   normalized: "dsa ppt cs exam",
 *   subject: "dsa",
 *   resourceType: "ppt",
 *   department: "cs",
 *   isExam: true,
 *   keywords: ["ppt", "cs", "exam"],
 *   remainingQuery: "exam"
 * }
 */
function parseIntent(query) {
  if (!query) {
    return {
      original: "",
      normalized: "",
      subject: null,
      resourceType: null,
      department: null,
      isExam: false,
      keywords: [],
      remainingQuery: "",
    };
  }

  const normalized = query.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  let subject = null;
  let resourceType = null;
  let department = null;
  let isExam = false;
  const keywords = [];
  const usedWords = new Set();

  // Step 1: Find subject
  for (const word of words) {
    if (SUBJECT_MAP[word]) {
      subject = SUBJECT_MAP[word];
      usedWords.add(word);
      keywords.push(word);
      break;
    }
  }

  // Step 2: Find resource type
  for (const [type, typeKeywords] of Object.entries(RESOURCE_TYPE_KEYWORDS)) {
    for (const typeKeyword of typeKeywords) {
      if (words.includes(typeKeyword) && !usedWords.has(typeKeyword)) {
        resourceType = type;
        usedWords.add(typeKeyword);
        keywords.push(typeKeyword);
        if (type === "exam") isExam = true;
        break;
      }
    }
    if (resourceType) break;
  }

  // Step 3: Find department
  for (const [dept, deptKeywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
    for (const deptKeyword of deptKeywords) {
      if (words.includes(deptKeyword) && !usedWords.has(deptKeyword)) {
        department = dept;
        usedWords.add(deptKeyword);
        keywords.push(deptKeyword);
        break;
      }
    }
    if (department) break;
  }

  // Check for exam keywords even if not detected as resource type
  for (const examKeyword of [
    "exam",
    "final",
    "midterm",
    "test",
    "quiz",
    "past",
  ]) {
    if (words.includes(examKeyword) && !isExam) {
      isExam = true;
      usedWords.add(examKeyword);
      keywords.push(examKeyword);
      break;
    }
  }

  // Remaining query (words not parsed as intent)
  const remainingWords = words.filter((w) => !usedWords.has(w));
  const remainingQuery = remainingWords.join(" ");

  return {
    original: query,
    normalized,
    subject,
    resourceType,
    department,
    isExam,
    keywords,
    remainingQuery,
  };
}

/**
 * Get related subjects (subjects this result should NOT be penalized for)
 * E.g., "dsa" is related to "algorithms", "data structures"
 */
function getRelatedSubjects(subject) {
  if (!subject) return [];

  const related = [subject];

  // Map related subjects
  const relations = {
    dsa: ["algorithms"],
    algorithms: ["dsa"],
    dbms: ["database", "sql"],
    database: ["dbms", "sql"],
    oop: [],
    os: [],
    cn: [],
  };

  if (relations[subject]) {
    related.push(...relations[subject]);
  }

  return related;
}

module.exports = {
  parseIntent,
  getRelatedSubjects,
  RESOURCE_TYPE_KEYWORDS,
  DEPARTMENT_KEYWORDS,
};
