// src/api/runs.controller.js
const { StatusCodes } = require('http-status-codes');
const path = require('path'); // Import Node's path module
const storageService = require('../services/storage.service');
const Run = require('../models/run.model');
const Process = require('../models/process.model');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const createRun = async (req, res) => {
  const { instruction_text } = req.body;

  if (!req.file) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A PDF file is required.');
  }

  // 1. Create the Run document
  const run = new Run({
    originalFilename: req.file.originalname,
    instruction_text,
  });

  // 2. Save it FIRST to get the runId
  await run.save();

  // 3. Define the *local* file path
  // process.cwd() is the project root.
  // This creates a path like '.../resume-backend/uploads/runs/run_123/resume.pdf'
  const localKey = path.join(
    process.cwd(),
    'uploads',
    'runs',
    run.runId,
    run.originalFilename
  );

  // 4. "Upload" (save) the file locally
  await storageService.upload(req.file.buffer, localKey, req.file.mimetype);

  // 5. Add the local key to the doc and save AGAIN
  run.originalPdfKey = localKey; // Save the full absolute path
  await run.save();

  // 6. Create the initial Process doc
  await Process.create({
    runId: run.runId,
  });

  logger.info(`New job created: ${run.runId}`);

  // 7. Respond to the user
  res.status(StatusCodes.ACCEPTED).send({
    success: true,
    data: {
      runId: run.runId,
      status: run.status,
      message: 'Your resume is being processed.',
    },
  });
};

module.exports = {
  createRun,
};