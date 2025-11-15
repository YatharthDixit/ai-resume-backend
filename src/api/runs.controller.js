// src/api/runs.controller.js
const { StatusCodes } = require('http-status-codes');
const path = require('path'); // Keep path for local storage
const storageService = require('../services/storage.service');
const Run = require('../models/run.model');
const Process = require('../models/process.model');
const Resume = require('../models/resume.model'); // <-- ADD THIS
const rendererService = require('../services/renderer.service'); // <-- ADD THIS
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { PROCESS_STATUS } = require('../utils/constants'); // <-- ADD THIS

/**
 * POST /runs
 * Creates a new run
 * (This is our existing function that saves to the 'uploads' folder)
 */
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
    'uploads', // Our 'uploads' folder
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

/**
 * GET /runs/:runId/status
 * Polls for the status of a run
 */
const getRunStatus = async (req, res) => {
  const { runId } = req.params;
  const job = await Process.findOne({ runId });

  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Job not found.');
  }

  // Format the response as per the DOC
  const response = {
    runId: job.runId,
    status: job.status,
    step: job.step,
    progress: {
      total_chunks: job.meta.chunks_total,
      completed_chunks: job.meta.chunks_completed,
    },
    error: job.lastError?.message || null,
  };

  res.status(StatusCodes.OK).send({
    success: true,
    data: response,
  });
};

/**
 * GET /runs/:runId/preview-html
 * Fetches the generated HTML preview
 */
const getPreviewHtml = async (req, res) => {
  const { runId } = req.params;

  // 1. Find the *final result* from the resumes collection
  const result = await Resume.findOne({ runId });

  if (!result) {
    // Check if the job is just not finished yet
    const job = await Process.findOne({ runId });
    if (job && job.status !== PROCESS_STATUS.COMPLETED) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        `Job is still ${job.status}. Preview not available.`
      );
    }
    throw new ApiError(StatusCodes.NOT_FOUND, 'Result not found.');
  }

  // 2. Generate the HTML string from the final_json
  // We add the runId so logs are consistent
  const htmlString = rendererService.generateHtmlString({
    runId,
    ...result.final_json,
  });

  // 3. Send the HTML as the response
  res.setHeader('Content-Type', 'text/html');
  res.status(StatusCodes.OK).send(htmlString);
};

module.exports = {
  createRun,
  getRunStatus,
  getPreviewHtml,
};