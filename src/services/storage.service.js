// src/services/storage.service.js
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

// Create a single, reusable S3 client instance
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

// We will add 'download' in Phase 2
module.exports = {
  upload,
};