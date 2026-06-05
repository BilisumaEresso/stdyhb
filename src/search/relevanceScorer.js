/**
 * Score search results based on intent match
 * Boosts relevant results, penalizes unrelated ones
 */

const { SUBJECT_ALIASES } = require("../config/subjectAliases");
const { getRelatedSubjects } = require("./intentParser");

/**
 * Score a single resource against search intent
 */
function scoreResource(resource, intent) {
  let score = resource.relevanceScore || 0;

  // No intent = just use base score
  if (!intent.subject && !intent.resourceType && !intent.department) {
    return score;
  }

  // SUBJECT MATCHING (100 points max)
  if (intent.subject) {
    const subjectData = SUBJECT_ALIASES[intent.subject];
    if (!subjectData) {
      // Unknown subject - light penalty
      score -= 5;
    } else {
      const combined =
        `${resource.title || ""} ${resource.caption || ""} ${resource.tags?.join(" ") || ""}`.toLowerCase();

      // Check if subject alias matches
      if (
        subjectData.aliases?.some((alias) =>
          combined.includes(alias.toLowerCase()),
        )
      ) {
        score += 100;
      }
      // Check if subject keywords match
      else if (
        subjectData.keywords?.some((keyword) =>
          combined.includes(keyword.toLowerCase()),
        )
      ) {
        score += 60;
      }
      // Check if any related subject matches
      else {
        const related = getRelatedSubjects(intent.subject);
        let foundRelated = false;
        for (const relatedSubject of related) {
          const relData = SUBJECT_ALIASES[relatedSubject];
          if (
            relData?.aliases?.some((alias) =>
              combined.includes(alias.toLowerCase()),
            )
          ) {
            score += 70;
            foundRelated = true;
            break;
          }
        }

        // No match for subject or related subjects = heavy penalty
        if (!foundRelated) {
          score -= 100;
        }
      }
    }
  }

  // RESOURCE TYPE MATCHING (50 points max)
  if (intent.resourceType) {
    const fileType = resource.fileType || "";

    if (
      intent.resourceType === "ppt" &&
      (fileType === "ppt" || fileType === "doc")
    ) {
      score += 50;
    } else if (intent.resourceType === "pdf" && fileType === "pdf") {
      score += 50;
    } else if (
      intent.resourceType === "doc" &&
      (fileType === "doc" || fileType === "pdf")
    ) {
      score += 40;
    } else if (intent.resourceType === "image" && fileType === "image") {
      score += 50;
    } else if (intent.resourceType === "video" && fileType === "video") {
      score += 50;
    } else if (intent.resourceType === "exam" && resource.isExam) {
      score += 50;
    } else {
      // Resource type doesn't match
      score -= 15;
    }
  }

  // EXAM FLAG (if searched for exam)
  if (intent.isExam && resource.isExam) {
    score += 30;
  }

  // EXACT WORD MATCHES IN TITLE/CAPTION (30 points max)
  if (intent.keywords && intent.keywords.length > 0) {
    const combined =
      `${resource.title || ""} ${resource.caption || ""}`.toLowerCase();
    let keywordMatches = 0;

    for (const keyword of intent.keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        keywordMatches++;
      }
    }

    if (keywordMatches > 0) {
      score += Math.min(30, keywordMatches * 10);
    }
  }

  // DEPARTMENT BONUS (40 points)
  if (intent.department && resource.tags) {
    // Department terms in tags/title
    const combined =
      `${resource.title || ""} ${resource.tags.join(" ")}`.toLowerCase();
    if (combined.includes(intent.department)) {
      score += 40;
    }
  }

  return Math.max(0, score);
}

/**
 * Filter resources to hard-exclude unrelated subjects
 * Returns resources that should be included
 */
function hardFilterByIntent(resources, intent) {
  if (!intent.subject) {
    // No subject specified = don't hard filter
    return resources;
  }

  const subjectData = SUBJECT_ALIASES[intent.subject];
  if (!subjectData) {
    return resources;
  }

  const allowedKeywords = new Set();

  // Add subject aliases and keywords to allowed list
  if (subjectData.aliases) {
    subjectData.aliases.forEach((a) => allowedKeywords.add(a.toLowerCase()));
  }
  if (subjectData.keywords) {
    subjectData.keywords.forEach((k) => allowedKeywords.add(k.toLowerCase()));
  }

  // Add related subjects
  const relatedSubjects = getRelatedSubjects(intent.subject);
  for (const related of relatedSubjects) {
    const relData = SUBJECT_ALIASES[related];
    if (relData?.aliases) {
      relData.aliases.forEach((a) => allowedKeywords.add(a.toLowerCase()));
    }
    if (relData?.keywords) {
      relData.keywords.forEach((k) => allowedKeywords.add(k.toLowerCase()));
    }
  }

  // Filter: keep only resources that match allowed keywords
  return resources.filter((resource) => {
    const combined =
      `${resource.title || ""} ${resource.caption || ""} ${resource.tags?.join(" ") || ""}`.toLowerCase();

    // Check if ANY allowed keyword appears
    for (const keyword of allowedKeywords) {
      if (combined.includes(keyword)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Apply intent-aware scoring to resources
 */
function scoreAndRankResources(resources, intent) {
  // Step 1: Hard filter (remove completely unrelated)
  const filtered = hardFilterByIntent(resources, intent);

  // Step 2: Score remaining resources
  const scored = filtered.map((resource) => ({
    ...resource,
    intentScore: scoreResource(resource, intent),
  }));

  // Step 3: Sort by intent score
  scored.sort((a, b) => b.intentScore - a.intentScore);

  return scored;
}

/**
 * Get scoring statistics
 */
function getScoringStats(before, after) {
  return {
    before: before.length,
    after: after.length,
    filtered: before.length - after.length,
    topScore: after[0]?.intentScore || 0,
  };
}

module.exports = {
  scoreResource,
  hardFilterByIntent,
  scoreAndRankResources,
  getScoringStats,
};
