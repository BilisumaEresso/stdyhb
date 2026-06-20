const mongoose = require("mongoose");

const querySessionSchema = new mongoose.Schema({
  queryHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  query: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 3600 } // 1 hour TTL
  }
});

module.exports = mongoose.model("QuerySession", querySessionSchema);
