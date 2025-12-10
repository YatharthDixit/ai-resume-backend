// src/services/llm.service.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');
const keyManager = require('../libs/KeyManager');

const MAX_RETRIES = 5;

// Helper: Delay execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls Gemini API with exponential backoff and key rotation.
 */
const callGeminiWithRetry = async (url, body, attempt = 1) => {
  const currentKey = keyManager.getCurrentKey();
  const requestUrl = `${url}?key=${currentKey}`;

  try {
    return await axios.post(requestUrl, body, {
      timeout: config.llm.timeout,
    });
  } catch (error) {
    // If we have exhausted retries, throw the error
    if (attempt >= MAX_RETRIES) {
      throw error;
    }

    const status = error.response?.status;
    const errorData = error.response?.data?.error || {};
    const errorCode = errorData.code;
    const errorMessage = errorData.message || error.message;

    // --- STRATEGY 1: Rate Limits (429) ---
    if (status === 429) {
      logger.warn(`[Gemini] Rate limit hit on key ending in ...${currentKey.slice(-4)}. Rotating key.`);
      keyManager.rotate(); // Switch to next key

      const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
      logger.info(`[Gemini] Retrying in ${backoffMs}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
      await delay(backoffMs);
      return callGeminiWithRetry(url, body, attempt + 1);
    }

    // --- STRATEGY 2: Server Overload (503, 500) ---
    if (status === 503 || status === 500) {
      logger.warn(`[Gemini] Server error (${status}). Retrying...`);
      const backoffMs = Math.pow(2, attempt) * 1000;
      await delay(backoffMs);
      return callGeminiWithRetry(url, body, attempt + 1);
    }

    // --- STRATEGY 3: Bad Request (400) - Check for Safety/Blocking ---
    if (status === 400) {
      // If it's a safety block or invalid argument that won't be fixed by retrying
      if (errorMessage.includes('SAFETY') || errorMessage.includes('BLOCKED')) {
        logger.error(`[Gemini] Content blocked by safety filters: ${errorMessage}`);
        throw new ApiError(StatusCodes.BAD_REQUEST, `AI Generation Failed: Content blocked by safety filters.`);
      }
      // If it's a context length error
      if (errorMessage.includes('token') || errorMessage.includes('context')) {
        logger.error(`[Gemini] Context length exceeded: ${errorMessage}`);
        throw new ApiError(StatusCodes.BAD_REQUEST, `AI Generation Failed: Input text too long.`);
      }
    }

    // For other unknown errors, we rethrow to let the caller handle it (or retry if transient)
    // If it is a generic network error (no response), we retry
    if (!error.response) {
      logger.warn(`[Gemini] Network error. Retrying...`);
      const backoffMs = Math.pow(2, attempt) * 1000;
      await delay(backoffMs);
      return callGeminiWithRetry(url, body, attempt + 1);
    }

    throw error;
  }
};

/**
 * Calls the Gemini API with a specific prompt.
 */
const generateChunk = async (prompt) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.llm.model}:generateContent`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  try {
    const response = await callGeminiWithRetry(url, body);

    // Validate response structure
    const candidate = response.data?.candidates?.[0];

    // Check finish reason
    if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'BLOCKLIST' || candidate?.finishReason === 'RECITATION') {
      throw new ApiError(StatusCodes.BAD_REQUEST, `AI Generation Blocked. Reason: ${candidate.finishReason}`);
    }

    if (!candidate?.content?.parts?.[0]?.text) {
      // Sometimes empty response with finishReason='STOP' might mean empty generation, but usually implies error in our context
      throw new Error(`Invalid response structure from Gemini API. Finish Reason: ${candidate?.finishReason}`);
    }

    let contentText = candidate.content.parts[0].text;

    // Sanitize: Remove markdown code blocks if present
    contentText = contentText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

    try {
      return JSON.parse(contentText);
    } catch (parseError) {
      // If we got here, the AI gave us malformed JSON. 
      // We could technically retry the *whole* generation, but keeping it simple for now.
      logger.error({ contentText }, 'Failed to parse JSON from Gemini');
      throw new Error(`JSON Parse Error: ${parseError.message}`);
    }

  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error(error.response?.data || error.message, 'Gemini API call failed');
    throw new ApiError(
      error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR,
      `Gemini API Error: ${error.message}`
    );
  }
};

module.exports = {
  generateChunk,
};