const mongoose = require("mongoose");

const searchHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    query: {
      type: String,
      required: true,
      trim: true,
    },

    normalizedQuery: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    sources: {
      type: [String],
      default: [],
    },

    resultCount: {
      type: Number,
      default: 0,
    },

    searchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("SearchHistory", searchHistorySchema);
