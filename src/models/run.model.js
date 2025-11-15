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
    },
  },
  { timestamps: true }
);

// Mongoose 'pre-save' hook to auto-fill fields on creation
runSchema.pre('save', function (next) {
  if (this.isNew) {
    this.runId = `run_${nanoid(10)}`; // e.g., 'run_gYqC14F-P'
    this.retention_until = dayjs()
      .add(config.retentionHours, 'hour')
      .toDate();
  }
  next();
});

module.exports = mongoose.model('Run', runSchema);