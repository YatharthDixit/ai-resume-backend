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
      default: null,
    },
    // Adding ATS Score tracking
    atsScore: {
      pre: { type: Number, default: 0 },
      post: { type: Number, default: 0 },
      missingKeywords: [{ type: String }],
      summary: { type: String }
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resume', resumeSchema);