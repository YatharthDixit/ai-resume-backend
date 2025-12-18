// src/services/openrouter.service.js
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { StatusCodes } = require('http-status-codes');

const MAX_RETRIES = 5;

// Helper: Delay execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls OpenRouter API with exponential backoff.
 */
const callOpenRouterWithRetry = async (url, body, attempt = 1) => {
  const apiKey = config.openRouter.apiKey;
  
  if (!apiKey) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'OpenRouter API Key is missing in configuration.');
  }

  try {
    // logger.info(`[OpenRouter] Sending request to: ${url} | Model: ${body.model}`);
    return await axios.post(url, body, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://mirrorcv.com', // Optional, using a placeholder
        'X-Title': 'MirrorCV', // Optional
        'Content-Type': 'application/json',
      },
      timeout: config.llm.timeout, // Reuse LLM timeout or create a new one? Using LLM timeout for consistency.
    });
  } catch (error) {
    logger.error(error, `[OpenRouter] API call failed`);
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
      logger.warn(`[OpenRouter] Rate limit hit. Retrying...`);
      
      const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
      logger.info(`[OpenRouter] Retrying in ${backoffMs}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
      await delay(backoffMs);
      return callOpenRouterWithRetry(url, body, attempt + 1);
    }

    // --- STRATEGY 2: Server Overload (503, 500, 502, 504) ---
    if (status >= 500) {
      logger.warn(`[OpenRouter] Server error (${status}). Retrying...`);
      const backoffMs = Math.pow(2, attempt) * 1000;
      await delay(backoffMs);
      return callOpenRouterWithRetry(url, body, attempt + 1);
    }

    // --- STRATEGY 3: Bad Request (400) - Check for Context Length ---
    if (status === 400) {
        if (errorMessage.toLowerCase().includes('context') || errorMessage.toLowerCase().includes('length')) {
          logger.error(`[OpenRouter] Context length exceeded: ${errorMessage}`);
          throw new ApiError(StatusCodes.BAD_REQUEST, `AI Generation Failed: Input text too long.`);
        }
        // If it looks like a temporary issue, maybe retry? But 400 is usually permanent.
    }

    // For other unknown errors, we rethrow to let the caller handle it (or retry if transient)
    // If it is a generic network error (no response), we retry
    if (!error.response) {
      logger.warn(`[OpenRouter] Network error. Retrying...`);
      const backoffMs = Math.pow(2, attempt) * 1000;
      await delay(backoffMs);
      return callOpenRouterWithRetry(url, body, attempt + 1);
    }

    throw error;
  }
};

// Limit global concurrent requests to OpenRouter to prevent 429 errors
// Free tier is sensitive. 2 concurrent requests is safer.
const pLimit = require('p-limit');
const globalLimit = pLimit(2); 

/**
 * Calls the OpenRouter API with a specific prompt.
 * Wrapped in globalLimit to throttle requests.
 */
const generateChunk = (prompt) => {
  return globalLimit(async () => {
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    // Log queue status (approximate) - Debugging only
    // const activeCount = globalLimit.activeCount;
    // const pendingCount = globalLimit.pendingCount;
    // logger.info(`[OpenRouter] Queue Status: ${activeCount} active, ${pendingCount} pending`);

    const body = {
      model: config.openRouter.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    };

    try {
      const response = await callOpenRouterWithRetry(url, body);

      // Validate response structure
      const choice = response.data?.choices?.[0];

      if (!choice?.message?.content) {
        throw new Error(`Invalid response structure from OpenRouter API.`);
      }

      // Check finish reason if available
      if (choice.finish_reason === 'content_filter') {
        throw new ApiError(StatusCodes.BAD_REQUEST, `AI Generation Blocked. Reason: Content Filter`);
      }

      let contentText = choice.message.content;

      // Sanitize: Remove markdown code blocks if present
      contentText = contentText.replace(/^```json\s*/, '').replace(/\s*```$/, '');

      try {
        return JSON.parse(contentText);
      } catch (parseError) {
        // If we got here, the AI gave us malformed JSON. 
        logger.error({ contentText }, 'Failed to parse JSON from OpenRouter');
        throw new Error(`JSON Parse Error: ${parseError.message}`);
      }

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(error.response?.data || error.message, 'OpenRouter API call failed');
      throw new ApiError(
        error.response?.status || StatusCodes.INTERNAL_SERVER_ERROR,
        `OpenRouter API Error: ${error.message}`
      );
    }
  });
};

module.exports = {
  generateChunk,
};
