// src/api/runs.validation.js
const { z } = require('zod');

const createRunSchema = z.object({
  instruction_text: z
    .string()
    .min(1, 'Instruction text is required')
    .max(1000, 'Instruction text must be 1000 characters or less'),
});

module.exports = {
  createRunSchema,
};