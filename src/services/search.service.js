const SearchHistory = require("../db/models/SearchHistory");
const User = require("../db/models/User");

class SearchService {
  /**
   * Save search history to database
   */
  async saveSearchHistory(userId, query) {
    try {
      const normalizedQuery = query.toLowerCase().trim();

      const searchHistory = new SearchHistory({
        userId,
        query,
        normalizedQuery,
        sources: [],
        resultCount: 0,
        searchedAt: new Date(),
      });

      return await searchHistory.save();
    } catch (error) {
      console.error("Error saving search history:", error);
      throw error;
    }
  }

  /**
   * Increment user's search count and update lastActive
   */
  async incrementUserSearchCount(userId) {
    try {
      return await User.findByIdAndUpdate(
        userId,
        {
          $inc: { searchCount: 1 },
          lastActive: new Date(),
        },
        { returnDocument: "after" },
      );
    } catch (error) {
      console.error("Error incrementing search count:", error);
      throw error;
    }
  }

  /**
   * Combined operation: save search and increment count
   */
  async recordSearch(userId, query) {
    try {
      const searchRecord = await this.saveSearchHistory(userId, query);
      await this.incrementUserSearchCount(userId);

      return searchRecord;
    } catch (error) {
      console.error("Error recording search:", error);
      throw error;
    }
  }
}

module.exports = new SearchService();
