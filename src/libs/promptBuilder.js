// src/libs/promptBuilder.js
function buildChunkPrompt(candidateText, instruction, chunkSchemaString) {
  return `You are an expert resume parser.
1. Read the following resume text.
2. Apply this specific user instruction: "${instruction}".
3. Extract *only* the content and structure it *exactly* according to the following JSON schema.
4. Look for link descriptions (e.g., 'GitHub', 'Live Demo') and match them with URLs found in the '--- Extracted Links ---' section of the resume text.
5. Populate the 'links' array in 'experience' and 'projects' with both the 'text' (e.g., 'GitHub') and the full 'url'.
6. If a field is not present in the resume text, return an empty value (e.g., "" or []).

JSON SCHEMA:${chunkSchemaString}

-----BEGIN_RESUME_TEXT-----${candidateText}
-----END_RESUME_TEXT-----

Return *only* the populated JSON object. Do not add markdown \`\`\`json wrappers or any other text.`;
}

module.exports = {
  buildChunkPrompt,
};