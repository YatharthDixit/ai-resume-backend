// src/models/process.model.js
const mongoose = require('mongoose');
const config = require('../config');
const {
  PROCESS_STATUS,
  PROCESS_STEPS,
  TOTAL_CHUNKS,
} = require('../utils/constants');

const processSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PROCESS_STATUS),
      default: PROCESS_STATUS.PENDING,
      index: true,
    },
    step: {
      type: String,
      enum: Object.values(PROCESS_STEPS),
      default: PROCESS_STEPS.PARSE,
    },
    attempt: {
      type: Number,
      default: 1,
    },
    lastError: {
      message: String,
      stack: String,
    },
    assigned_worker: {
      type: String,
      index: true,
    },
    leased_until: {
      type: Date,
      index: true,
      // Default to the past so it's immediately leasable
      default: () => new Date(Date.now() - config.leaseTtlMs),
    },
    meta: {
      chunks_total: { type: Number, default: TOTAL_CHUNKS },
      chunks_completed: { type: Number, default: 0 },
      chunk_errors: [String],
    },
  },
  { timestamps: true }
);

// The most important index for the worker query
processSchema.index({
  status: 1,
  step: 1,
  leased_until: 1,
  attempt: 1,
});

module.exports = mongoose.model('Process', processSchema);