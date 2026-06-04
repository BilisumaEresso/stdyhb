const mongoose = require("mongoose");

const TelegramResourceSchema = new mongoose.Schema(
  {
    // Telegram source information
    messageId: {
      type: String,
      required: true,
      index: true,
    },
    chatId: {
      type: String,
      required: true,
      index: true,
    },
    channelUsername: {
      type: String,
      index: true, // Fast lookup by channel
    },

    // File information
    fileId: {
      type: String,
      required: true,
      unique: true, // Prevent duplicates from Telegram
      index: true,
    },
    fileName: {
      type: String,
    },
    mimeType: {
      type: String,
    },
    fileType: {
      type: String,
      enum: ["pdf", "ppt", "image", "video", "doc", "other"],
      index: true, // Fast filtering by type
    },

    // Grouping for multi-part resources (e.g., exam sets)
    groupId: {
      type: String,
      index: true,
    },

    // Content metadata
    caption: {
      type: String,
      default: "",
    },
    title: {
      type: String,
    },
    tags: {
      type: [String],
      default: [],
    },

    // Academic context
    department: {
      type: String,
    },
    year: {
      type: Number,
      min: 1,
      max: 8,
    },
    isExam: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We handle createdAt manually
  },
);

// Text index for full-text search across caption, fileName, and tags
TelegramResourceSchema.index({
  caption: "text",
  fileName: "text",
  tags: "text",
  title: "text",
});

// Compound index for common queries
TelegramResourceSchema.index({
  fileType: 1,
  isExam: 1,
  createdAt: -1,
});

TelegramResourceSchema.index({
  channelUsername: 1,
  createdAt: -1,
});

TelegramResourceSchema.index({
  department: 1,
  year: 1,
  fileType: 1,
});

module.exports = mongoose.model("TelegramResource", TelegramResourceSchema);
