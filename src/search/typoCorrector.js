/**
 * Lightweight typo correction for search queries
 * Uses string similarity to suggest corrections
 */

const stringSimilarity = require("string-similarity");
const { SUBJECT_ALIASES } = require("../config/subjectAliases");

// Build dictionary of all known subjects and aliases
const KNOWN_TERMS = {};
for (const [subject, subjectData] of Object.entries(SUBJECT_ALIASES)) {
  KNOWN_TERMS[subject] = 1;
  const aliases = subjectData.aliases;
  aliases.forEach((alias) => {
    KNOWN_TERMS[alias.toLowerCase()] = 1;
  });
}

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
};

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

module.exports = {
  correctTypos,
  KNOWN_TERMS,
};
