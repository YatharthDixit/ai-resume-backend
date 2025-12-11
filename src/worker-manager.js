// src/worker-manager.js
const config = require('./config');
const db = require('./config/db');
const logger = require('./utils/logger');
const Run = require('./models/run.model');
const Process = require('./models/process.model');
const Resume = require('./models/resume.model');
const Pdf = require('./models/pdf.model'); // <-- ADD THIS
const sqsService = require('./services/sqs.service');
// const storageService = require('./services/storage.service'); // REMOVED
const parserService = require('./services/parser.service');
const processService = require('./services/process.service');
const generationService = require('./services/generation.service');
// const atsService = require('./services/ats.service'); // Disabled in favor of Gemini ATS
const { PROCESS_STATUS } = require('./utils/constants');


/**
 * Polls SQS for new jobs.
 */
const pollSQS = async () => {
  try {
    const messages = await sqsService.receiveMessage(1, 20);

    if (messages && messages.length > 0) {
      const message = messages[0];
      const { runId } = JSON.parse(message.Body);

      logger.info(`[${runId}] Received job from SQS`);

      let job = await Process.findOne({ runId });
      if (!job) {
        job = await Process.create({ runId, status: PROCESS_STATUS.PENDING });
      }

      try {
        // TWO-PASS ARCHITECTURE

        // 1. PARSE STEP (Extract + Structure + ATS Baseline)
        if (job.status === PROCESS_STATUS.PENDING || job.status === PROCESS_STATUS.PARSING) {
          await processParseStep(runId, job);
        }

        // 2. GENERATE STEP (Optimize + ATS Final)
        // Reload job to check status
        job = await Process.findOne({ runId });
        if (job.status === PROCESS_STATUS.PARSED || job.status === PROCESS_STATUS.GENERATING) {
          await processGenerateStep(runId, job);
        }

        // 3. Cleanup
        await sqsService.deleteMessage(message.ReceiptHandle);
        logger.info(`[${runId}] Job completed and removed from SQS.`);

      } catch (err) {
        logger.error(err, `[${runId}] Job failed`);
        // Don't delete message on failure to allow retry (unless fatal)
      }
    }
  } catch (error) {
    logger.error(error, 'SQS Polling Error');
  }
};

/**
 * PASS 1: Parse Step
 * Downloads PDF, Extracts Text, Generates Original JSON, Calculates Baseline ATS Score.
 */
const processParseStep = async (runId, job) => {
  logger.info(`[${runId}] Starting Pass 1: Parse...`);
  job.status = PROCESS_STATUS.PARSING;
  await job.save();

  try {
    const run = await Run.findOne({ runId });
    if (!run) throw new Error('Associated Run document not found.');

    // A. Download & Extract
    const pdfDoc = await Pdf.findOne({ runId });
    if (!pdfDoc) throw new Error('PDF document not found.');
    const pdfBuffer = pdfDoc.data;

    const text = await parserService.extractText(pdfBuffer);

    // Save text to DB
    run.extractedText = text;
    await run.save();

    // 4. Generate Structured Data (Pass 1)
    const original_json = await generationService.generateStructuredData(run.extractedText, runId);

    // 5. Update Resume record
    await Resume.findOneAndUpdate(
      { runId },
      {
        runId,
        original_json,
      },
      { upsert: true, new: true }
    );

    job.status = PROCESS_STATUS.PARSED;
    await job.save();
    logger.info(`[${runId}] Pass 1 Complete.`);
  } catch (error) {
    job.status = PROCESS_STATUS.FAILED;
    job.lastError = { message: error.message, stack: error.stack };
    await job.save();
    throw error;
  }
};

/**
 * PASS 2: Generate Step
 * Optimizes the content using User Instructions.
 */
const processGenerateStep = async (runId, job) => {
  logger.info(`[${runId}] Starting Pass 2: Generate...`);
  job.status = PROCESS_STATUS.GENERATING;
  await job.save();

  try {
    const run = await Run.findOne({ runId }).select('+extractedText');
    const resume = await Resume.findOne({ runId });

    // Read text from DB
    const text = run.extractedText;
    if (!text) throw new Error('Extracted text not found in Run document.');

    // 3. Optimize (Pass 2)
    // Note: We use the extracted text as context + the specific instruction
    const final_json = await generationService.optimizeStructuredData(
      run.extractedText,
      run.instruction_text, 
      runId,
      run.job_description // Pass JD if it exists
    );

    // 4. Save Final JSON
    await Resume.findOneAndUpdate({ runId }, { final_json });

    // 5. Generate ATS Report (If JD exists)
    if (run.job_description) {
      // Need to fetch original_json for comparison
      // (resume variable already has it, but let's be safe and use what we have)
      const original_json = resume.original_json;

      const atsReport = await generationService.generateAtsReport(
        original_json,
        final_json,
        run.job_description, 
          runId
        );

      if (atsReport) {
        await Resume.findOneAndUpdate({ runId }, {
          'atsScore.pre': atsReport.originalScore || 0,
          'atsScore.post': atsReport.generatedScore || 0,
          'atsScore.missingKeywords': atsReport.missingKeywords || [],
          'atsScore.summary': atsReport.changesSummary || ''
        });
      }
    }

    // D. Complete Job
    await processService.completeGenerateJob(job._id);
    logger.info(`[${runId}] Pass 2 Complete. Job Finished.`);
  } catch (error) {
    await processService.failJob(job._id, error);
    throw error;
  }
};

const main = async () => {
  await db.connect();
  logger.info('WORKER started. Polling SQS...');
  while (true) {
    await pollSQS();
  }
};

main().catch((err) => {
  logger.error(err, 'Worker process crashed');
  process.exit(1);
});