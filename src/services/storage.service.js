// src/services/storage.service.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

// ... s3Client definition ...
const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

/**
 * Uploads a file buffer to S3
 */
const upload = async (fileBuffer, key, mimetype) => {
  // --- START S3 BYPASS ---
  // We are skipping the real S3 upload for local dev
  logger.warn(`SKIPPING S3 UPLOAD for: ${key}`);
  return { key };
  // --- END S3 BYPASS ---

  // The code below is now "dead code" but kept for reference
  const command = new PutObjectCommand({
    Bucket: config.aws.bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  });

  try {
    await s3Client.send(command);
    logger.info(`S3 Upload successful: ${key}`);
    return { key };
  } catch (error) {
    logger.error(error, `S3 Upload failed: ${key}`);
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to upload file to storage.'
    );
  }
};

// ... module.exports ...
module.exports = {
  upload,
};