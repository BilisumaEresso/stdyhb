/**
 * Duplicate detection and removal for search results
 */

const stringSimilarity = require("string-similarity");

// Channel priority: prefer official/primary channels
const CHANNEL_PRIORITY = {
  official: 100,
  exam_archive: 90,
  lecture_notes: 80,
  general: 50,
};

/**
 * Normalize filename for comparison
 */
function normalizeFilename(filename) {
  if (!filename) return "";
  return filename
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]/g, " ")
    .trim();
}

/**
 * Get channel priority score
 */
function getChannelPriority(channelUsername) {
  // Check if channel name contains priority keyword
  const lower = (channelUsername || "").toLowerCase();
  if (lower.includes("official")) return CHANNEL_PRIORITY.official;
  if (lower.includes("exam")) return CHANNEL_PRIORITY.exam_archive;
  if (lower.includes("lecture") || lower.includes("notes")) {
    return CHANNEL_PRIORITY.lecture_notes;
  }
  return CHANNEL_PRIORITY.general;
}

/**
 * Check if two resources are duplicates
 */
function areDuplicates(resource1, resource2, similarityThreshold = 0.85) {
  // Same fileUniqueId is exact duplicate
  if (resource1.fileUniqueId === resource2.fileUniqueId) {
    return true;
  }

  // Compare normalized filenames
  const name1 = normalizeFilename(resource1.fileName);
  const name2 = normalizeFilename(resource2.fileName);

  if (name1 && name2) {
    const similarity = stringSimilarity.compareTwoStrings(name1, name2);
    if (similarity > similarityThreshold) {
      return true;
    }
  }

  // Compare normalized captions (if similar names but different files)
  if (resource1.caption && resource2.caption) {
    const caption1 = normalizeFilename(resource1.caption);
    const caption2 = normalizeFilename(resource2.caption);
    const captionSimilarity = stringSimilarity.compareTwoStrings(
      caption1,
      caption2,
    );

    if (captionSimilarity > 0.8) {
      return true;
    }
  }

  return false;
}

/**
 * Deduplicate resources, keeping the best one
 */
function deduplicateResources(resources) {
  if (!resources || resources.length < 2) {
    return resources;
  }

  const groups = [];
  const seen = new Set();

  for (let i = 0; i < resources.length; i++) {
    if (seen.has(i)) continue;

    const group = [resources[i]];
    seen.add(i);

    // Find all duplicates of this resource
    for (let j = i + 1; j < resources.length; j++) {
      if (seen.has(j)) continue;

      if (areDuplicates(resources[i], resources[j])) {
        group.push(resources[j]);
        seen.add(j);
      }
    }

    // Pick the best resource from group
    const best = selectBestResource(group);
    groups.push(best);
  }

  return groups;
}

/**
 * Select the best resource from a duplicate group
 * Priority: downloads > exam flag > channel priority > fileType > newest
 */
function selectBestResource(duplicateGroup) {
  if (duplicateGroup.length === 1) {
    return duplicateGroup[0];
  }

  // Score each resource
  const scored = duplicateGroup.map((res) => {
    let score = 0;

    // Download count is most important
    score += (res.downloadCount || 0) * 10;

    // Exam materials are prioritized
    if (res.isExam) score += 50;

    // Channel priority
    score += getChannelPriority(res.channelUsername);

    // File type quality
    const typeScore = { pdf: 30, ppt: 25, doc: 20, image: 10, other: 5 };
    score += typeScore[res.fileType] || 0;

    // Newer is better (small bonus)
    if (res.messageDate) {
      const age = Date.now() - new Date(res.messageDate).getTime();
      const ageMonths = age / (30 * 24 * 60 * 60 * 1000);
      score += Math.max(0, 5 - ageMonths);
    }

    return { resource: res, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored[0].resource;
}

/**
 * Get duplicate statistics
 */
function getDuplicateStats(originalCount, deduplicatedList) {
  return {
    original: originalCount,
    deduplicated: deduplicatedList.length,
    removed: originalCount - deduplicatedList.length,
  };
}

module.exports = {
  deduplicateResources,
  areDuplicates,
  selectBestResource,
  getDuplicateStats,
};
