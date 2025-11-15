// src/api/runs.controller.js
const { StatusCodes } = require('http-status-codes');
const storageService = require('../services/storage.service');
const Run = require('../models/run.model');
const Process = require('../models/process.model');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const createRun = async (req, res) => {
  const { instruction_text } = req.body;

  // 1. Check if file exists (Handled by Multer)
  if (!req.file) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A PDF file is required.');
  }

  // 2. Create the Run document in memory
  // This triggers the pre-save hook to generate runId
  const run = new Run({
    originalFilename: req.file.originalname,
    instruction_text,
  });

  // 3. Define the S3 key (path)
  const s3Key = `public/runs/${run.runId}/${run.originalFilename}`;

  // 4. Upload file to S3
  await storageService.upload(req.file.buffer, s3Key, req.file.mimetype);

  // 5. Save the Run doc (now with the S3 key)
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