// src/utils/constants.js
const PROCESS_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

const PROCESS_STEPS = {
  PARSE: 'parse',
  GENERATE: 'generate',
};

// From the DOC: 5 chunks (header, education, experience, projects, skillsAndExtras)
const TOTAL_CHUNKS = 5;

module.exports = {
  PROCESS_STATUS,
  PROCESS_STEPS,
  TOTAL_CHUNKS,
};