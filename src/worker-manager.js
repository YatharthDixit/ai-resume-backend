// src/worker-manager.js
const config = require('./config');
const db = require('./config/db');
const logger = require('./utils/logger');
const sqsService = require('./services/sqs.service');
const workerService = require('./services/worker.service');

// Configuration
const MAX_CONCURRENT_JOBS = process.env.WORKER_POOL_SIZE || 5;
let activeJobs = 0;

/**
 * Processes a single message.
 * 1. Increment active count.
 * 2. Process logic.
 * 3. ACK (Delete) message regardless of success/failure to prevent loops.
 * 4. Decrement active count & trigger poll.
 */
const processJob = async (message) => {
  activeJobs++;

  try {
    await workerService.handleMessage(message);

    // Success: Delete message
    await sqsService.deleteMessage(message.ReceiptHandle);
    logger.info(`[Msg Processed] Deleted from SQS.`);
  } catch (err) {
    logger.error(err, 'Job Processing Failed');

    // Failure: Delete message to prevent "death spiral" (infinite retries of bad jobs)
    try {
      await sqsService.deleteMessage(message.ReceiptHandle);
      logger.info('Failed message deleted from SQS to clean queue.');
    } catch (deleteErr) {
      logger.error(deleteErr, 'Failed to delete failed message');
    }
  } finally {
    activeJobs--;
    // Immediately poll to fill the slot we just freed
    poll();
  }
};

/**
 * Main Polling Loop
 * Recursive function that checks concurrency limits before fetching.
 */
const poll = async () => {
  // 1. Check Concurrency Limit
  if (activeJobs >= MAX_CONCURRENT_JOBS) {
    return; // Limit reached. Do nothing. 'processJob' will call poll() when it's done.
  }

  // 2. Calculate Batch Size
  const slotsAvailable = MAX_CONCURRENT_JOBS - activeJobs;
  const batchSize = Math.min(slotsAvailable, 10); // SQS max is 10

  if (batchSize <= 0) return;

  try {
    // 3. Fetch Messages (Long Polling: 20s)
    // Note: This call blocks asynchronously while waiting for SQS, but doesn't block CPU.
    const messages = await sqsService.receiveMessage(batchSize, 20);

    if (!messages || messages.length === 0) {
      // Queue empty or timeout. Poll again immediately.
      setImmediate(poll);
      return;
    }

    // 4. Dispatch Jobs (Async / Fire & Forget)
    messages.forEach((message) => {
      // We do NOT await here. We want them running in parallel.
      processJob(message);
    });

    // 5. Poll again?
    // If we filled our slots, the recursive calls from 'processJob' completion will keep it going.
    // But if we still have slots (e.g. we asked for 5, got 2), we should try to fill the rest?
    // For simplicity, let's just loop back.
    if (activeJobs < MAX_CONCURRENT_JOBS) {
      setImmediate(poll);
    }

  } catch (err) {
    logger.error(err, 'Polling Error');
    // Backoff on error
    setTimeout(poll, 5000);
  }
};

const main = async () => {
  await db.connect();

  if (!config.aws.sqsQueueUrl) {
    logger.error('SQS Queue URL is missing. Worker cannot start.');
    process.exit(1);
  }

  logger.info(`Starting Custom Worker Poller. concurrency=${MAX_CONCURRENT_JOBS}`);
  poll();

  const shutdown = () => {
    logger.info('Shutting down...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main().catch((err) => {
  logger.error(err, 'Worker process crashed');
  process.exit(1);
});