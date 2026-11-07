/**
 * TelegramResourceQuarantine
 * Safety backup collection for resources that have been deactivated
 * during purification. No document is permanently deleted — this
 * collection acts as a rollback point. Everything here can be
 * restored to TelegramResource if a rule is found to be over-aggressive.
 */
const mongoose = require("mongoose");

const TelegramResourceQuarantineSchema = new mongoose.Schema({
  // Original document fields (snapshot at quarantine time)
  originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  fileId: { type: String },
  fileUniqueId: { type: String },
  messageId: { type: Number },
  chatId: { type: Number },
  channelUsername: { type: String },
  fileName: { type: String, default: "" },
  cleanTitle: { type: String, default: "" },
  caption: { type: String, default: "" },
  fileType: { type: String },
  fileSize: { type: Number, default: 0 },
  groupId: { type: String, default: null },
  groupIndex: { type: Number, default: 0 },
  groupTotal: { type: Number, default: 1 },
  tags: [{ type: String }],
  isExam: { type: Boolean, default: false },
  courseCode: { type: String, default: "" },
  year: { type: Number, default: null },
  university: { type: String, default: "" },
  semester: { type: String, default: "" },
  relevanceScore: { type: Number, default: 0 },
  downloadCount: { type: Number, default: 0 },
  reportCount: { type: Number, default: 0 },
  archiveMessageId: { type: Number, default: null },
  indexedAt: { type: Date },
  messageDate: { type: Date },

  // Quarantine audit fields
  quarantineReason: { type: String, required: true }, // e.g. 'commercial_ad', 'admin_notice', 'schedule_only', 'corrupt_stub'
  quarantineDetail: { type: String, default: "" },    // matched pattern or specific reason
  quarantinedAt: { type: Date, default: Date.now },
  restorable: { type: Boolean, default: true },        // set false only if confirmed garbage after review
});

module.exports = mongoose.model(
  "TelegramResourceQuarantine",
  TelegramResourceQuarantineSchema
);
