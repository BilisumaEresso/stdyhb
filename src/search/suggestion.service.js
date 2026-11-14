/**
 * StudyHub Search Suggestion & Autocomplete Engine
 *
 * Provides ultra-fast, in-memory search suggestions and autocomplete
 * powered by the centralized Ethiopian Academic Taxonomy (collections,
 * 21 primary categories, freshman streams & courses, and academic aliases),
 * canonical university disciplines, and curated popular search patterns.
 *
 * Latency: < 1ms (In-memory index, zero database queries per keystroke).
 */

const {
  COLLECTIONS,
  SUBJECT_CATEGORIES,
  FRESHMAN_STREAMS,
  FRESHMAN_COURSES,
  ALIASES: TAXONOMY_ALIASES
} = require("../config/taxonomy");
const { SUBJECT_ALIASES } = require("../config/subjectAliases");

/**
 * Curated high-frequency academic queries & search patterns in Ethiopian universities
 */
const CURATED_POPULAR_QUERIES = [
  { text: "Computer Science", type: "popular", category: "subject", subjectKey: "cs" },
  { text: "Computer Networks", type: "popular", category: "subject", subjectKey: "cn" },
  { text: "Computer Organization and Architecture", type: "popular", category: "subject", subjectKey: "coa" },
  { text: "Compiler Design", type: "popular", category: "subject", subjectKey: "compiler" },
  { text: "DBMS Exam", type: "popular", category: "exam", subjectKey: "dbms" },
  { text: "DSA Final Exam", type: "popular", category: "exam", subjectKey: "dsa" },
  { text: "Computer Networks Mid Exam", type: "popular", category: "exam", subjectKey: "cn" },
  { text: "Operating Systems Exam", type: "popular", category: "exam", subjectKey: "os" },
  { text: "Calculus I Past Exam", type: "popular", category: "exam", subjectKey: "math1" },
  { text: "General Mathematics Natural Science", type: "popular", category: "course", subjectKey: "mathNat" },
  { text: "General Physics Mid Exam", type: "popular", category: "exam", subjectKey: "phys" },
  { text: "Logic and Critical Thinking Exam", type: "popular", category: "exam", subjectKey: "logic" },
  { text: "Applied Mathematics I", type: "popular", category: "course", subjectKey: "engmath" },
  { text: "Software Engineering", type: "popular", category: "course", subjectKey: "se" },
  { text: "Object Oriented Programming (OOP)", type: "popular", category: "course", subjectKey: "cpp" },
  { text: "Digital Logic Design (DLD)", type: "popular", category: "course", subjectKey: "dld" },
  { text: "Emerging Technologies", type: "popular", category: "course", subjectKey: "emtech" },
  { text: "Inclusiveness", type: "popular", category: "course", subjectKey: "inclusion" },
  { text: "General Chemistry", type: "popular", category: "course", subjectKey: "chem" },
  { text: "Economics Freshman Course", type: "popular", category: "course", subjectKey: "econ" },
  { text: "Global Trends", type: "popular", category: "course", subjectKey: "global" },
  { text: "Engineering Mechanics: Statics", type: "popular", category: "course", subjectKey: "statics" },
  { text: "Artificial Intelligence", type: "popular", category: "course", subjectKey: "ai" }
];

/**
 * Specialized university discipline names not directly represented as primary category names.
 * Sourced to preserve rich university-level course suggestions.
 */
