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
const atsService = require('./services/ats.service');
const { PROCESS_STATUS } = require('./utils/constants');
const fs = require('fs/promises');
const path = require('path');

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

    // Save text locally (legacy support + backup)
    const textDir = path.join(process.cwd(), 'extracted_details', 'runs', runId);
    await fs.mkdir(textDir, { recursive: true });
    const textPath = path.join(textDir, 'extracted_text.txt');
    await fs.writeFile(textPath, text, 'utf-8');
    run.extractedTextKey = textPath;
    await run.save();

    // B. Generate Original JSON (Structure Only)
    const original_json = await generationService.generateStructuredData(text, runId);

    // C. Calculate Baseline ATS Score
    const atsResult = atsService.calculateScore(text, run.instruction_text); // Using instruction as proxy for JD if not separate

    // D. Save Intermediate Result
    // We create the Resume doc here with partial data
    await Resume.findOneAndUpdate(
      { runId },
      {
        runId,
        original_json,
        'atsScore.pre': atsResult.score,
        missingKeywords: atsResult.missingKeywords
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
    const run = await Run.findOne({ runId });
    const resume = await Resume.findOne({ runId });

    // Read text again (or we could pass it from previous step, but stateless is safer)
    const text = await fs.readFile(run.extractedTextKey, 'utf-8');

    // A. Optimize JSON
    const final_json = await generationService.optimizeStructuredData(
      text,
      run.instruction_text,
      runId
    );

    // B. Calculate Final ATS Score
    // We convert final_json back to text roughly to score it, or just score the bullets?
    // For MVP, let's score the raw text of the final json
    const finalString = JSON.stringify(final_json);
    const atsResult = atsService.calculateScore(finalString, run.instruction_text);

    // C. Save Final Result
    resume.final_json = final_json;
    resume.atsScore.post = atsResult.score;
    // We keep the missing keywords from the original check or update them? 
    // Usually we want to see what's STILL missing.
    resume.missingKeywords = atsResult.missingKeywords;
    await resume.save();

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