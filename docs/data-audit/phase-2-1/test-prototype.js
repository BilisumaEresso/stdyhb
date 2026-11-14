const { SUBJECT_ALIASES } = require("../../../src/config/subjectAliases");

// Add mathematics for natural sciences if missing for testing
if (!SUBJECT_ALIASES.mathNat) {
  SUBJECT_ALIASES.mathNat = {
    aliases: [
      "mathematics for natural sciences",
      "math for natural sciences",
      "mathematics for natural science",
      "math for natural science",
      "freshman mathematics",
      "math 1011"
    ],
    keywords: ["calculus", "limit", "derivative", "integral", "matrix", "vector", "function"],
    typos: ["math for natural", "mathematics natural science"]
  };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Determine a single, high-value canonical expansion term for a subject
 * that is not already present in the query.
 */
function getCanonicalExpansion(subject, matchedAlias, queryLower) {
  const subjectData = SUBJECT_ALIASES[subject];
  if (!subjectData || !subjectData.aliases || subjectData.aliases.length === 0) {
    return null;
  }

  const aliases = subjectData.aliases;
  const isMatchedShort = matchedAlias.length <= 4 && !matchedAlias.includes(" ");

  let candidate = null;

  if (isMatchedShort) {
    // User typed an acronym (e.g., "dbms", "dsa", "os", "cn")
    // Expand to the primary descriptive term (e.g., "database", "data structures")
    candidate = aliases.find(a => a.toLowerCase() !== matchedAlias.toLowerCase() && (a.includes(" ") || a.length > 4)) || aliases[0];
  } else {
    // User typed a full name (e.g., "database", "data structures")
    // Expand to the concise acronym if one exists (e.g., "dbms", "dsa")
    candidate = aliases.find(a => a.length <= 4 && !a.includes(" ") && a.toLowerCase() !== matchedAlias.toLowerCase());
  }

  if (!candidate) return null;

  const candidateLower = candidate.toLowerCase();
  if (candidateLower === matchedAlias.toLowerCase()) return null;

  // If candidate is already in the query, do not duplicate
  const safeCandidate = escapeRegExp(candidateLower);
  const candidateRegex = new RegExp(`(^|\\W)${safeCandidate}($|\\W)`, "i");
  if (candidateRegex.test(queryLower)) {
    return null;
  }

  // Also check if primary word of candidate is already present
  // (e.g. if query has "database", don't add "database systems")
  const primaryWord = candidateLower.split(/\s+/)[0];
  if (primaryWord.length >= 4) {
    const wordRegex = new RegExp(`(^|\\W)${escapeRegExp(primaryWord)}($|\\W)`, "i");
    if (wordRegex.test(queryLower)) {
      return null;
    }
  }

  return candidate;
}

function expandQueryClean(query) {
  if (!query || typeof query !== "string") {
    return {
      original: query || "",
      expanded: query || "",
      appliedAliases: []
    };
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return {
      original: query,
      expanded: "",
      appliedAliases: []
    };
  }

  const queryLower = trimmed.toLowerCase();

  // 1. Build list of all alias candidates sorted by length descending
  const candidates = [];
  for (const [subject, subjectData] of Object.entries(SUBJECT_ALIASES)) {
    if (!subjectData.aliases) continue;
    for (const alias of subjectData.aliases) {
      candidates.push({
        subject,
        alias: alias.trim(),
        length: alias.trim().length
      });
    }
  }
  // Sort longest alias first (to match multiword phrases before sub-terms)
  candidates.sort((a, b) => b.length - a.length);

  // 2. Find non-overlapping matches in the query
  const matches = [];
  const occupiedSpans = [];

  for (const item of candidates) {
    const safeAlias = escapeRegExp(item.alias);
    // Word boundary matching
    const regex = new RegExp(`(^|\\W)(${safeAlias})($|\\W)`, "ig");
    let match;

    while ((match = regex.exec(trimmed)) !== null) {
      // The actual matched alias text starts after group 1
      const leadingChar = match[1];
      const matchedText = match[2];
      const start = match.index + leadingChar.length;
      const end = start + matchedText.length;

      // Check if this span overlaps with an already matched longer span
      const overlaps = occupiedSpans.some(span => !(end <= span.start || start >= span.end));
      if (!overlaps) {
        occupiedSpans.push({ start, end });
        matches.push({
          subject: item.subject,
          alias: item.alias,
          start,
          end,
          matchedText
        });
      }
    }
  }

  if (matches.length === 0) {
    return {
      original: query,
      expanded: trimmed,
      appliedAliases: []
    };
  }

  // Sort matches by start index
  matches.sort((a, b) => a.start - b.start);

  // 3. Reconstruct the expanded query
  let result = "";
  let lastIndex = 0;
  const appliedAliases = [];

  for (const m of matches) {
    // Add text preceding this match
    result += trimmed.substring(lastIndex, m.start);

    // Determine expansion
    appliedAliases.push(m.subject);
    const expansion = getCanonicalExpansion(m.subject, m.alias, queryLower);

    if (expansion) {
      result += `${m.matchedText} ${expansion}`;
    } else {
      result += m.matchedText;
    }

    lastIndex = m.end;
  }

  // Add remaining trailing text
  result += trimmed.substring(lastIndex);

  // Normalize spaces
  const cleanExpanded = result.replace(/\s+/g, " ").trim();

  return {
    original: query,
    expanded: cleanExpanded,
    appliedAliases: [...new Set(appliedAliases)]
  };
}

// Test cases
console.log("Test A: 'dbms exam'");
console.log(expandQueryClean("dbms exam"));

console.log("\nTest B: 'dsa ppt'");
console.log(expandQueryClean("dsa ppt"));

console.log("\nTest C: 'mathematics for natural sciences'");
console.log(expandQueryClean("mathematics for natural sciences"));

console.log("\nTest D: 'computer networks final exam'");
console.log(expandQueryClean("computer networks final exam"));

console.log("\nTest E: 'quantum physics lecture 3'");
console.log(expandQueryClean("quantum physics lecture 3"));

console.log("\nTest F: '' and '   '");
console.log(expandQueryClean(""));
console.log(expandQueryClean("   "));

console.log("\nTest Bonus 1: 'database exam'");
console.log(expandQueryClean("database exam"));

console.log("\nTest Bonus 2: 'dbms database exam'");
console.log(expandQueryClean("dbms database exam"));
