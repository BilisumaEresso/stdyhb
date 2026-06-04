const mongoose = require("mongoose");

const resourceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    source: {
      type: String,
      enum: [
        "telegram",
        "youtube",
        "github",
        "website",
        "google-drive",
        "other",
      ],
      default: "other",
    },

    type: {
      type: String,
      enum: [
        "pdf",
        "ppt",
        "exam",
        "video",
        "notes",
        "github",
        "document",
        "other",
      ],
      default: "other",
    },

    score: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const cachedSearchSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    normalizedQuery: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    resources: {
      type: [resourceSchema],
      default: [],
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // auto delete when expired
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("CachedSearch", cachedSearchSchema);
