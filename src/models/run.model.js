// src/models/run.model.js
const mongoose = require('mongoose');
const { nanoid } = require('nanoid'); // v3 is CommonJS
const dayjs = require('dayjs');
const config = require('../config');
const { PROCESS_STATUS } = require('../utils/constants');

const runSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      unique: true,
      index: true,
      // Use a default function to generate the ID
      default: () => `run_${nanoid(10)}`,
    },
    originalPdfKey: {
      type: String,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    extractedTextKey: {
      type: String,
    },
    instruction_text: {
      type: String,
    },
    jobDescription: {
      type: String,
    },
    hasJobDescription: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: Object.values(PROCESS_STATUS),
      default: PROCESS_STATUS.PENDING,
      index: true,
    },
    retention_until: {
      type: Date,
      required: true,
      index: true,
      // Use a default function to set the date
      default: () => dayjs().add(config.retentionHours, 'hour').toDate(),
    },
  },
  { timestamps: true }
);

// NO pre-save hook is needed. The 'default' handlers do the work.

module.exports = mongoose.model('Run', runSchema);