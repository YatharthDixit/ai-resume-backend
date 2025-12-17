// src/services/generation.service.js
const llmService = require('./openrouter.service');

const { JSON_SCHEMA_CHUNKS, ATS_REPORT_SCHEMA } = require('../libs/llmSchemas');
const { buildChunkPrompt, buildParsePrompt, buildAtsReportPrompt } = require('../libs/promptBuilder');
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

        const chunkJson = await llmService.generateChunk(prompt);
        return { key, chunkJson };
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
 */
const optimizeStructuredData = async (rawText, instruction, runId, jobDescription = null) => {
  logger.info(`[${runId}] Starting Pass 2: Optimization (concurrency: 3)...`);
  const final_json = {};
  const chunkKeys = Object.keys(JSON_SCHEMA_CHUNKS);

  // Process chunks with concurrency limit using p-limit
  const results = await Promise.all(
    chunkKeys.map((key) =>
      limit(async () => {
        logger.info(`[${runId}] Optimizing chunk: ${key}`);
        const chunkSchema = JSON_SCHEMA_CHUNKS[key];
        // For standard chunks, we pass JD for tailoring if it exists
        const prompt = buildChunkPrompt(rawText, instruction, chunkSchema, jobDescription);

        const chunkJson = await llmService.generateChunk(prompt);
        return { key, chunkJson };
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

/**
 * Generates ATS Comparison Report
 */
const generateAtsReport = async (originalJson, finalJson, jobDescription, runId) => {
  logger.info(`[${runId}] Generating ATS Report...`);
  const schemaString = JSON.stringify(ATS_REPORT_SCHEMA, null, 2);
  const prompt = buildAtsReportPrompt(originalJson, finalJson, jobDescription, schemaString);

  try {
    const result = await llmService.generateChunk(prompt);
    return result;
  } catch (error) {
    logger.error(error, `[${runId}] Failed to generate ATS Report`);
    return null;
  }
};

module.exports = {
  generateStructuredData,
  optimizeStructuredData,
  generateAtsReport,
};