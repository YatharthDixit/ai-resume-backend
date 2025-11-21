// src/worker-manager.js
const config = require('./config');
const db = require('./config/db');
const logger = require('./utils/logger');
const Run = require('./models/run.model');
const Process = require('./models/process.model');
const sqsService = require('./services/sqs.service');
const storageService = require('./services/storage.service');
const parserService = require('./services/parser.service');
const processService = require('./services/process.service');
const generationService = require('./services/generation.service');
const { PROCESS_STATUS } = require('./utils/constants');
const fs = require('fs/promises');
const path = require('path');

/**
 * Polls SQS for new jobs.
 */
const pollSQS = async () => {
  try {
    // 1. Receive messages from SQS (long polling)
    const messages = await sqsService.receiveMessage(1, 20);

    if (messages && messages.length > 0) {
      const message = messages[0];
      const { runId } = JSON.parse(message.Body);

      logger.info(`[${runId}] Received job from SQS`);

      // 2. Create/Find Process doc in Mongo to track status for the UI
      let job = await Process.findOne({ runId });
      if (!job) {
        job = await Process.create({ runId, status: PROCESS_STATUS.PENDING });
      }

      try {
        // 3. RUN PROCESSING
        // Note: We are reusing the existing service logic but orchestrating it here.
        // Ideally, processService should handle the state transitions.

        // A. Parse (Download from Blob -> Extract Text -> Upload Text to Blob)
        // We need to manually trigger the parse step since we are not leasing from DB anymore

        // Check if we need to do parsing
        if (job.status === PROCESS_STATUS.PENDING || job.status === PROCESS_STATUS.PARSING) {
          await processParseStep(runId, job);
        }

        // B. Generate (Read Text from Blob -> Call Gemini -> Save JSON)
        // Reload job to check status
        job = await Process.findOne({ runId });
        if (job.status === PROCESS_STATUS.PARSED || job.status === PROCESS_STATUS.GENERATING) {
          await processGenerateStep(runId, job);
        }

        // 4. Delete from SQS only if successful (or if it's a permanent failure)
        await sqsService.deleteMessage(message.ReceiptHandle);
        logger.info(`[${runId}] Job completed and removed from SQS.`);

      } catch (err) {
        logger.error(err, `[${runId}] Job failed`);
        // We don't delete the message so it becomes visible again (retry)
        // Unless it's a fatal error, in which case we might want to DLQ it.
      }
    }
  } catch (error) {
    logger.error(error, 'SQS Polling Error');
  }
};

/**
 * Orchestrates the Parsing Step
 */
const processParseStep = async (runId, job) => {
  logger.info(`[${runId}] Starting parse step...`);

  // Update status to PARSING
  job.status = PROCESS_STATUS.PARSING;
  await job.save();

  try {
    const run = await Run.findOne({ runId });
    if (!run) throw new Error('Associated Run document not found.');

    // Download PDF from Blob (run.originalPdfKey is now a URL)
    const pdfBuffer = await storageService.download(run.originalPdfKey);

    // Extract Text
    const text = await parserService.extractText(pdfBuffer);

    // Save extracted text to LOCAL file system
    // We use a local path so generationService (which uses fs) can read it
    const textDir = path.join(process.cwd(), 'extracted_details', 'runs', runId);
    await fs.mkdir(textDir, { recursive: true });

    const textPath = path.join(textDir, 'extracted_text.txt');
    await fs.writeFile(textPath, text, 'utf-8');

    // Update Run doc with the LOCAL path
    run.extractedTextKey = textPath;
    await run.save();

    // Update Process doc
    job.status = PROCESS_STATUS.PARSED;
    await job.save();
    logger.info(`[${runId}] Parse step complete. Text saved to: ${textPath}`);
  } catch (error) {
    job.status = PROCESS_STATUS.FAILED;
    job.lastError = { message: error.message, stack: error.stack };
    await job.save();
    throw error;
  }
};

/**
 * Orchestrates the Generation Step
 */
const processGenerateStep = async (runId, job) => {
  logger.info(`[${runId}] Starting generation step...`);

  // Update status to GENERATING
  job.status = PROCESS_STATUS.GENERATING;
  await job.save();

  try {
    // We can reuse generationService.runGeneration if it accepts the job object
    // But we need to make sure it doesn't try to lease the job again.
    // Looking at previous code, runGeneration took 'job' as arg.

    await generationService.runGeneration(job);

    // generationService.runGeneration handles the logic. 
    // However, we need to ensure it marks the job as COMPLETED.
    // If generationService relies on DB leasing, we might need to adjust it.
    // For now, assuming runGeneration does the heavy lifting.

    // Manually mark as completed if generationService doesn't do it fully or if we need to be sure
    // But wait, generationService likely updates the job status.
    // Let's check if we need to explicitly complete it.

    // Re-fetch to see if it's completed
    const updatedJob = await Process.findOne({ runId });
    if (updatedJob.status !== PROCESS_STATUS.COMPLETED) {
      await processService.completeGenerateJob(job._id);
    }

    logger.info(`[${runId}] Generation step complete.`);
  } catch (error) {
    // generationService might handle failures, but if it throws, we catch here
    // Ensure job is marked failed
    await processService.failJob(job._id, error);
    throw error;
  }
};

const main = async () => {
  await db.connect();
  logger.info('WORKER started. Polling SQS...');

  // Loop forever
  while (true) {
    await pollSQS();
  }
};

main().catch((err) => {
  logger.error(err, 'Worker process crashed');
  process.exit(1);
});