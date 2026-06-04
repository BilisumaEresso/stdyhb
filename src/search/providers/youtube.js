const axios = require("axios");

/**
 * Search YouTube (disabled for stability - will add later)
 */
async function searchYouTube(query) {
  try {
    console.log(`⏭️  YouTube search skipped (stability mode)`);
    return [];
  } catch (error) {
    return [];
  }
}

module.exports = { searchYouTube };
