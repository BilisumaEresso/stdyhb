const mongoose = require("mongoose");

const DownloadHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  telegramId: { type: Number, required: true },

  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TelegramResource",
    required: true,
  },
  fileId: { type: String, required: true },
  resourceTitle: { type: String, required: true },
  fileType: { type: String, default: "unknown" },
  channelUsername: { type: String, default: null },

  searchQuery: { type: String, default: null },
  action: {
    type: String,
    enum: ["download", "preview", "view_set"],
    default: "download",
  },

  downloadedAt: { type: Date, default: Date.now },
});

// Index for quick lookups
DownloadHistorySchema.index({ userId: 1, downloadedAt: -1 });
DownloadHistorySchema.index({ telegramId: 1, downloadedAt: -1 });
DownloadHistorySchema.index({ fileId: 1 });
DownloadHistorySchema.index({ downloadedAt: -1 });

module.exports = mongoose.model("DownloadHistory", DownloadHistorySchema);
