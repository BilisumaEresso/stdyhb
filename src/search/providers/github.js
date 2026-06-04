const axios = require("axios");

const GITHUB_API = "https://api.github.com";

// Keywords that indicate learning materials
const POSITIVE_KEYWORDS = [
  "notes",
  "exam",
  "question",
  "solution",
  "assignment",
  "study",
  "university",
  "dbms",
  "os",
  "cn",
  "ds",
  "lecture",
  "course",
  "tutorial",
];

// Keywords that indicate software projects (exclude these)
const EXCLUDED_KEYWORDS = [
  "project",
  "system",
  "software",
  "application",
  "framework",
  "library",
  "api",
];

/**
 * Check if repo is a learning material (contains positive keywords)
 */
function isLearningMaterial(nameAndDesc) {
  return POSITIVE_KEYWORDS.some((keyword) => nameAndDesc.includes(keyword));
}

/**
 * Check if repo should be excluded (contains excluded keywords)
 */
function shouldExclude(nameAndDesc) {
  // Exclude if contains excluded keywords WITHOUT learning keywords
  const hasExcluded = EXCLUDED_KEYWORDS.some((keyword) =>
    nameAndDesc.includes(keyword)
  );
  const hasPositive = isLearningMaterial(nameAndDesc);

  // Only exclude if it has exclusion keywords but NO learning keywords
  return hasExcluded && !hasPositive;
}

/**
 * Determine score for GitHub search result
 * Prioritizes study materials, exams, notes over general repos
 */
function calculateGitHubScore(repo) {
  const nameAndDesc = `${repo.name} ${repo.description || ""}`.toLowerCase();

  // First pass: filter out non-learning materials
  if (!isLearningMaterial(nameAndDesc)) {
    return 0;
  }

  if (shouldExclude(nameAndDesc)) {
    return 0;
  }

  let score = 0;

  // 🥇 HIGHEST VALUE: Exam papers, solutions, notes
  if (nameAndDesc.includes("exam")) {
    score = 50;
  } else if (nameAndDesc.includes("question")) {
    score = 50;
  } else if (nameAndDesc.includes("solution")) {
    score = 45;
  } else if (nameAndDesc.includes("notes")) {
    score = 45;
  } else if (nameAndDesc.includes("assignment")) {
    score = 40;
  }
  // 🥈 MEDIUM VALUE: Lectures, courses, study materials
  else if (nameAndDesc.includes("lecture")) {
    score = 35;
  } else if (nameAndDesc.includes("course")) {
    score = 35;
  } else if (nameAndDesc.includes("study")) {
    score = 30;
  } else if (nameAndDesc.includes("university")) {
    score = 30;
  } else {
    score = 20; // Fallback for other learning materials
  }

  // Course code detection (slight boost)
  if (nameAndDesc.match(/\b(dbms|os|cn|ds|dsa|oop|db|sql|algorithm)\b/)) {
    score += 5;
  }

  // Popularity bonus (but don't let it dominate)
  if (repo.stargazers_count > 500) {
    score += 10;
  } else if (repo.stargazers_count > 100) {
    score += 5;
  } else if (repo.stargazers_count > 50) {
    score += 2;
  }

  return score;
}

/**
 * Search GitHub for study repositories (No API key required)
 * Rate limit: 60 requests/hour for unauthenticated
 * STRICT FILTERING: Only returns learning materials, excludes software projects
 */
async function searchGitHub(query) {
  try {
    // Build GitHub search query for academic content
    const searchQuery = `${query} exam OR notes OR solution OR assignment`;
    console.log(`  🔍 GitHub query: "${searchQuery}"`);

    const response = await axios.get(`${GITHUB_API}/search/repositories`, {
      params: {
        q: searchQuery,
        sort: "stars",
        order: "desc",
        per_page: 15, // Get more to filter through
      },
      headers: {
        "User-Agent": "StudyHub-Bot",
        Accept: "application/vnd.github.v3+json",
      },
      timeout: 8000,
    });

    console.log(`  📦 GitHub returned: ${response.data.items?.length || 0} repos (before filtering)`);

    const results = [];

    if (response.data.items && Array.isArray(response.data.items)) {
      response.data.items.forEach((repo) => {
        const score = calculateGitHubScore(repo);

        // Only include if score > 0 (passed all filters)
        if (score > 0) {
          results.push({
            title: `${repo.owner.login}/${repo.name}`,
            url: repo.html_url,
            source: "github",
            type: "github",
            score,
          });
        }
      });
    }

    console.log(`  ✅ GitHub: ${results.length} learning repos (filtered)`);
    if (results.length > 0) {
      console.log(`     Top result: "${results[0].title}" (score: ${results[0].score})`);
    }
    return results;
  } catch (error) {
    if (error.response?.status === 422) {
      console.error(`  ❌ GitHub: Invalid query format`);
    } else if (error.response?.status === 403) {
      console.error(`  ❌ GitHub: Rate limit exceeded`);
    } else {
      console.error(`  ❌ GitHub error: ${error.message}`);
    }
    return [];
  }
}

module.exports = { searchGitHub };
