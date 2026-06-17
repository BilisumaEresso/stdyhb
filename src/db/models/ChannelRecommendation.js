const mongoose = require("mongoose");

const channelRecommendationSchema = new mongoose.Schema(
  {
    channelUsername: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["Exams", "Lecture Notes", "Both", "Other"],
      default: "Other",
    },
    university: {
      type: String,
      default: "All Universities",
    },
    recommendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ChannelRecommendation", channelRecommendationSchema);
