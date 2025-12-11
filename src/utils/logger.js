const pino = require('pino');

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  // In development, pino-colada will prettify this
  // In production, it will be standard JSON
});

module.exports = logger;