// src/api/runs.controller.js
const { StatusCodes } = require('http-status-codes');
const path = require('path'); // Keep path for local storage
const storageService = require('../services/storage.service');
const Run = require('../models/run.model');
const Process = require('../models/process.model');
const Resume = require('../models/resume.model'); // <-- ADD THIS
const rendererService = require('../services/renderer.service'); // <-- ADD THIS
const pdfService = require('../services/pdf.service'); // <-- ADD THE NEW PDF SERVICE
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
  const run = new Run({
    originalFilename: req.file.originalname,
    instruction_text,
  });

  // 2. Save it FIRST to get the runId
  await run.save();

  // 3. Define the key for Blob storage (e.g., runs/{runId}/{filename})
  const blobKey = `runs/${run.runId}/${run.originalFilename}`;

  // 4. Upload to Vercel Blob
  // storageService.upload now returns { key: url }
  const { key: blobUrl } = await storageService.upload(
    req.file.buffer,
    blobKey,
    req.file.mimetype
  );

  // 5. Add the Blob URL to the doc and save AGAIN
  run.originalPdfKey = blobUrl;
  await run.save();

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
 * POST /runs/:runId/render-pdf
 * Generates and streams the final PDF
 */
const renderPdf = async (req, res) => {
  const { runId } = req.params;

  // 1. Find the final resume result
  const result = await Resume.findOne({ runId });
  if (!result) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Completed result not found.');
  }

  // 2. Generate the HTML string
  const htmlString = rendererService.generateHtmlString({
    runId,
    ...result.final_json,
  });

  // 3. Use the PDF service to generate the buffer
  logger.info(`[${runId}] Handing off to PDF service for generation...`);
  const pdfBuffer = await pdfService.generatePdfBuffer(htmlString);
  logger.info(`[${runId}] PDF buffer received from service.`);

  // 4. Send the PDF as a downloadable file
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="optimized-resume.pdf"'
  );
  res.status(StatusCodes.OK).send(pdfBuffer);
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
  renderPdf,
  getDiffData, // <-- Export the new function
};