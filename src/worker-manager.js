// src/worker-manager.js
const config = require('./config');
const db = require('./config/db');
const logger = require('./utils/logger');
const Run = require('./models/run.model');
// const fs = require('fs/promises'); // <-- VER-BLOB: No longer needed
// const path = require('path'); // <-- VER-BLOB: No longer needed
const storageService = require('./services/storage.service');
const parserService = require('./services/parser.service');
const processService = require('./services/process.service');
const generationService = require('./services/generation.service');
const { PROCESS_STEPS } = require('./utils/constants');

/**
 * The main polling function that looks for 'parse' jobs.
 */
const pollForParseJobs = async () => {
  let job = null;
  try {
    // 1. Try to lease a job
    job = await processService.leaseParseJob();

    if (!job) {
      // No job found, just wait for the next poll
      return;
    }

    logger.info(`[${job.runId}] Starting parse job...`);

    // 2. Get the Run document to find the S3 key
    const run = await Run.findOne({ runId: job.runId });
    if (!run) throw new Error('Associated Run document not found.');

    // 3. Download the PDF from Vercel Blob
    const pdfBuffer = await storageService.download(run.originalPdfKey);

    // 4. Parse the PDF buffer
    const text = await parserService.extractText(pdfBuffer);

    // 5. Define the new path for the *extracted text*
    // VER-BLOB: This is now a cloud path for Vercel Blob
    const textKey = `extracted_details/runs/${run.runId}/extracted_text.txt`;

    // 6. "Upload" (save) the raw text to Vercel Blob
    await storageService.upload(Buffer.from(text), textKey, 'text/plain');

    // 6. Update the Run doc with the new S3 key
    run.extractedTextKey = textKey;
    await run.save();

    // 7. Transition the job to the 'generate' step
    await processService.completeParseJob(job._id);
    logger.info(`[${job.runId}] Parse job complete. Ready for generation.`);
} catch (error) {
    logger.error(error, `[${job?.runId}] Parse job failed`);
    if (job) {
      await processService.failJob(job._id, error);
    }
  }
};

/**
 * Poller for 'generate' jobs
 */
const pollForGenerateJobs = async () => {
  let job = null;
  try {
    // 1. Try to lease a 'generate' job
    job = await processService.leaseGenerateJob();
    if (!job) return;

    logger.info(`[${job.runId}] Starting generation job...`);

    // 2. Run the main generation logic
    await generationService.runGeneration(job);

    // 3. Mark the job as complete
    await processService.completeGenerateJob(job._id);
    logger.info(`[${job.runId}] Generation job successful.`);
  } catch (error) {
    logger.error(error, `[${job?.runId}] Generation job failed`);
    if (job) {
      // 3b. Mark as failed if an error occurs
      await processService.failJob(job._id, error);
    }
  }
};

/**
 * The main worker entry point.
 */
logger.info('Starting WORKER process...');
const main = async () => {
  await db.connect();
  logger.info('WORKER connected to MongoDB');

  // Start the polling loop for PARSE jobs
  logger.info(`Worker polling for [${PROCESS_STEPS.PARSE}] jobs...`);
  setInterval(pollForParseJobs, config.pollIntervalMs);

  // Start the polling loop for GENERATE jobs
  setTimeout(() => {
    logger.info(`Worker polling for [${PROCESS_STEPS.GENERATE}] jobs...`);
    setInterval(pollForGenerateJobs, config.pollIntervalMs);
  }, 1000); // Start 1 second after the first poller
};

main().catch((err) => {
  logger.error(err, 'Worker process crashed');
  process.exit(1);
});