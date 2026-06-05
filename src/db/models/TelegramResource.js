const mongoose = require("mongoose");

const TelegramResourceSchema = new mongoose.Schema({
  // Telegram identifiers
  fileId: { type: String, required: true, unique: true },
  fileUniqueId: { type: String, required: true },
  messageId: { type: Number, required: true },
  chatId: { type: Number, required: true },
  channelUsername: { type: String, required: true },

  // File metadata
  fileName: { type: String, default: "" },
  caption: { type: String, default: "" },
  fileType: {
    type: String,
    enum: ["pdf", "ppt", "doc", "image", "other"],
    default: "other",
  },
  fileSize: { type: Number, default: 0 },

  // Grouping (for exam photo sets)
  groupId: { type: String, default: null }, // same groupId = same exam set
  groupIndex: { type: Number, default: 0 }, // position within group
  groupTotal: { type: Number, default: 1 }, // total files in group

  // Search metadata
  tags: [{ type: String }],
  isExam: { type: Boolean, default: false },
  courseCode: { type: String, default: "" }, // e.g. "CS301", "DBMS"
  year: { type: Number, default: null }, // e.g. 2023

  // Scoring
  relevanceScore: { type: Number, default: 0 },
  downloadCount: { type: Number, default: 0 },

  indexedAt: { type: Date, default: Date.now },
  messageDate: { type: Date, default: null },
});

TelegramResourceSchema.index({ tags: 1 });
TelegramResourceSchema.index({ channelUsername: 1 });
TelegramResourceSchema.index({ courseCode: 1 });
TelegramResourceSchema.index({ isExam: 1, fileType: 1 });

module.exports = mongoose.model("TelegramResource", TelegramResourceSchema);
