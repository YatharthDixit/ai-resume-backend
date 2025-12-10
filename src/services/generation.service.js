// src/services/generation.service.js
const llmService = require('./llm.service');
const { JSON_SCHEMA_CHUNKS } = require('../libs/llmSchemas');
const { buildChunkPrompt, buildParsePrompt } = require('../libs/promptBuilder');
const logger = require('../utils/logger');
const pLimit = require('p-limit');

const limit = pLimit(3);


/**
 * PASS 1: Generate Structured Data (Original JSON)
 * Extracts data from raw text without optimization.
 */
const generateStructuredData = async (rawText, runId) => {
  logger.info(`[${runId}] Starting Pass 1: Parsing (concurrency: 3)...`);
  const original_json = {};
  const chunkKeys = Object.keys(JSON_SCHEMA_CHUNKS);

  // Process chunks with concurrency limit using p-limit
  const results = await Promise.all(
    chunkKeys.map((key) =>
      limit(async () => {
        logger.info(`[${runId}] Parsing chunk: ${key}`);
        const chunkSchema = JSON_SCHEMA_CHUNKS[key];
        const prompt = buildParsePrompt(rawText, chunkSchema);

        try {
          const chunkJson = await llmService.generateChunk(prompt);
          return { key, chunkJson, error: null };
        } catch (error) {
          logger.error(error, `[${runId}] Failed to parse chunk: ${key}`);
          return { key, chunkJson: null, error };
        }
      })
    )
  );

  // Merge successful results
  results.forEach(({ chunkJson }) => {
    if (chunkJson) {
      Object.assign(original_json, chunkJson);
    }
  });

  return original_json;
};

/**
 * PASS 2: Optimize Structured Data (Final JSON)
 * Takes the original JSON (or raw text) and optimizes it based on instructions.
 * Note: We still use rawText + Instructions for the best LLM context, 
 * but we ensure the schema matches.
 */
const optimizeStructuredData = async (rawText, instruction, runId) => {
  logger.info(`[${runId}] Starting Pass 2: Optimization (concurrency: 3)...`);
  const final_json = {};
  const chunkKeys = Object.keys(JSON_SCHEMA_CHUNKS);

  // Process chunks with concurrency limit using p-limit
  const results = await Promise.all(
    chunkKeys.map((key) =>
      limit(async () => {
        logger.info(`[${runId}] Optimizing chunk: ${key}`);
        const chunkSchema = JSON_SCHEMA_CHUNKS[key];
        const prompt = buildChunkPrompt(rawText, instruction, chunkSchema);

        try {
          const chunkJson = await llmService.generateChunk(prompt);
          return { key, chunkJson, error: null };
        } catch (error) {
          logger.error(error, `[${runId}] Failed to optimize chunk: ${key}`);
          return { key, chunkJson: null, error };
        }
      })
    )
  );

  // Merge successful results
  results.forEach(({ chunkJson }) => {
    if (chunkJson) {
      Object.assign(final_json, chunkJson);
    }
  });

  return final_json;
};

module.exports = {
  generateStructuredData,
  optimizeStructuredData,
};