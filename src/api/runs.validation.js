// src/api/runs.validation.js
const { z } = require('zod');

const createRunSchema = z
  .object({
    instruction_text: z
      .string()
      .max(1000, 'Instruction text must be 1000 characters or less')
      .optional(),
    job_description: z
      .string()
      .max(5000, 'Job description must be 5000 characters or less')
      .optional(),
  })
  .refine(
    (data) => data.instruction_text || data.job_description,
    'Either instruction text or job description is required'
  );

module.exports = {
  createRunSchema,
};