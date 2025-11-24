// src/services/generation.service.js
const fs = require('fs/promises');
const Run = require('../models/run.model');
const Resume = require('../models/resume.model.js');
const processService = require('./process.service');
const llmService = require('./llm.service');
const { JSON_SCHEMA_CHUNKS } = require('../libs/llmSchemas');
const { buildChunkPrompt, buildParsePrompt } = require('../libs/promptBuilder');
const logger = require('../utils/logger');

/**
 * PASS 1: Generate Structured Data (Original JSON)
 * Extracts data from raw text without optimization.
 */
const generateStructuredData = async (rawText, runId, processId = null) => {
  logger.info(`[${runId}] Starting Pass 1: Parsing...`);
  const original_json = {};
  const chunkKeys = Object.keys(JSON_SCHEMA_CHUNKS);

  for (let i = 0; i < chunkKeys.length; i++) {
    const key = chunkKeys[i];
    logger.info(`[${runId}] Parsing chunk: ${key}`);

    // Update process status with current chunk
    if (processId) {
      await processService.updateStatus(processId, {
        status: 'parsing',
        step: 'parse',
        currentChunk: key,
        meta: {
          chunks_total: chunkKeys.length,
          chunks_completed: i,
        }
      });
    }

    const chunkSchema = JSON_SCHEMA_CHUNKS[key];
    // Use the Parse-Only prompt
    const prompt = buildParsePrompt(rawText, chunkSchema);

    try {
      const chunkJson = await llmService.generateChunk(prompt);
      Object.assign(original_json, chunkJson);
    } catch (error) {
      logger.error(error, `[${runId}] Failed to parse chunk: ${key}`);
      // Continue to next chunk even if one fails
    }
  }

  // Mark parsing as complete
  if (processId) {
    await processService.updateStatus(processId, {
      status: 'parsed',
      meta: {
        chunks_total: chunkKeys.length,
        chunks_completed: chunkKeys.length
      }
    });
  }

  return original_json;
};

/**
 * PASS 2: Optimize Structured Data (Final JSON)
 * Takes the original JSON (or raw text) and optimizes it based on instructions.
 * Note: We still use rawText + Instructions for the best LLM context, 
 * but we ensure the schema matches.
 */
const optimizeStructuredData = async (rawText, instruction, runId, processId) => {
  logger.info(`[${runId}] Starting Pass 2: Optimization...`);
  const final_json = {};
  const chunkKeys = Object.keys(JSON_SCHEMA_CHUNKS);

  for (let i = 0; i < chunkKeys.length; i++) {
    const key = chunkKeys[i];
    logger.info(`[${runId}] Optimizing chunk: ${key}`);

    // Update status to generating with current chunk
    if (processId) {
      await processService.updateStatus(processId, {
        status: 'generating',
        step: 'generate',
        currentChunk: key,
      });
    }

    const chunkSchema = JSON_SCHEMA_CHUNKS[key];
    // Use the Optimization prompt
    const prompt = buildChunkPrompt(rawText, instruction, chunkSchema);

    try {
      const chunkJson = await llmService.generateChunk(prompt);
      Object.assign(final_json, chunkJson);

      // Update progress only during the main optimization phase
      if (processId) {
        await processService.updateChunkProgress(processId, key);
      }
    } catch (error) {
      logger.error(error, `[${runId}] Failed to optimize chunk: ${key}`);
      if (processId) {
        await processService.updateChunkProgress(processId, key, error);
      }
    }
  }
  return final_json;
};

module.exports = {
  generateStructuredData,
  optimizeStructuredData,
};