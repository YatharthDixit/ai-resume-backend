// src/services/generation.service.js
const fs = require('fs/promises'); // Use promises-based fs
const Run = require('../models/run.model');
const Resume = require('../models/resume.model.js');
const processService = require('./process.service');
const llmService = require('./llm.service');
const { JSON_SCHEMA_CHUNKS } = require('../libs/llmSchemas');
const { buildChunkPrompt } = require('../libs/promptBuilder');
const logger = require('../utils/logger');

/**
 * Orchestrates the chunk-loop-merge logic for AI generation.
 * @param {object} job - The 'Process' document (job) from the queue
 */
const runGeneration = async (job) => {
  const { runId, _id: processId } = job;
  logger.info(`[${runId}] Starting generation job...`);

  // 1. Get Run doc to find instructions and text file path
  const run = await Run.findOne({ runId });
  if (!run) throw new Error(`[${runId}] Associated Run document not found.`);

  // 2. Read the extracted text from the LOCAL file
  // This reads from the 'extracted_details' path we saved in the Run doc
  const rawText = await fs.readFile(run.extractedTextKey, 'utf-8');

  // 3. Loop, Call, and Merge
  const final_json = {};
  const chunkKeys = Object.keys(JSON_SCHEMA_CHUNKS);

  for (const key of chunkKeys) {
    logger.info(`[${runId}] Processing chunk: ${key}`);
    const chunkSchema = JSON_SCHEMA_CHUNKS[key];
    const prompt = buildChunkPrompt(
      rawText,
      run.instruction_text,
      chunkSchema
    );

    try {
      // 3a. Call the LLM
      const chunkJson = await llmService.generateChunk(prompt);
      
      // 3b. Merge the result
      Object.assign(final_json, chunkJson);
      
      // 3c. Update progress
      await processService.updateChunkProgress(processId, key);
    } catch (error) {
      logger.error(error, `[${runId}] Failed to process chunk: ${key}`);
      // Log the error but continue to the next chunk
      await processService.updateChunkProgress(processId, key, error);
    }
  }

  logger.info(`[${runId}] All chunks processed. Saving to database...`);

  // 4. Save the final merged JSON to the 'resumes' collection
  await Resume.create({
    runId,
    final_json,
  });

  logger.info(`[${runId}] Generation job finished.`);
};

module.exports = {
  runGeneration,
};