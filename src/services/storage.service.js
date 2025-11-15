// src/services/storage.service.js
const fs = require('fs/promises'); // Use Node.js file system module
const path = require('path');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

/**
 * Saves a file buffer to the local filesystem.
 * The 'key' is now a full file path.
 */
const upload = async (fileBuffer, key, mimetype) => {
  try {
    // The 'key' is the full path, e.g., 'uploads/run_123/resume.pdf'
    // We need to make sure the directory exists first.
    const dir = path.dirname(key);
    await fs.mkdir(dir, { recursive: true });

    // Write the file
    await fs.writeFile(key, fileBuffer);
    logger.info(`Local file save successful: ${key}`);
    return { key };
  } catch (error) {
    logger.error(error, `Local file save failed: ${key}`);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to save file to local storage.'
    );
  }
};

/**
 * Reads a file from the local filesystem and returns it as a Buffer.
 * The 'key' is the full file path.
 */
const download = async (key) => {
  try {
    // Read the file from the path
    const buffer = await fs.readFile(key);
    logger.info(`Local file read successful: ${key}`);
    return buffer;
  } catch (error) {
    logger.error(error, `Local file read failed: ${key}`);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to read file from local storage.'
    );
  }
};

module.exports = {
  upload,
  download,
};