const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  level: {
    type: String,
    required: true
  },
  learningPoints: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Assessment", assessmentSchema);
