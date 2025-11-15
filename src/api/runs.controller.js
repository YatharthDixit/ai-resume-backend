// src/api/runs.controller.js
const { StatusCodes } = require('http-status-codes');
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

  // 2. Save it FIRST. This triggers the pre-save hook
  // which generates runId and retention_until.
  await run.save();

  // 3. Now that run.runId exists, define the S3 key
  const s3Key = `public/runs/${run.runId}/${run.originalFilename}`;

  // 4. Upload file to S3 (or skip if using your bypass)
  await storageService.upload(req.file.buffer, s3Key, req.file.mimetype);

  // 5. Add the S3 key to the doc and save AGAIN to update
  run.originalPdfKey = s3Key;
  await run.save();

  // 6. Create the initial Process (job queue) doc
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