const CANONICAL_SUBJECT_NAMES = {
  cs: "Computer Science",
  dsa: "Data Structures and Algorithms",
  os: "Operating Systems",
  cn: "Computer Networks",
  dbms: "Database Management Systems (DBMS)",
  se: "Software Engineering",
  coa: "Computer Organization & Architecture",
  java: "Java Programming",
  cpp: "C++ Programming & OOP",
  python: "Python Programming",
  webdev: "Web Development",
  c: "C Programming",
  math1: "Calculus & Engineering Mathematics",
  statics: "Engineering Mechanics: Statics",
  dynamics: "Engineering Mechanics: Dynamics",
  mechanics: "Mechanics of Materials",
  thermo: "Thermodynamics",
  fluid: "Fluid Mechanics",
  materials: "Materials Science & Engineering",
  survey: "Surveying",
  geotech: "Geotechnical Engineering",
  rcc: "Reinforced Concrete Structures",
  steel: "Steel Structures Design",
  transport: "Transportation & Highway Engineering",
  autoCAD: "Computer Aided Design (AutoCAD)",
  archi: "Architectural Design",
  cim: "Construction Engineering Management",
  chemE: "Chemical Engineering",
  biomed: "Biomedical Engineering",
  elec: "Electrical Engineering",
  electronics: "Electronics Engineering",
  power: "Electrical Power Systems",
  control: "Control Systems",
  comms: "Communication Systems",
  introprog: "Introduction to Programming",
  algo: "Design & Analysis of Algorithms",
  dld: "Digital Logic Design (DLD)",
  compnet: "Computer Networks & Data Comms",
  rm: "Research Methodology",
  infoSec: "Information & Cyber Security",
  ai: "Artificial Intelligence (AI)",
  ml: "Machine Learning",
  ds: "Distributed Systems",
  cloud: "Cloud Computing",
  mobile: "Mobile Application Development",
  graphics: "Computer Graphics",
  crypto: "Cryptography & Network Security",
  dataScience: "Data Science & Big Data",
  nlp: "Natural Language Processing (NLP)",
  hci: "Human Computer Interaction",
  automata: "Automata & Formal Languages",
  compiler: "Compiler Design",
  embedded: "Embedded Systems",
  iot: "Internet of Things (IoT)",
  finMgmt: "Financial Management",
  stats: "Probability & Statistics",
  linAlg: "Linear Algebra",
  discMath: "Discrete Mathematics",
  appliedMath: "Applied Mathematics",
  diffEq: "Differential Equations",
  complexVar: "Complex Variables"
};

/**
 * Normalizes query string for indexing and matching
 */
function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * In-memory index of searchable academic items
 */
class SuggestionEngine {
  constructor() {
    this.index = [];
    this.initialized = false;
    this.buildIndex();
  }

