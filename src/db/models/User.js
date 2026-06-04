const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    username: {
      type: String,
      default: "",
    },

    firstName: {
      type: String,
      default: "",
    },

    lastName: {
      type: String,
      default: "",
    },

    university: {
      type: String,
      default: "",
    },

    department: {
      type: String,
      default: "",
    },

    year: {
      type: Number,
      default: null,
    },

    semester: {
      type: Number,
      default: null,
    },

    searchCount: {
      type: Number,
      default: 0,
    },

    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("User", userSchema);
