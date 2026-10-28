const mongoose = require("mongoose");

const resourceReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    telegramId: {
      type: Number,
      required: true,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TelegramResource",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: [
        "download_failed",
        "password_locked",
        "corrupt_content",
        "wrong_subject",
        "other",
      ],
      default: "download_failed",
    },
    resourceTitle: {
      type: String,
      trim: true,
    },
    channelUsername: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "reviewed", "resolved"],
      default: "pending",
      index: true,
    },
    reportedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ResourceReport", resourceReportSchema);
