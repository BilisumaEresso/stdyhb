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

  /**
   * Get distinct recent searches for a specific user
   */
  async getUserRecentSearches(userId, limit = 4) {
    try {
      const mongoose = require("mongoose");
      const userObjectId =
        typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

      const results = await SearchHistory.aggregate([
        { $match: { userId: userObjectId } },
        { $sort: { searchedAt: -1 } },
        {
          $group: {
            _id: "$normalizedQuery",
            query: { $first: "$query" },
            searchedAt: { $first: "$searchedAt" },
          },
        },
        { $sort: { searchedAt: -1 } },
        { $limit: limit },
      ]);

      return results.map((r) => r.query);
    } catch (error) {
      console.error("Error getting user recent searches:", error);
      return [];
    }
  }

  /**
   * Get dynamic global search suggestions based on real user searches and top Telegram resources
   */
  async getGlobalSuggestions(limit = 4) {
    try {
      const now = Date.now();
      if (
        this._globalSuggestionsCache &&
        now - this._globalSuggestionsCacheTime < 3600000
      ) {
        return this._globalSuggestionsCache;
      }

      const TelegramResource = require("../db/models/TelegramResource");

      // System buttons/labels to ignore
      const ignoredKeywords = [
        "suggest channel",
        "📢 suggest channel",
        "search",
        "🔍 search",
        "saves",
        "📚 my saves",
        "trending",
        "🔥 trending",
        "profile",
        "👤 profile",
        "help",
        "ℹ️ help",
        "start",
        "/start",
        "/search",
      ];

      // 1. Fetch top searches from SearchHistory
      const topSearches = await SearchHistory.aggregate([
        {
          $match: {
            normalizedQuery: { $nin: ignoredKeywords },
            $expr: { $gt: [{ $strLenCP: "$normalizedQuery" }, 2] },
          },
        },
        {
          $group: {
            _id: "$normalizedQuery",
            count: { $sum: 1 },
            query: { $first: "$query" },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit * 2 },
      ]);

      const suggestions = [];
      const seen = new Set();

      for (const item of topSearches) {
        const clean = item.query.trim();
        const norm = clean.toLowerCase();
        if (!seen.has(norm) && !ignoredKeywords.some((ign) => norm.includes(ign))) {
          seen.add(norm);
          suggestions.push(clean);
          if (suggestions.length >= limit) break;
        }
      }

      // 2. If we need more, backfill from top academic resource tags
      if (suggestions.length < limit) {
        const topTags = await TelegramResource.aggregate([
          { $unwind: "$tags" },
          {
            $match: {
              tags: {
                $nin: [
                  "exam",
                  "final",
                  "mid",
                  "notes",
                  "slide",
                  "assignment",
                  "test",
                  "quiz",
                  "questions",
                  "exit",
                ],
              },
            },
          },
          { $group: { _id: "$tags", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]);

        for (const tagItem of topTags) {
          const rawTag = tagItem._id.replace(/_/g, " ");
          const candidate = rawTag.charAt(0).toUpperCase() + rawTag.slice(1);
          const norm = candidate.toLowerCase();
          if (!seen.has(norm)) {
            seen.add(norm);
            suggestions.push(candidate);
            if (suggestions.length >= limit) break;
          }
        }
      }

      // 3. Fallback if database is fresh
      const fallbacks = ["DBMS Exam", "Physics Exam", "Logic", "OOP"];
      for (const fb of fallbacks) {
        if (suggestions.length >= limit) break;
        if (!seen.has(fb.toLowerCase())) {
          seen.add(fb.toLowerCase());
          suggestions.push(fb);
        }
      }

      this._globalSuggestionsCache = suggestions.slice(0, limit);
      this._globalSuggestionsCacheTime = now;

      return this._globalSuggestionsCache;
    } catch (error) {
      console.error("Error getting global suggestions:", error);
      return ["DBMS Exam", "Physics Exam", "Logic", "OOP"];
    }
  }

  /**
   * Clear user's entire search history
   */
  async clearUserSearchHistory(userId) {
    try {
      const mongoose = require("mongoose");
      const userObjectId =
        typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
      return await SearchHistory.deleteMany({ userId: userObjectId });
    } catch (error) {
      console.error("Error clearing user search history:", error);
      throw error;
    }
  }
}

module.exports = new SearchService();