  /**
   * Pre-compiles the in-memory autocomplete index powered by the centralized taxonomy
   */
  buildIndex() {
    const items = [];
    const seenTexts = new Set();

    const addItem = (item) => {
      const norm = normalizeText(item.text);
      if (!norm || seenTexts.has(norm)) return;
      seenTexts.add(norm);

      const words = norm.split(" ").filter(Boolean);
      items.push({
        text: item.text,
        normalized: norm,
        words,
        type: item.type, // 'subject' | 'course' | 'popular'
        subjectKey: item.subjectKey || null,
        keywords: item.keywords || [],
        baseScore: item.baseScore || 0
      });
    };

    // 1. Centralized Taxonomy: 4 Official Collections (Highest Authority)
    for (const col of COLLECTIONS) {
      const colKeywords = [
        ...(col.aliases || []),
        ...(col.documentTypes || []),
        ...(col.languages || [])
      ].map(k => normalizeText(k)).filter(Boolean);

      addItem({
        text: col.name,
        type: "subject",
        subjectKey: col.id,
        keywords: colKeywords,
        baseScore: 100
      });
    }

    // 2. Centralized Taxonomy: 21 Primary Subject Categories
    for (const cat of SUBJECT_CATEGORIES) {
      const catAliases = Object.values(TAXONOMY_ALIASES).filter(a => a.targetId === cat.id);
      const extraKw = [];
      for (const a of catAliases) {
        if (a.aliases) extraKw.push(...a.aliases);
        if (a.keywords) extraKw.push(...a.keywords);
        if (a.canonicalExpansion) extraKw.push(a.canonicalExpansion);
      }

      const catKeywords = [
        ...(cat.keywords || []),
        ...(cat.disciplines || []),
        ...(cat.departments || []),
        ...(cat.aliases || []),
        ...extraKw
      ].map(k => normalizeText(k)).filter(Boolean);

      addItem({
        text: cat.name,
        type: "subject",
        subjectKey: cat.id,
        keywords: catKeywords,
        baseScore: 100
      });
    }

    // 3. Centralized Taxonomy: Freshman Streams
    for (const stream of FRESHMAN_STREAMS) {
      addItem({
        text: stream.name,
        type: "course",
        subjectKey: stream.id,
        keywords: [normalizeText(stream.name), normalizeText(stream.id)],
        baseScore: 95
      });
    }

    // 4. Centralized Taxonomy: 18 University Freshman Courses
    for (const course of FRESHMAN_COURSES) {
      const courseAliases = Object.values(TAXONOMY_ALIASES).filter(a => a.targetId === course.id);
      const extraKw = [];
      for (const a of courseAliases) {
        if (a.aliases) extraKw.push(...a.aliases);
        if (a.keywords) extraKw.push(...a.keywords);
        if (a.canonicalExpansion) extraKw.push(a.canonicalExpansion);
      }

      const courseKeywords = [
        ...(course.keywords || []),
        ...(course.aliases || []),
        ...(course.exampleCourseCodes || []),
        course.canonicalExpansion,
        ...extraKw
      ].map(k => normalizeText(k)).filter(Boolean);

      addItem({
        text: course.name,
        type: "course",
        subjectKey: course.id,
        keywords: courseKeywords,
        baseScore: 95
      });
    }

    // 5. Core legacy acronyms for ultra-fast exact keystroke completion (DBMS, DSA, OOP, etc.)
    const CORE_ACRONYMS = [
      { text: "DBMS", subjectKey: "dbms", keywords: ["database", "sql"] },
      { text: "DSA", subjectKey: "dsa", keywords: ["data structures", "algorithms"] },
      { text: "OOP", subjectKey: "cpp", keywords: ["object oriented programming"] },
      { text: "OS", subjectKey: "os", keywords: ["operating systems"] },
      { text: "CN", subjectKey: "cn", keywords: ["computer networks"] },
      { text: "SE", subjectKey: "se", keywords: ["software engineering"] },
      { text: "COA", subjectKey: "coa", keywords: ["computer organization", "computer architecture"] },
      { text: "AI", subjectKey: "ai", keywords: ["artificial intelligence"] },
      { text: "DLD", subjectKey: "dld", keywords: ["digital logic design"] }
    ];
    for (const acr of CORE_ACRONYMS) {
      addItem({
        text: acr.text,
        type: "subject",
        subjectKey: acr.subjectKey,
        keywords: acr.keywords.map(k => normalizeText(k)),
        baseScore: 105
      });
    }

    // 6. Specialized University Course Disciplines from CANONICAL_SUBJECT_NAMES
    for (const [subjectKey, canonicalName] of Object.entries(CANONICAL_SUBJECT_NAMES)) {
      const subjectDef = SUBJECT_ALIASES[subjectKey] || {};
      const kw = [
        ...(subjectDef.keywords || []),
        ...(subjectDef.aliases || [])
      ].map(k => normalizeText(k)).filter(Boolean);

      addItem({
        text: canonicalName,
        type: "subject",
        subjectKey,
        keywords: kw,
        baseScore: 90
      });
    }

    // 7. Canonical Disciplines from TAXONOMY_ALIASES
    for (const [key, aliasDef] of Object.entries(TAXONOMY_ALIASES)) {
      const kw = [
        ...(aliasDef.aliases || []),
        ...(aliasDef.keywords || [])
      ].map(k => normalizeText(k)).filter(Boolean);

      addItem({
        text: aliasDef.name,
        type: "subject",
        subjectKey: aliasDef.targetId || key,
        keywords: kw,
        baseScore: 90
      });
    }

    // 8. Curated High-Frequency Popular Academic Search Queries
    for (const pop of CURATED_POPULAR_QUERIES) {
      addItem({
        text: pop.text,
        type: pop.type || "popular",
        subjectKey: pop.subjectKey,
        baseScore: 90
      });
    }

    this.index = items;
    this.initialized = true;
  }

