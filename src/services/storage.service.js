// src/services/storage.service.js
const { put } = require('@vercel/blob');
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

/**
 * Uploads a file buffer to Vercel Blob.
 * The 'key' is used as the filename.
 */
const upload = async (fileBuffer, key, mimetype) => {
  try {
    // Vercel Blob 'put' returns { url, downloadUrl, pathname, contentType, contentDisposition }
    const blob = await put(key, fileBuffer, {
      access: 'public',
      token: config.blob.token,
      contentType: mimetype,
    });

    logger.info(`File uploaded to Blob: ${blob.url}`);
    // We return the URL as the key for consistency, or we can return the full blob object
    // For now, let's return the URL as the 'key' so we can store it in the DB
    return { key: blob.url };
  } catch (error) {
    logger.error(error, `Blob upload failed: ${key}`);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to upload file to storage.'
    );
  }
};

/**
 * Downloads a file from Vercel Blob (via its URL) and returns it as a Buffer.
 * The 'key' is expected to be the full URL.
 */
const download = async (key) => {
  try {
    // Since 'key' is the URL, we can just fetch it
    const response = await axios.get(key, {
      responseType: 'arraybuffer',
    });

    logger.info(`File downloaded from Blob: ${key}`);
    return Buffer.from(response.data);
  } catch (error) {
    logger.error(error, `Blob download failed: ${key}`);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to download file from storage.'
    );
  }
};

module.exports = {
  upload,
  download,
};