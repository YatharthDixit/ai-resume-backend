// src/libs/promptBuilder.js

function buildChunkPrompt(candidateText, instruction, chunkSchemaString, jobDescription = null) {
  // STANDARD GENERATION
  return `You are an expert resume parser and optimizer.
1. Read the following resume text.
2. Apply this specific user instruction: "${instruction}".
${jobDescription ? `3. Tailor the content to better match this Job Description: "${jobDescription.slice(0, 500)}..."` : ''}
4. Extract *only* the content and structure it *exactly* according to the following JSON schema.
5. If a field is not present in the resume text, return an empty value (e.g., "" or []).
6. For the 'header' chunk, parse the contact line into the structured 'contactInfo' object. Find the email, phone, location, and LinkedIn URL.
7. For 'experience' and 'projects', scan the text (especially the '--- Extracted Links ---' section) for URLs.
8. Identify the *single most important URL* (like a GitHub repo for a project, or a company site for a job) and place it in the 'primaryLinkUrl' field.
9. Place any *additional* URLs (like 'Live Demo' or specific articles) into the 'links' array.
10. Be conservative. If the instruction doesn't require a change, keep the original text.
11. **FORMATTING**: Ensure all strings are properly escaped. Do not include unescaped newlines or special characters inside JSON string values.
12. **STRICT OUTPUT**: Return ONLY the JSON object.

JSON SCHEMA:${chunkSchemaString}

-----BEGIN_RESUME_TEXT-----${candidateText}
-----END_RESUME_TEXT-----

Return *only* the populated JSON object.`;
}

function buildParsePrompt(candidateText, chunkSchemaString) {
  // STANDARD PARSING
  return `You are an expert resume parser.
1. Read the following resume text.
2. Extract *only* the content and structure it *exactly* according to the following JSON schema.
3. Do NOT optimize, rewrite, or improve the content. Keep it as close to the original as possible.
4. If a field is not present, return empty.
5. **FORMATTING**: Ensure all strings are properly escaped. Do not include unescaped newlines or special characters inside JSON string values.
6. **STRICT OUTPUT**: Return ONLY the JSON object.

JSON SCHEMA:${chunkSchemaString}

-----BEGIN_RESUME_TEXT-----${candidateText}
-----END_RESUME_TEXT-----

Return *only* the populated JSON object.`;
}

function buildAtsReportPrompt(originalJson, finalJson, jobDescription, reportSchemaString) {
  return `You are an expert Applicant Tracking System (ATS) evaluator.

YOUR TASK:
1. Compare the ORIGINAL RESUME and the GENERATED RESUME against the JOB DESCRIPTION.
2. Calculate a match score (0-100) for BOTH versions.
3. Identify what improvements were made in the generated version.
4. Identify what important keywords are still missing in the generated version.

JOB DESCRIPTION:
${jobDescription}

ORIGINAL RESUME (JSON):
${JSON.stringify(originalJson).slice(0, 15000)}

GENERATED RESUME (JSON):
${JSON.stringify(finalJson).slice(0, 15000)}

JSON SCHEMA:
${reportSchemaString}

Return *only* the populated JSON object matching the schema.`;
}

module.exports = {
  buildChunkPrompt,
  buildParsePrompt,
  buildAtsReportPrompt,
};