const mongoose = require("mongoose");

const savedResourceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    telegramResourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TelegramResource",
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    url: {
      type: String,
      required: true,
      trim: true,
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
        "image",
      ],
      default: "other",
    },

    query: {
      type: String,
      default: "",
    },

    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("SavedResource", savedResourceSchema);