  /**
   * Get suggestions for a user query
   *
   * @param {string} query User input string
   * @param {object} options Options { limit: number, recentSearches: string[] }
   * @returns {Array<{ text: string, type: string, subjectKey?: string }>}
   */
  getSuggestions(query = "", options = {}) {
    const limit = Math.min(20, Math.max(1, options.limit || 6));
    const recentSearches = Array.isArray(options.recentSearches) ? options.recentSearches : [];

    const raw = (query || "").trim();
    const queryNorm = normalizeText(raw);

    // If query is empty, return recent searches + top popular suggestions
    if (!queryNorm) {
      const results = [];
      const seen = new Set();

      // Recent searches first (up to 3)
      for (const recent of recentSearches) {
        if (!recent || typeof recent !== "string") continue;
        const trimmed = recent.trim();
        const norm = normalizeText(trimmed);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        results.push({
          text: trimmed,
          type: "recent"
        });
        if (results.length >= 3) break;
      }

      // Backfill with top canonical popular academic searches
      const popularFallbacks = [
        "DBMS Exam",
        "DSA Final Exam",
        "Computing & Information Sciences",
        "Mathematics for Natural Sciences",
        "Computer Networks",
        "Operating Systems",
        "Software Engineering",
        "General Physics Mid Exam",
        "Logic and Critical Thinking",
        "Past Exams, Entrance & Exit",
        "Communicative English Language Skills",
        "Ethiopian Fiction & Reading"
      ];

      for (const pop of popularFallbacks) {
        if (results.length >= limit) break;
        const norm = normalizeText(pop);
        if (!seen.has(norm)) {
          seen.add(norm);
          results.push({
            text: pop,
            type: "popular"
          });
        }
      }

      return results.slice(0, limit);
    }

    // Non-empty query: Score candidates
    const queryWords = queryNorm.split(" ").filter(Boolean);
    const scored = [];

    for (const item of this.index) {
      const score = this.calculateMatchScore(queryNorm, queryWords, item);
      if (score > 0) {
        scored.push({
          text: item.text,
          type: item.type,
          subjectKey: item.subjectKey,
          score
        });
      }
    }

    // Sort by descending score, then ascending length (prefer succinct matches)
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.text.length - b.text.length;
    });

    // Deduplicate and format output
    const output = [];
    const seen = new Set();

    for (const item of scored) {
      const norm = normalizeText(item.text);
      if (!seen.has(norm)) {
        seen.add(norm);
        output.push({
          text: item.text,
          type: item.type,
          subjectKey: item.subjectKey
        });
        if (output.length >= limit) break;
      }
    }

    return output;
  }

  /**
   * Calculates relevance score of an index item against a normalized query
   */
  calculateMatchScore(queryNorm, queryWords, item) {
    const itemNorm = item.normalized;
    const itemWords = item.words;
    let score = item.baseScore;

    // 1. Exact match
    if (itemNorm === queryNorm) {
      return score + 1000;
    }

    // 2. Direct prefix match: Item starts exactly with query (e.g. "comp" -> "Computer Science")
    if (itemNorm.startsWith(queryNorm)) {
      const distancePenalty = Math.min(50, itemNorm.length - queryNorm.length);
      return score + 800 - distancePenalty;
    }

    // 3. Acronym match (e.g. "dbms" -> Database Management Systems)
    const acronym = itemWords.map(w => w[0]).join("");
    if (acronym === queryNorm || (queryNorm.length >= 2 && acronym.startsWith(queryNorm))) {
      return score + 700;
    }

    // 4. Multi-token queries (e.g. "comp net" -> "computer networks", "math nat" -> "mathematics natural")
    if (queryWords.length > 1) {
      let allWordsMatched = true;
      let matchedIndices = [];

      for (const qWord of queryWords) {
        const foundIdx = itemWords.findIndex((iWord, idx) => !matchedIndices.includes(idx) && iWord.startsWith(qWord));
        if (foundIdx >= 0) {
          matchedIndices.push(foundIdx);
        } else {
          allWordsMatched = false;
          break;
        }
      }

      if (allWordsMatched) {
        let orderBonus = 0;
        let inOrder = true;
        for (let i = 1; i < matchedIndices.length; i++) {
          if (matchedIndices[i] <= matchedIndices[i - 1]) {
            inOrder = false;
            break;
          }
        }
        if (inOrder) orderBonus = 50;
        return score + 650 + orderBonus;
      }
    }

    // 5. Word-start match (e.g. "Interaction" in "Human Computer Interaction")
    const wordStartIndex = itemWords.findIndex(w => w.startsWith(queryNorm));
    if (wordStartIndex >= 0) {
      return score + 500 - (wordStartIndex * 20);
    }

    // 6. Keywords & Aliases match (e.g. "math nat" or "sql" or "geography of ethiopia")
    if (item.keywords && item.keywords.length > 0) {
      for (const kw of item.keywords) {
        if (kw === queryNorm) {
          return score + 750;
        }
        if (kw.startsWith(queryNorm)) {
          return score + 600;
        }
        if (queryWords.length > 1 && queryWords.every(qw => kw.includes(qw))) {
          return score + 550;
        }
        if (queryWords.length === 1 && kw.includes(queryNorm)) {
          return score + 250;
        }
      }
    }

    // 7. Substring match
    if (itemNorm.includes(queryNorm)) {
      return score + 300;
    }

    return 0;
  }

  /**
   * Returns top popular suggestions
   */
  getPopularSuggestions(limit = 6) {
    return this.getSuggestions("", { limit });
  }
}

// Singleton instance
const suggestionEngine = new SuggestionEngine();

module.exports = {
  suggestionEngine,
  getSuggestions: (query, options) => suggestionEngine.getSuggestions(query, options),
  getPopularSuggestions: (limit) => suggestionEngine.getPopularSuggestions(limit),
  CANONICAL_SUBJECT_NAMES,
  CURATED_POPULAR_QUERIES
};
