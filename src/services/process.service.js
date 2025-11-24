// src/services/process.service.js
const Process = require('../models/process.model');
const config = require('../config');
const { PROCESS_STATUS, PROCESS_STEPS } = require('../utils/constants');

/**
 * Atomically finds and leases a 'parse' job from the queue.
 */
const leaseParseJob = async () => {
  const query = {
    status: PROCESS_STATUS.PENDING,
    step: PROCESS_STEPS.PARSE,
    leased_until: { $lt: new Date() },
    attempt: { $lt: config.maxAttempts },
  };

  const update = {
    status: PROCESS_STATUS.RUNNING,
    leased_until: new Date(Date.now() + config.leaseTtlMs),
    $inc: { attempt: 1 },
  };

  const job = await Process.findOneAndUpdate(query, update, { new: true });
  return job;
};

// --- NEW ---
/**
 * Atomically finds and leases a 'generate' job from the queue.
 */
const leaseGenerateJob = async () => {
  const query = {
    status: PROCESS_STATUS.PENDING,
    step: PROCESS_STEPS.GENERATE,
    leased_until: { $lt: new Date() },
    attempt: { $lt: config.maxAttempts },
  };

  const update = {
    status: PROCESS_STATUS.RUNNING,
    leased_until: new Date(Date.now() + config.leaseTtlMs),
    $inc: { attempt: 1 },
  };

  const job = await Process.findOneAndUpdate(query, update, { new: true });
  return job;
};

// --- MODIFIED ---
/**
 * Transitions a 'parse' job to the 'generate' step.
 */
const completeParseJob = async (processId) => {
  const update = {
    status: PROCESS_STATUS.PENDING,
    step: PROCESS_STEPS.GENERATE,
    leased_until: new Date(Date.now() - config.leaseTtlMs), // Make it immediately available
  };
  await Process.findByIdAndUpdate(processId, update);
};

// --- NEW ---
/**
 * Updates the progress of a 'generate' job.
 */
const updateChunkProgress = async (processId, chunkKey, error = null) => {
  const update = error
    ? { $push: { 'meta.chunk_errors': `${chunkKey}: ${error.message}` } }
    : { $inc: { 'meta.chunks_completed': 1 } };

  await Process.findByIdAndUpdate(processId, update);
};

// --- NEW ---
/**
 * Marks a 'generate' job as fully completed.
 */
const completeGenerateJob = async (processId) => {
  const update = {
    status: PROCESS_STATUS.COMPLETED,
    leased_until: new Date(),
  };
  await Process.findByIdAndUpdate(processId, update);
};

/**
 * Updates the status of a process job with custom fields.
 * Used for granular progress updates during parsing/generation.
 */
const updateStatus = async (processId, updates) => {
  await Process.findByIdAndUpdate(processId, updates);
};

/**
 * Marks a job as 'failed' and logs the error.
 */
const failJob = async (processId, error) => {
  const update = {
    status: PROCESS_STATUS.FAILED,
    lastError: {
      message: error.message || 'Unknown error',
      stack: error.stack,
    },
  };
  await Process.findByIdAndUpdate(processId, update);
};

module.exports = {
  leaseParseJob,
  leaseGenerateJob, // Export new
  completeParseJob, // Renamed from transitionToGenerate
  updateChunkProgress, // Export new
  completeGenerateJob, // Export new
  updateStatus, // Export new for granular updates
  failJob,
};