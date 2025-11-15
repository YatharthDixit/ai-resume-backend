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
    leased_until: { $lt: new Date() }, // Find jobs where lease is expired
    attempt: { $lt: config.maxAttempts },
  };

  const update = {
    status: PROCESS_STATUS.RUNNING,
    leased_until: new Date(Date.now() + config.leaseTtlMs), // Set new lease
    $inc: { attempt: 1 }, // Increment attempt
  };

  // Find one job, update it, and return the *new* document
  const job = await Process.findOneAndUpdate(query, update, { new: true });
  return job; // Will be null if no job was found
};

/**
 * Transitions a job from 'parse' to 'generate' step.
 */
const transitionToGenerate = async (processId) => {
  const update = {
    status: PROCESS_STATUS.PENDING,
    step: PROCESS_STEPS.GENERATE,
    leased_until: new Date(Date.now() - config.leaseTtlMs), // Make it immediately available
  };
  await Process.findByIdAndUpdate(processId, update);
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
  transitionToGenerate,
  failJob,
};