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
    // The final, merged JSON from the GenerationService
    final_json: {
      type: Object, // Mongoose will store the JSON object here
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resume', resumeSchema);