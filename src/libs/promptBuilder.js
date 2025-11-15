// src/libs/promptBuilder.js
function buildChunkPrompt(candidateText, instruction, chunkSchemaString) {
  return `You are an expert resume parser.
1. Read the following resume text.
2. Apply this specific user instruction: "${instruction}".
3. Extract *only* the content and structure it *exactly* according to the following JSON schema.
4. If a field is not present in the resume text, return an empty value (e.g., "" or []).

JSON SCHEMA:${chunkSchemaString}

-----BEGIN_RESUME_TEXT-----${candidateText}
-----END_RESUME_TEXT-----

Return *only* the populated JSON object. Do not add markdown \`\`\`json wrappers or any other text.`;
}

module.exports = {
  buildChunkPrompt,
};