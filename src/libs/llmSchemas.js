// src/libs/llmSchemas.js

/**
 * This is the "chunked" schema.
 * We will loop through each key and make a separate API call.
 */
const JSON_SCHEMA_CHUNKS = {
  header: `{
    "name": "string (candidate's full name)",
    "contactInfo": "string (single line: City, State | Phone | Email | LinkedIn)",
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
        "bullets": ["string (achievement 1)", "string (achievement 2)"]
      }
    ]
  }`,
  projects: `{
    "projects": [
      {
        "name": "string (Project Name)",
        "description": "string (Brief description or technologies)",
        "bullets": ["string (what you did)", "string (what you did 2)"]
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

module.exports = {
  JSON_SCHEMA_CHUNKS,
};