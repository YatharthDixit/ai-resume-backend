// src/middleware/errorHandler.js
const { StatusCodes } = require('http-status-codes');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('./../utils/ApiError');

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  
  // If it's not a known ApiError, default to a 500
  if (!(err instanceof ApiError)) {
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    message = 'Internal Server Error';
  }

  logger.error(err, 'Error handled:');

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      // Only show the stack trace in development
      ...(config.env === 'development' && { stack: err.stack }),
    },
  });
};

module.exports = errorHandler;