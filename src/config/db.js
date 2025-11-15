// src/config/db.js
const mongoose = require('mongoose');
const config = require('./index');
const logger = require('../utils/logger');

const connect = async () => {
  try {
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error(error, 'MongoDB connection error. Exiting.');
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    logger.error(err, 'MongoDB runtime error:');
  });
};

module.exports = {
  connect,
};