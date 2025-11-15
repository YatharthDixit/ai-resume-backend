// src/worker-manager.js
const config = require('./config');
const db = require('./config/db');
const logger = require('./utils/logger');
const path = require('path');
const Run = require('./models/run.model');
const storageService = require('./services/storage.service');
const parserService = require('./services/parser.service');
const processService = require('./services/process.service');
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

    // 3. Download the PDF from S3
    const pdfBuffer = await storageService.download(run.originalPdfKey);

    // 4. Parse the PDF buffer
    const text = await parserService.extractText(pdfBuffer);

    // 5. Define the new path for the *extracted text*
    const textKey = path.join(
      process.cwd(),
      'extracted_details', // <-- Save in 'extracted_details' folder
      'runs',
      run.runId,
      'extracted_text.txt'
    );

    // 6. "Upload" (save) the raw text to the new local folder
    await storageService.upload(Buffer.from(text), textKey, 'text/plain');

    // 6. Update the Run doc with the new S3 key
    run.extractedTextKey = textKey;
    await run.save();

    // 7. Transition the job to the 'generate' step
    await processService.transitionToGenerate(job._id);
    logger.info(`[${job.runId}] Parse job complete. Ready for generation.`);
  } catch (error) {
    logger.error(error, `[${job?.runId}] Parse job failed`);
    if (job) {
      // If we leased a job, mark it as failed
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

  // Start the polling loop
  logger.info(`Worker polling for [${PROCESS_STEPS.PARSE}] jobs...`);
  setInterval(pollForParseJobs, config.pollIntervalMs);

  // In Phase 3, we will add a second poller for 'generate' jobs here
};

main().catch((err) => {
  logger.error(err, 'Worker process crashed');
  process.exit(1);
});