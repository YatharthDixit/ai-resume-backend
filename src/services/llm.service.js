// src/services/llm.service.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

// --- Key Rotation Logic ---
const apiKeys = config.llm.apiKeys;
let currentKeyIndex = 0;

const getNextKey = () => {
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return key;
};
// --- End Key Rotation ---

/**
 * Calls the Gemini API with a specific prompt.
 * Implements key rotation on 429 (Too Many Requests) errors.
 */
const generateChunk = async (prompt, retries = apiKeys.length) => {
  const key = getNextKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.llm.model}:generateContent?key=${key}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  try {
    const response = await axios.post(url, body, {
      timeout: config.llm.timeout,
    });

    // The Gemini API response has the JSON *inside* a text field
    const contentText = response.data.candidates[0].content.parts[0].text;
    return JSON.parse(contentText);
  } catch (error) {
    // Check for 429 error (Too Many Requests) to trigger key rotation
    if (error.response && error.response.status === 429 && retries > 0) {
      logger.warn(
        `Gemini API key quota exceeded. Retrying with next key... (${retries} retries left)`
      );
      return generateChunk(prompt, retries - 1); // Retry with the next key
    }

    // Handle other errors
    logger.error(error.response?.data || error.message, 'Gemini API call failed');
    throw new ApiError(
      error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR,
      `Gemini API Error: ${error.response?.data?.error?.message || error.message}`
    );
  }
};

module.exports = {
  generateChunk,
};