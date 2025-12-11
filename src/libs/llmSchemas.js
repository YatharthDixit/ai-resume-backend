// src/libs/llmSchemas.js

/**
 * This is the "chunked" schema.
 * We will loop through each key and make a separate API call.
 */
const JSON_SCHEMA_CHUNKS = {
  header: `{
    "name": "string (candidate's full name)",
    "contactInfo": {
      "location": "string (e.g., City, State)",
      "phone": "string (Phone number)",
      "email": "string (Email address)",
      "linkedin": "string (Full LinkedIn URL)"
    },
    "objective": "string (A brief 1-2 sentence career objective, if present)"
  }`,
  education: `{
    "education": [
      {
        "school": "string (University Name, City, State)",
        "degree": "string (Degree, Major)",
        "details": ["string (e.g., Graduation Date: May 20XX)", "string (e.g., GPA: 3.X/4.0)"]
      }
    ]
  }`,
  experience: `{
    "experience": [
      {
        "company": "string (Company Name, City, State)",
        "role": "string (Job Title)",
        "date": "string (e.g., Month 20XX - Present)",
        "bullets": ["string (achievement 1)", "string (achievement 2)"],
        "primaryLinkUrl": "string (Optional: The single most important URL for this job, e.g., company website)",
        "links": [
          {
            "text": "string (e.g., 'Project Link', 'Reference')",
            "url": "string (Full URL)"
          }
        ]
      }
    ]
  }`,
  projects: `{
    "projects": [
      {
        "name": "string (Project Name)",
        "description": "string (Brief description or technologies)",
        "bullets": ["string (what you did)", "string (what you did 2)"],
        "primaryLinkUrl": "string (Optional: The single most important URL for this project, e.g., the GitHub repo)",
        "links": [
          {
            "text": "string (e.g., 'GitHub', 'Live Demo')",
            "url": "string (Full URL)"
          }
        ]
      }
    ]
  }`,
  skillsAndExtras: `{
    "skills": {
      "languages": "string (e.g., JavaScript, Python, Java, C++)",
      "technologies": "string (e.g., React, Node.js, SQL, AWS, Docker)"
    },
    "certifications": ["string (e.g., 'Object Oriented Programming in Java - UC San Diego')"],
    "activities": ["string (e.g., 'Member of Khushiyan Batton Club...')"]
  }`,
};

const ATS_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    originalScore: {
      type: 'number',
      description: 'ATS match score (0-100) for the ORIGINAL resume against the JD.'
    },
    generatedScore: {
      type: 'number',
      description: 'ATS match score (0-100) for the NEW GENERATED resume against the JD.'
    },
    missingKeywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Important keywords from the JD that are still missing or weak in the generated resume.'
    },
    changesSummary: {
      type: 'string',
      description: 'A brief summary of the key improvements made to better match the JD.'
    }
  },
  required: ['originalScore', 'generatedScore', 'missingKeywords', 'changesSummary']
};

module.exports = {
  JSON_SCHEMA_CHUNKS,
  ATS_REPORT_SCHEMA,
};