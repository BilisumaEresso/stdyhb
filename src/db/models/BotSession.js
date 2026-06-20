const mongoose = require("mongoose");

const botSessionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: { expires: '7d' } // 7 days TTL
  }
});

// Update the updatedAt timestamp before saving
botSessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("BotSession", botSessionSchema);
