// src/api/runs.controller.js
const { StatusCodes } = require('http-status-codes');
const path = require('path'); // Keep path for local storage
const Run = require('../models/run.model');
const Process = require('../models/process.model');
const Resume = require('../models/resume.model'); // <-- ADD THIS
const Pdf = require('../models/pdf.model'); // <-- ADD THIS
const rendererService = require('../services/renderer.service'); // <-- ADD THIS
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { PROCESS_STATUS } = require('../utils/constants'); // <-- ADD THIS

/**
 * POST /runs
 * Creates a new run
 * (This is our existing function that saves to the 'uploads' folder)
 */
// ... (keep other imports like Run model)
const sqsService = require('../services/sqs.service'); // Import SQS service

const createRun = async (req, res) => {
  const { instruction_text } = req.body;

  if (!req.file) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A PDF file is required.');
  }

  // 1. Create the Run document
  // 1. Create the Run document
  const run = new Run({
    originalFilename: req.file.originalname,
    instruction_text,
  });

  // 2. Save it
  await run.save();

  // 3. Save PDF to separate collection
  await Pdf.create({
    runId: run.runId,
    data: req.file.buffer,
    mimeType: req.file.mimetype,
  });

  // 6. Send message to SQS
  await sqsService.sendMessage({ runId: run.runId });

  logger.info(`New job created and queued: ${run.runId}`);

  // 7. Respond to the user
  res.status(StatusCodes.ACCEPTED).send({
    success: true,
    data: {
      runId: run.runId,
      status: run.status,
      message: 'Your resume is queued for processing.',
    },
  });
};

/**
 * GET /runs/:runId/status
 * Polls for the status of a run - simplified to return only high-level status
 */
const getRunStatus = async (req, res) => {
  const { runId } = req.params;
  const job = await Process.findOne({ runId });

  if (!job) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Job not found.');
  }

  // Simplified response - frontend handles section progress UI
  const response = {
    runId: job.runId,
    status: job.status,
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


/**
 * GET /runs/:runId/diff
 * Fetches the Original and Final JSONs for the Diff Viewer
 */
const getDiffData = async (req, res) => {
  const { runId } = req.params;

  const result = await Resume.findOne({ runId });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Resume data not found.');
  }

  // Ensure both passes are complete
  if (!result.original_json || !result.final_json) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Processing not complete. Diff unavailable.');
  }

  res.status(StatusCodes.OK).send({
    success: true,
    data: {
      original: result.original_json,
      optimized: result.final_json,
      ats: {
        pre: result.atsScore?.pre || 0,
        post: result.atsScore?.post || 0,
        missingKeywords: result.missingKeywords || [],
      },
    },
  });
};

module.exports = {
  createRun,
  getRunStatus,
  getPreviewHtml,
  getDiffData, // <-- Export the new function
};