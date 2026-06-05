const mongoose = require("mongoose");

const TelegramChannelSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  displayName: { type: String },
  university: { type: String },
  department: { type: String },
  type: {
    type: String,
    enum: ["exam_archive", "lecture_notes", "general", "freshman"],
    default: "general",
  },
  priority: { type: Number, default: 1 },
  active: { type: Boolean, default: true },

  // Health tracking
  healthStatus: {
    type: String,
    enum: ["ACTIVE", "DEGRADED", "DEAD"],
    default: "ACTIVE",
  },
  failureCount: { type: Number, default: 0 },
  lastError: { type: String, default: null },
  lastSuccessfulScan: { type: Date, default: null },

  // Statistics
  lastScannedAt: { type: Date, default: null },
  totalIndexed: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

TelegramChannelSchema.index({ university: 1, department: 1 });
TelegramChannelSchema.index({ healthStatus: 1 });

module.exports = mongoose.model("TelegramChannel", TelegramChannelSchema);
