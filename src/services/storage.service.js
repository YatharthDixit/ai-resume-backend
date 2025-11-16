// src/services/storage.service.js
const { put, get, del } = require('@vercel/blob');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

/**
 * Saves a file buffer to Vercel Blob.
 * The 'key' is the path (e.g., 'runs/run_123/resume.pdf').
 */
const upload = async (fileBuffer, key, mimetype) => {
  try {
    // Vercel Blob's `put` is simple.
    // It automatically reads the BLOB_READ_WRITE_TOKEN.
    // `access: 'public'` makes it downloadable via a URL if needed,
    // but we'll use the private `get` method.
    const blob = await put(key, fileBuffer, {
      access: 'public', // Or 'private', but public is fine
      contentType: mimetype,
    });

    logger.info(`Vercel Blob upload successful: ${blob.pathname}`);
    return { key: blob.pathname }; // Return the final path
  } catch (error) {
    logger.error(error, `Vercel Blob upload failed: ${key}`);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to save file to Vercel Blob.'
    );
  }
};

/**
 * Reads a file from Vercel Blob and returns it as a Buffer.
 * The 'key' is the path.
 */
const download = async (key) => {
  try {
    // `get` retrieves the file using the token
    const blobResult = await get(key);
    
    // Convert the stream/blob to a Buffer
    const buffer = Buffer.from(await blobResult.arrayBuffer());
    
    logger.info(`Vercel Blob download successful: ${key}`);
    return buffer;
  } catch (error) {
    logger.error(error, `Vercel Blob download failed: ${key}`);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to read file from Vercel Blob.'
    );
  }
};

// We can also add a delete function for cleanup
const remove = async (key) => {
  try {
    await del(key);
    logger.info(`Vercel Blob delete successful: ${key}`);
  } catch (error) {
    logger.error(error, `Vercel Blob delete failed: ${key}`);
    // Don't throw an error, just log it
  }
};

module.exports = {
  upload,
  download,
  remove, // Export remove if we want to use it later
};