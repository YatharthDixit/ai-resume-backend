// src/services/storage.service.js
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand, // Import this
} = require('@aws-sdk/client-s3');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

/**
 * Converts a readable stream into a Buffer
 * This is a helper function to read the S3 object body
 */
const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
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

  // The code below is now "dead code"
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

/**
 * Downloads an object from S3 and returns it as a Buffer
 */
const download = async (key) => {
  const command = new GetObjectCommand({
    Bucket: config.aws.bucketName,
    Key: key,
  });

  try {
    const { Body } = await s3Client.send(command);
    // Body is a stream, so we must convert it to a buffer
    const buffer = await streamToBuffer(Body);
    logger.info(`S3 Download successful: ${key}`);
    return buffer;
  } catch (error) {
    logger.error(error, `S3 Download failed: ${key}`);
    // Note: This will likely fail if you don't have S3 credentials.
    // We can add a bypass here too if needed.
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to download file from storage.'
    );
  }
};

module.exports = {
  upload,
  download, // Export the new function
};