// src/worker-manager.js
const config = require('./config');
const db = require('./config/db');
const logger = require('./utils/logger');

// Only run if ROLE is 'worker'
if (config.role !== 'worker') {
  logger.info(`Process ROLE is '${config.role}'. Worker will not start.`);
  process.exit(0);
}

logger.info('Starting WORKER process...');

const main = async () => {
  await db.connect();
  logger.info('WORKER connected to MongoDB');

  // In Phase 2, we will add the polling loop here
  logger.info('Worker is running and waiting for jobs...');
};

main().catch((err) => {
  logger.error(err, 'Worker process crashed');
  process.exit(1);
});