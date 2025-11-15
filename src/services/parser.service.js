// src/services/parser.service.js
const pdf = require('pdf-parse'); // Back to the simple require
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

/**
 * Extracts raw text from a PDF buffer.
 * @param {Buffer} pdfBuffer - The buffer containing the PDF file
 * @returns {Promise<string>} The extracted text
 */
const extractText = async (pdfBuffer) => {
  try {
    // This will now work with the v1 package
    const data = await pdf(pdfBuffer);
    logger.info('PDF text extraction successful');
    return data.text;
  } catch (error) {
    logger.error(error, 'Failed to parse PDF');
    throw new ApiError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      'Failed to parse PDF file.'
    );
  }
};

module.exports = {
  extractText,
};