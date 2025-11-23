// src/models/resume.model.js
const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // PASS 1: The structured representation of the raw PDF (Source of Truth)
    original_json: {
      type: Object,
      required: true,
    },
    // PASS 2: The optimized, rewritten resume (Final Output)
    final_json: {
      type: Object,
      required: true,
    },
    // ATS Score details
    atsScore: {
      pre: { type: Number, default: 0 },
      post: { type: Number, default: 0 },
    },
    missingKeywords: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resume', resumeSchema);