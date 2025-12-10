// src/middleware/validate.js
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');

// This middleware generator takes a Zod schema
const validate = (schema) => (req, res, next) => {
  try {
    // We only parse req.body for this project's needs
    schema.parse(req.body);
    next();
  } catch (error) {
    let errorMessage;

    // Check if it's a ZodError (usually has .issues or .errors)
    const issues = error.errors || error.issues;

    if (issues && Array.isArray(issues)) {
      errorMessage = issues.map((e) => e.message).join(', ');
    } else {
      // Sometimes error.message IS the stringified JSON array (Zod v3 default)
      try {
        const parsed = JSON.parse(error.message);
        if (Array.isArray(parsed) && parsed[0]?.code) {
          errorMessage = parsed.map((e) => e.message).join(', ');
        } else {
          errorMessage = error.message;
        }
      } catch (e) {
        // Not JSON, just use message
        errorMessage = error.message || 'Invalid request data';
      }
    }
    next(new ApiError(StatusCodes.BAD_REQUEST, errorMessage));
  }
};

module.exports = validate;