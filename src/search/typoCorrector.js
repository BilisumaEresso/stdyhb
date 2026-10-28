/**
 * Lightweight typo correction for search queries
 * Uses string similarity to suggest corrections
 */

const stringSimilarity = require("string-similarity");
const { SUBJECT_ALIASES } = require("../config/subjectAliases");

// Build dictionary of all known subjects and aliases
const KNOWN_TERMS = {};
const CANONICAL_MAP = {};
const VOCABULARY = new Set();

for (const [subject, subjectData] of Object.entries(SUBJECT_ALIASES)) {
  KNOWN_TERMS[subject] = 1;
  VOCABULARY.add(subject.toLowerCase());
  CANONICAL_MAP[subject.toLowerCase()] = subject;

  const aliases = subjectData.aliases;
  aliases.forEach((alias) => {
    const a = alias.toLowerCase().trim();
    KNOWN_TERMS[a] = 1;
    VOCABULARY.add(a);
    CANONICAL_MAP[a] = a;
  });

  if (Array.isArray(subjectData.typos)) {
    subjectData.typos.forEach((typo) => {
      const t = typo.toLowerCase().trim();
      CANONICAL_MAP[t] = aliases[0] || subject;
    });
  }
}

// Top academic subjects and search intent terms
const TOP_ACADEMIC_TERMS = [
  "physics",
  "calculus",
  "chemistry",
  "biology",
  "logic",
  "nursing",
  "economics",
  "civics",
  "management",
  "entrepreneurship",
  "communicative english",
  "data structures",
  "operating systems",
  "database",
  "computer networks",
  "software engineering",
  "programming",
  "python",
  "java",
  "c++",
  "exam",
  "mid",
  "final",
  "notes",
  "slides",
];

TOP_ACADEMIC_TERMS.forEach((s) => {
  VOCABULARY.add(s);
  if (!CANONICAL_MAP[s]) CANONICAL_MAP[s] = s;
});

// Common typos - explicit mappings for frequent mistakes
const COMMON_CORRECTIONS = {
  databse: "database",
  dbsm: "dbms",
  algorthm: "algorithm",
  algoritm: "algorithm",
  strcture: "structure",
  programing: "programming",
  grph: "graph",
  netowrk: "network",
  compilor: "compiler",
  sofware: "software",
  eaxm: "exam",
  finl: "final",
  phsyics: "physics",
  physic: "physics",
  calcullus: "calculus",
  calclus: "calculus",
  chemstry: "chemistry",
  pythn: "python",
  pyhton: "python",
};

Object.entries(COMMON_CORRECTIONS).forEach(([typo, target]) => {
  CANONICAL_MAP[typo] = target;
});

const vocabList = Array.from(VOCABULARY);
const singleWordVocab = vocabList.filter((v) => !v.includes(" "));

/**
 * Correct typos in query with high confidence
 */
function correctTypos(query) {
  const words = query.toLowerCase().split(/\s+/);
  let corrected = [];
  let corrections = [];

  for (const word of words) {
    // Check explicit common corrections first
    if (COMMON_CORRECTIONS[word]) {
      corrected.push(COMMON_CORRECTIONS[word]);
      corrections.push({ from: word, to: COMMON_CORRECTIONS[word] });
      continue;
    }

    // Try to find similar known term
    const matches = stringSimilarity.findBestMatch(
      word,
      Object.keys(KNOWN_TERMS),
    );

    // Only correct if confidence is high (> 0.75) and word is at least 4 chars
    if (matches.bestMatch.rating > 0.75 && word.length >= 4) {
      const suggestion = matches.bestMatch.target;
      // Don't correct if word is already close to original (avoid aggressive corrections)
      if (Math.abs(word.length - suggestion.length) <= 2) {
        corrected.push(suggestion);
        corrections.push({ from: word, to: suggestion });
        continue;
      }
    }

    corrected.push(word);
  }

  return {
    original: query,
    corrected: corrected.join(" "),
    corrections,
    hasCorrected: corrections.length > 0,
  };
}

/**
 * Intelligent "Did you mean..." suggestions when a search returns 0 results
 */
function getZeroResultSuggestions(query, limit = 3) {
  if (!query || typeof query !== "string") return [];
  const clean = query.trim().toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean);
  const candidates = [];
  const seen = new Set([clean]);

  // Strategy 1: Word-by-word correction (preserves intent & fixes typos within phrases)
  const correctedWords = words.map((w) => {
    if (CANONICAL_MAP[w]) return CANONICAL_MAP[w];
    if (w.length >= 4 && singleWordVocab.length > 0) {
      const match = stringSimilarity.findBestMatch(w, singleWordVocab);
      if (match.bestMatch.rating > 0.72) {
        return match.bestMatch.target;
      }
    }
    return w;
  });

  const wordCorrected = correctedWords.join(" ");
  if (wordCorrected !== clean && !seen.has(wordCorrected)) {
    seen.add(wordCorrected);
    candidates.push(wordCorrected);
  }

  // Strategy 2: Check entire phrase similarity
  if (vocabList.length > 0) {
    const phraseMatches = stringSimilarity.findBestMatch(clean, vocabList);
    if (phraseMatches.bestMatch.rating > 0.65) {
      const target = phraseMatches.bestMatch.target;
      if (!seen.has(target)) {
        seen.add(target);
        candidates.push(target);
      }
    }
  }

  // Strategy 3: Multi-word query relaxation (remove filler words & specific years)
  if (words.length >= 3) {
    const fillerWords = new Set([
      "advanced",
      "intro",
      "introduction",
      "chapter",
      "unit",
      "part",
      "questions",
      "solutions",
      "2018",
      "2019",
      "2020",
      "2021",
      "2022",
      "2023",
      "2024",
      "2025",
      "2026",
    ]);
    const relaxed = words.filter((w) => !fillerWords.has(w)).join(" ");
    if (relaxed.length > 2 && relaxed !== clean && !seen.has(relaxed)) {
      seen.add(relaxed);
      candidates.push(relaxed);
    }
  }

  // Strategy 4: Fallback to prominent subjects
  const defaultFallbacks = ["dbms exam", "physics exam", "calculus", "logic"];
  for (const fb of defaultFallbacks) {
    if (candidates.length >= limit) break;
    if (!seen.has(fb)) {
      seen.add(fb);
      candidates.push(fb);
    }
  }

  return candidates.slice(0, limit);
}

module.exports = {
  correctTypos,
  getZeroResultSuggestions,
  KNOWN_TERMS,
};
