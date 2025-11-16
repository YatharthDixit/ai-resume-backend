// src/libs/promptBuilder.js
function buildChunkPrompt(candidateText, instruction, chunkSchemaString) {
  return `You are an expert resume parser.
1. Read the following resume text.
2. Apply this specific user instruction: "${instruction}".
3. Extract *only* the content and structure it *exactly* according to the following JSON schema.
4. If a field is not present in the resume text, return an empty value (e.g., "" or []).
5. For the 'header' chunk, parse the contact line into the structured 'contactInfo' object. Find the email, phone, location, and LinkedIn URL.
6. For 'experience' and 'projects', scan the text (especially the '--- Extracted Links ---' section) for URLs.
7. Identify the *single most important URL* (like a GitHub repo for a project, or a company site for a job) and place it in the 'primaryLinkUrl' field.
8. Place any *additional* URLs (like 'Live Demo' or specific articles) into the 'links' array.

JSON SCHEMA:${chunkSchemaString}

-----BEGIN_RESUME_TEXT-----${candidateText}
-----END_RESUME_TEXT-----

Return *only* the populated JSON object. Do not add markdown \`\`\`json wrappers or any other text.`;
}

module.exports = {
  buildChunkPrompt,
};